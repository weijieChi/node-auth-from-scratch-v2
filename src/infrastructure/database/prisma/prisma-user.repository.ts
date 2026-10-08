import { Prisma } from '../../../generated/prisma/client.js';

import type {
  CreateUserInput,
  UserRepository,
} from '../../../application/ports/repositories/user.repository.js';

import { User } from '../../../domain/entities/user.js';
import { Email } from '../../../domain/value-objects/email.js';

import { prisma, type PrismaClient } from './prisma-client.js';

/**
 * Prisma implementation of UserRepository。
 *
 * Repository 負責：
 *
 * - PostgreSQL persistence
 * - Prisma-specific error interpretation
 * - Persistence Model → Domain Entity mapping
 *
 * Repository 不負責：
 *
 * - HTTP status code
 * - HTTP response
 * - Application business error
 *
 * 已知且可預期的 persistence result
 * 可以透過 Repository contract 回傳給 Application。
 *
 * 其他未預期的 Prisma / PostgreSQL error
 * 保留原始 Error 與 stack trace，直接往上拋。
 */
export class PrismaUserRepository implements UserRepository {
  private readonly client: PrismaClient;

  constructor(client: PrismaClient = prisma) {
    this.client = client;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const record = await this.client.user.findUnique({
      where: {
        email: email.value,
      },
    });

    /**
     * null 在 findByEmail() 中代表：
     *
     * Query 正常完成，
     * 但不存在符合 Email 的 User。
     *
     * Database failure 不會被轉成 null。
     */
    if (!record) {
      return null;
    }

    return new User({
      id: record.id,
      email: Email.create(record.email),
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async create(input: CreateUserInput): Promise<User | null> {
    try {
      const record = await this.client.user.create({
        data: {
          email: input.email.value,
          passwordHash: input.passwordHash,
        },
      });

      return new User({
        id: record.id,
        email: Email.create(record.email),
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    } catch (error) {
      /**
       * RegisterUserUseCase 已經會先檢查 Email 是否存在，
       * 但 concurrent requests 仍可能同時通過檢查。
       *
       * PostgreSQL UNIQUE constraint 是最後一道一致性保護。
       *
       * 目前 User model 的業務唯一欄位是 email，
       * 因此 Prisma P2002 在這個 create() 流程中
       * 以 null 回報 Application：
       *
       * 「User 沒有建立成功，因為發生 unique conflict。」
       *
       * 由 Application 決定這個結果的業務意義。
       */
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }

      /**
       * 其他 Infrastructure error：
       *
       * - Database unavailable
       * - Connection failure
       * - Unexpected Prisma error
       * - PostgreSQL error
       *
       * Repository 不猜測、不包裝成 AppError，
       * 直接保留原始 Error 往上拋。
       *
       * 最後會由 Express Global Error Handler
       * 記錄完整 stack trace 並回傳 HTTP 500。
       */
      throw error;
    }
  }
}
