import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';

import { EmailAlreadyInUseError } from '../../../application/errors/email-already-in-use-error.js';
import type {
  CreateUserInput,
  UserRepository,
} from '../../../application/ports/repositories/user.repository.js';
import { User } from '../../../domain/entities/user.js';
import { Email } from '../../../domain/value-objects/email.js';

import { prisma } from './prisma-client.js';

/**
 * UserRepository 的 Prisma/PostgreSQL 實作。
 *
 * Application Layer 只知道：
 *
 *   UserRepository
 *
 * Infrastructure Layer 才知道：
 *
 *   Prisma
 *   PostgreSQL
 *
 * Dependency direction：
 *
 *   Application
 *       ↑
 *   Infrastructure
 *
 * 而不是 Application 去依賴 Prisma。
 */
export class PrismaUserRepository implements UserRepository {
  /**
   * Prisma Client。
   *
   * 使用 interface type：
   *
   *   PrismaClient
   *
   * 讓 Repository 可以在建立時注入不同的 Prisma Client，
   * 同時預設使用 Application 共用的 prisma instance。
   *
   * 不使用：
   *
   *   constructor(
   *     private readonly client: PrismaClient = prisma,
   *   ) {}
   *
   * 因為 constructor parameter property
   * 不符合 erasableSyntaxOnly: true。
   */
  private readonly client: PrismaClient;

  /**
   * Constructor Injection。
   *
   * 正式執行：
   *
   *   new PrismaUserRepository()
   *
   * 就會使用共用 prisma。
   *
   * 測試如果有需要，也可以：
   *
   *   new PrismaUserRepository(testPrismaClient)
   */
  constructor(client: PrismaClient = prisma) {
    this.client = client;
  }

  /**
   * 依 Email 尋找 User。
   *
   * Email 在進入 Repository 前已經透過 Email Value Object
   * 完成標準化，因此這裡直接使用 email.value 查詢即可。
   */
  async findByEmail(email: Email): Promise<User | null> {
    const record = await this.client.user.findUnique({
      where: {
        email: email.value,
      },
    });

    /**
     * Repository 使用 null 表示沒有找到 User。
     *
     * 「不存在」不是 Infrastructure Error，
     * 而是正常的查詢結果。
     */
    if (!record) {
      return null;
    }

    /**
     * Prisma Persistence Model
     *         ↓
     * Domain Entity
     *
     * 不把 Prisma record 直接往 Application 傳。
     */
    return new User({
      id: record.id,
      email: Email.create(record.email),
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  /**
   * 建立 Local Password User。
   *
   * 目前資料模型使用：
   *
   *   users.passwordHash?
   *
   * Local Password Account：
   *
   *   passwordHash = bcrypt hash
   *
   * 未來 OAuth-only Account：
   *
   *   passwordHash = null
   */
  async create(input: CreateUserInput): Promise<User> {
    try {
      const record = await this.client.user.create({
        data: {
          email: input.email.value,
          passwordHash: input.passwordHash,
        },
      });

      /**
       * Prisma record 轉回 Domain User。
       *
       * Domain User 本身目前不公開 passwordHash，
       * 因為 password hash 是 Authentication /
       * Persistence concern，不是一般 User Entity
       * 需要到處攜帶的資料。
       */
      return new User({
        id: record.id,
        email: Email.create(record.email),
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    } catch (error) {
      /**
       * Email 在 PostgreSQL 有 UNIQUE constraint。
       *
       * 雖然 RegisterUserUseCase 已經先做：
       *
       *   findByEmail()
       *
       * 但那不能防止 concurrent registration。
       *
       * 例如：
       *
       * Request A → SELECT → 不存在
       * Request B → SELECT → 不存在
       *
       * Request A → INSERT → success
       * Request B → INSERT → UNIQUE violation
       *
       * 所以 Database UNIQUE constraint
       * 才是最後一道一致性保護。
       */
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        /**
         * 不讓 Prisma-specific error
         * 洩漏到 Application Layer。
         *
         * Infrastructure：
         *
         *   Prisma P2002
         *
         * 轉換成 Application 可以理解的：
         *
         *   EmailAlreadyInUseError
         */
        throw new EmailAlreadyInUseError();
      }

      /**
       * 不是我們目前能處理的 Prisma Error，
       * 原樣往上拋，之後由更上層統一處理。
       */
      throw error;
    }
  }
}
