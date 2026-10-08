import { Email } from '../../domain/value-objects/email.js';
import type { User } from '../../domain/entities/user.js';

import { AppError } from '../errors/app-error.js';
import type { UserRepository } from '../ports/repositories/user.repository.js';
import type { PasswordHasher } from '../ports/services/password-hasher.js';

/**
 * Register Use Case 的輸入資料。
 *
 * 仍然接收 primitive string。
 *
 * Email 的 normalization / validation
 * 交給 Email Value Object。
 *
 * Password business rule
 * 則由這個 Use Case 負責。
 */
interface RegisterUserInput {
  email: string;
  password: string;
}

/**
 * Local password 最低長度。
 *
 * 這是 Register Application rule，
 * 因此集中在 RegisterUserUseCase。
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * 註冊本機帳號。
 *
 * Use Case 負責 Application business flow：
 *
 * 1. 建立並正規化 Email
 * 2. 檢查最低密碼長度
 * 3. 確認 Email 尚未使用
 * 4. Hash password
 * 5. 建立 User
 *
 * Use Case 不直接知道：
 *
 * - Express
 * - Prisma
 * - PostgreSQL
 * - bcryptjs
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
     * Email Value Object 負責：
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
     * Presentation Layer 已經會先用 Zod 驗證 HTTP Request。
     *
     * 但 Use Case 本身仍保留最低密碼長度規則，
     * 因為 Application 不應假設永遠只會被 HTTP Controller 呼叫。
     */
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(`Password must contain at least ${MIN_PASSWORD_LENGTH} characters`, 400);
    }

    /**
     * 一般 duplicate registration 可以在 Hash password 前
     * 就先拒絕，避免不必要的 bcrypt 計算。
     */
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new AppError('Email address is already in use', 409, 'EMAIL_ALREADY_IN_USE');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    /**
     * Repository.create()：
     *
     * User
     * → 建立成功
     *
     * null
     * → Database unique constraint 發生 conflict
     *
     * 即使 findByEmail() 剛才沒有找到 User，
     * concurrent request 仍可能在這之間先完成 INSERT。
     */
    const user = await this.userRepository.create({
      email,
      passwordHash,
    });

    if (!user) {
      throw new AppError('Email address is already in use', 409, 'EMAIL_ALREADY_IN_USE');
    }

    return user;
  }
}
