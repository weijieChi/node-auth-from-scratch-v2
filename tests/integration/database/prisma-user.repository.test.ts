import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EmailAlreadyInUseError } from '../../../src/application/errors/email-already-in-use-error.js';
import { env } from '../../../src/config/env.js';
import { Email } from '../../../src/domain/value-objects/email.js';
import { prisma } from '../../../src/infrastructure/database/prisma/prisma-client.js';
import { PrismaUserRepository } from '../../../src/infrastructure/database/prisma/prisma-user.repository.js';

/**
 * PrismaUserRepository Integration Test。
 *
 * 這不是 Unit Test。
 *
 * 測試路徑：
 *
 * PrismaUserRepository
 *        ↓
 * Prisma Client
 *        ↓
 * @prisma/adapter-pg
 *        ↓
 * PostgreSQL auth_test
 *
 * 會真的 INSERT / SELECT / DELETE Database。
 */
describe('PrismaUserRepository', () => {
  const repository = new PrismaUserRepository(prisma);

  /**
   * 記錄這個 Test File 建立過的 User ID。
   *
   * afterAll() 只清除自己的資料，
   * 不使用：
   *
   *   DELETE FROM users
   *
   * 避免誤刪其他 Integration Test 的資料。
   */
  const createdUserIds: string[] = [];

  /**
   * Database Integration Test 啟動前的安全檢查。
   *
   * 因為這組測試具有寫入與刪除 Database 的能力，
   * 所以明確要求 DB 名稱必須是：
   *
   *   auth_test
   *
   * 如果 DATABASE_URL 不小心指向其他 Database，
   * 直接停止測試。
   */
  beforeAll(() => {
    const databaseUrl = new URL(env.DATABASE_URL);

    const databaseName = databaseUrl.pathname.replace(/^\//, '');

    if (databaseName !== 'auth_test') {
      throw new Error(`Refusing to run database integration tests against "${databaseName}"`);
    }
  });

  /**
   * 測試完成後清除自己建立的資料，
   * 最後關閉 Prisma Connection Pool。
   */
  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: createdUserIds,
          },
        },
      });
    }

    await prisma.$disconnect();
  });

  it('creates a local user with a password hash', async () => {
    /**
     * Arrange
     */
    const email = Email.create(`create-${randomUUID()}@example.test`);

    /**
     * 這裡故意使用假的 hash。
     *
     * 因為這個 Test 測的是：
     *
     * PrismaUserRepository
     *
     * 不是：
     *
     * BcryptPasswordHasher
     */
    const passwordHash = 'test-password-hash';

    /**
     * Act
     */
    const user = await repository.create({
      email,
      passwordHash,
    });

    createdUserIds.push(user.id);

    /**
     * Assert Domain Result
     */
    expect(user.id).toEqual(expect.any(String));

    expect(user.email.value).toBe(email.value);

    expect(user.status).toBe('ACTIVE');

    /**
     * 直接透過 Prisma 查 Database，
     * 確認 Repository 真的把 passwordHash
     * 寫進 users table。
     */
    const persistedUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
    });

    expect(persistedUser).not.toBeNull();

    expect(persistedUser?.email).toBe(email.value);

    expect(persistedUser?.passwordHash).toBe(passwordHash);

    expect(persistedUser?.status).toBe('ACTIVE');
  });

  it('finds a user by email', async () => {
    /**
     * Arrange
     */
    const email = Email.create(`lookup-${randomUUID()}@example.test`);

    const createdUser = await repository.create({
      email,
      passwordHash: 'lookup-test-password-hash',
    });

    createdUserIds.push(createdUser.id);

    /**
     * Act
     */
    const foundUser = await repository.findByEmail(email);

    /**
     * Assert
     */
    expect(foundUser).not.toBeNull();

    expect(foundUser?.id).toBe(createdUser.id);

    expect(foundUser?.email.value).toBe(email.value);

    expect(foundUser?.status).toBe('ACTIVE');
  });

  it('returns null when the email does not exist', async () => {
    /**
     * 這個 Email 不會被 INSERT。
     */
    const email = Email.create(`missing-${randomUUID()}@example.test`);

    const foundUser = await repository.findByEmail(email);

    expect(foundUser).toBeNull();
  });

  it('translates duplicate email violations into EmailAlreadyInUseError', async () => {
    /**
     * Arrange
     */
    const email = Email.create(`duplicate-${randomUUID()}@example.test`);

    const firstUser = await repository.create({
      email,
      passwordHash: 'first-test-password-hash',
    });

    createdUserIds.push(firstUser.id);

    /**
     * Act + Assert
     *
     * 直接呼叫 Repository.create() 第二次，
     * 刻意略過 RegisterUserUseCase.findByEmail()。
     *
     * 目的就是驗證 Database 最後一道防線：
     *
     * users.email UNIQUE
     *       ↓
     * Prisma P2002
     *       ↓
     * EmailAlreadyInUseError
     */
    await expect(
      repository.create({
        email,
        passwordHash: 'second-test-password-hash',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });
});
