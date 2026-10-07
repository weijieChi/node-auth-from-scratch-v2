import type { User } from '../../domain/entities/user.js';
import { Email } from '../../domain/value-objects/email.js';

import { EmailAlreadyInUseError } from '../errors/email-already-in-use-error.js';
import type { UserRepository } from '../ports/repositories/user.repository.js';
import type { PasswordHasher } from '../ports/services/password-hasher.js';

/**
 * Register Use Case 的輸入資料。
 *
 * 這裡仍然接收 primitive string，
 * Email 的標準化與合法性會交給 Email Value Object 處理。
 *
 * HTTP 層之後還會使用 Zod 做 Request Schema 驗證，
 * 但 Use Case 本身不依賴 Express 或 HTTP。
 */
interface RegisterUserInput {
  email: string;
  password: string;
}

/**
 * 使用者註冊 Use Case。
 *
 * 主要負責：
 *
 * 1. 建立並驗證 Email。
 * 2. 檢查 Email 是否已經被使用。
 * 3. 將原始密碼交給 PasswordHasher。
 * 4. 將 User 寫入 Repository。
 *
 * Use Case 不知道實際使用：
 *
 * - Prisma
 * - PostgreSQL
 * - bcryptjs
 * - Express
 *
 * 這些細節全部由注入的 Port 實作處理。
 */
export class RegisterUserUseCase {
  /**
   * 使用者資料存取介面。
   *
   * 注意：
   * 不使用 constructor parameter property：
   *
   *   constructor(
   *     private readonly userRepository: UserRepository,
   *   ) {}
   *
   * 因為專案啟用了：
   *
   *   erasableSyntaxOnly: true
   *
   * Parameter Property 需要 TypeScript 額外產生
   * JavaScript class property，因此不允許使用。
   */
  private readonly userRepository: UserRepository;

  /**
   * 密碼雜湊服務。
   *
   * Application 只依賴 PasswordHasher Port，
   * 不直接依賴 bcryptjs。
   */
  private readonly passwordHasher: PasswordHasher;

  /**
   * Constructor Injection。
   *
   * 依賴從外部傳進來，
   * Use Case 不自行 new Repository 或 Hasher。
   */
  constructor(userRepository: UserRepository, passwordHasher: PasswordHasher) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
  }

  /**
   * 執行使用者註冊。
   */
  async execute(input: RegisterUserInput): Promise<User> {
    /**
     * 將原始 Email string 轉成 Email Value Object。
     *
     * Email.create() 會：
     *
     * - trim
     * - lowercase
     * - 使用 Zod 驗證 Email
     *
     * 成功建立後的 Email 就代表已符合目前 Domain 規則。
     */
    const email = Email.create(input.email);

    /**
     * 基本密碼規則。
     *
     * Step 09 HTTP Zod Schema 也會提供 Request Boundary 驗證，
     * 但 Use Case 不應完全假設它永遠只會由 HTTP 呼叫。
     *
     * bcrypt 的 72 bytes 上限則由 BcryptPasswordHasher
     * 額外負責，因為那是 bcrypt implementation constraint。
     */
    if (input.password.length < 12) {
      throw new RangeError('Password must contain at least 12 characters');
    }

    /**
     * 先檢查 Email 是否已存在。
     *
     * 這可以提供正常情況下比較明確的錯誤流程，
     * 但不能取代 PostgreSQL UNIQUE constraint。
     *
     * Concurrent Register 時仍可能發生：
     *
     * A → findByEmail() → null
     * B → findByEmail() → null
     * A → INSERT success
     * B → INSERT unique violation
     *
     * 因此 Prisma Repository 還會處理 P2002。
     */
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new EmailAlreadyInUseError();
    }

    /**
     * Use Case 不知道實際使用 bcrypt。
     *
     * 它只要求：
     *
     *   raw password
     *       ↓
     *   PasswordHasher
     *       ↓
     *   password hash
     */
    const passwordHash = await this.passwordHasher.hash(input.password);

    /**
     * 將已正規化的 Email 和 password hash
     * 交給 Repository 儲存。
     *
     * Repository 實際怎麼寫 PostgreSQL，
     * Use Case 不需要知道。
     */
    return this.userRepository.create({
      email,
      passwordHash,
    });
  }
}
