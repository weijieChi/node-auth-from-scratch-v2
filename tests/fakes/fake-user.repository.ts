import { randomUUID } from 'node:crypto';

import type {
  CreateUserInput,
  LocalAuthUser,
  UserRepository,
} from '../../src/application/ports/repositories/user.repository.js';
import { User } from '../../src/domain/entities/user.js';
import type { Email } from '../../src/domain/value-objects/email.js';

/**
 * UserRepository 的測試用 Fake Implementation。
 *
 * Application Unit Test 不依賴：
 *
 * - Prisma
 * - PostgreSQL
 *
 * 所有資料都只存在記憶體中。
 */
export class FakeUserRepository implements UserRepository {
  /**
   * 模擬 users table。
   */
  readonly users: User[] = [];

  /**
   * Domain User 不包含 passwordHash，
   * 所以另外使用 Map 模擬 persistence credential data。
   *
   * key:
   *   user.id
   *
   * value:
   *   passwordHash
   */
  readonly passwordHashes = new Map<string, string>();

  /**
   * 模擬：
   *
   * findByEmail()
   * → null
   *
   * 但 create() 時發生 concurrent unique conflict。
   *
   * 這是 Step 09 B 方案留下來的測試能力。
   */
  simulateCreateConflict = false;

  findByEmail(email: Email): Promise<User | null> {
    const user = this.users.find((candidate) => candidate.email.value === email.value);

    return Promise.resolve(user ?? null);
  }

  /**
   * Access Token 的 sub 是 userId。
   *
   * GET /auth/me 最後會依照 userId
   * 尋找目前的 User。
   */
  findById(id: string): Promise<User | null> {
    const user = this.users.find((candidate) => candidate.id === id);

    return Promise.resolve(user ?? null);
  }

  /**
   * Login 專用 Repository Query。
   *
   * Login 不只需要 User，
   * 還需要 persistence 中的 passwordHash。
   *
   * OAuth-only account 未來可能：
   *
   * passwordHash = null
   */
  findLocalAuthByEmail(email: Email): Promise<LocalAuthUser | null> {
    const user = this.users.find((candidate) => candidate.email.value === email.value);

    if (!user) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      user,

      passwordHash: this.passwordHashes.get(user.id) ?? null,
    });
  }

  create(input: CreateUserInput): Promise<User | null> {
    if (this.simulateCreateConflict) {
      return Promise.resolve(null);
    }

    const now = new Date();

    const user = new User({
      id: randomUUID(),
      email: input.email,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.users.push(user);

    this.passwordHashes.set(user.id, input.passwordHash);

    return Promise.resolve(user);
  }
}
