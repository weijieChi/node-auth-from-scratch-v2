import { randomUUID } from 'node:crypto';

import type {
  CreateUserInput,
  UserRepository,
} from '../../src/application/ports/repositories/user.repository.js';
import { User } from '../../src/domain/entities/user.js';
import type { Email } from '../../src/domain/value-objects/email.js';

/**
 * UserRepository 的測試用 Fake Implementation。
 *
 * RegisterUserUseCase 的 Unit Test 不應該依賴：
 *
 * - Prisma
 * - PostgreSQL
 * - Network
 *
 * 因此使用記憶體中的 Array / Map 模擬 Repository。
 *
 * 這不是 Production Repository。
 */
export class FakeUserRepository implements UserRepository {
  /**
   * 模擬 users table。
   */
  readonly users: User[] = [];

  /**
   * Domain User 目前不攜帶 passwordHash。
   *
   * 但 Register Unit Test 仍然需要確認：
   *
   * raw password
   *     ↓
   * PasswordHasher
   *     ↓
   * password hash
   *     ↓
   * UserRepository
   *
   * 因此 Fake Repository 額外使用 Map 保存 hash。
   *
   * key:
   *   user.id
   *
   * value:
   *   passwordHash
   */
  readonly passwordHashes = new Map<string, string>();

  /**
   * 根據已經標準化的 Email 尋找 User。
   *
   * Production Repository 的實作會真的查詢 PostgreSQL。
   *
   * Fake Repository 只需要查詢記憶體中的 users array。
   *
   * UserRepository interface 要求 Promise，
   * 但這裡沒有真正的 asynchronous operation，
   * 因此直接使用 Promise.resolve()。
   */
  findByEmail(email: Email): Promise<User | null> {
    const user = this.users.find((candidate) => candidate.email.value === email.value);

    return Promise.resolve(user ?? null);
  }

  /**
   * 模擬建立 Local Password User。
   *
   * 真正的 PrismaUserRepository 會：
   *
   *   INSERT INTO users ...
   *
   * Fake Repository 則只建立 User Entity，
   * 並存進記憶體。
   */
  create(input: CreateUserInput): Promise<User> {
    const now = new Date();

    const user = new User({
      id: randomUUID(),
      email: input.email,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.users.push(user);

    /**
     * 保存 Use Case 傳進來的 passwordHash，
     * 讓 Unit Test 可以確認：
     *
     * Repository 收到的是 hash，
     * 而不是原始 password。
     */
    this.passwordHashes.set(user.id, input.passwordHash);

    return Promise.resolve(user);
  }
}
