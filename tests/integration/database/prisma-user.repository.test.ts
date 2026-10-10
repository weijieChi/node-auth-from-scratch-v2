import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
 * 這些測試會真的：
 *
 * - INSERT
 * - SELECT
 * - DELETE
 *
 * PostgreSQL 資料。
 *
 * 主要驗證 Repository 是否正確處理：
 *
 * 1. 建立 User
 * 2. 讀取 User
 * 3. 查不到資料時回傳 null
 * 4. Database unique constraint conflict 時回傳 null
 *
 * Repository 不負責：
 *
 * - HTTP status
 * - AppError
 * - Business error message
 *
 * 這些應由 Application Layer 決定。
 */
describe('PrismaUserRepository', () => {
  const repository = new PrismaUserRepository(prisma);

  /**
   * 記錄這個 Test File 建立過的 User ID。
   *
   * afterAll() 只清除自己建立的資料，
   * 不直接執行：
   *
   *   DELETE FROM users
   *
   * 避免誤刪其他 Integration Test
   * 或開發期間存在的測試資料。
   */
  const createdUserIds: string[] = [];

  /**
   * Database Integration Test 啟動前的安全檢查。
   *
   * 因為這組測試具有：
   *
   * - 寫入 Database
   * - 刪除 Database 資料
   *
   * 的能力，所以明確要求 Database 名稱必須是：
   *
   *   auth_test
   *
   * 如果 DATABASE_URL 不小心指向：
   *
   * - auth_dev
   * - production
   * - 其他 Database
   *
   * 就立即停止測試。
   */
  beforeAll(() => {
    const databaseUrl = new URL(env.DATABASE_URL);

    const databaseName = databaseUrl.pathname.replace(/^\//, '');

    if (databaseName !== 'auth_test') {
      throw new Error(`Refusing to run database integration tests against "${databaseName}"`);
    }
  });

  /**
   * 所有測試完成後：
   *
   * 1. 只刪除這個 Test File 建立的 User
   * 2. 關閉 Prisma Connection Pool
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
     *
     * 每次 Test 使用隨機 Email，
     * 避免不同測試執行之間互相衝突。
     */
    const email = Email.create(`create-${randomUUID()}@example.test`);

    /**
     * 這裡故意使用假的 password hash。
     *
     * 因為這個 Test 測的是：
     *
     * PrismaUserRepository
     *
     * 而不是：
     *
     * BcryptPasswordHasher
     *
     * bcrypt 是否真的可以正確 hash password，
     * 已經由 BcryptPasswordHasher Unit Test 負責。
     */
    const passwordHash = 'test-password-hash';

    /**
     * Act
     */
    const user = await repository.create({
      email,
      passwordHash,
    });

    /**
     * create() 現在的 Repository Contract 是：
     *
     * User
     * → 建立成功
     *
     * null
     * → unique constraint conflict
     *
     * 這個 Test 使用全新的 Email，
     * 所以預期一定建立成功。
     */
    expect(user).not.toBeNull();

    /**
     * TypeScript 不會因為 Vitest 的：
     *
     * expect(user).not.toBeNull()
     *
     * 就自動把後面的型別縮小成 User。
     *
     * 因此這裡再明確做一次 type narrowing。
     */
    if (!user) {
      throw new Error('Expected user creation to succeed');
    }

    /**
     * 記錄建立成功的 User ID，
     * afterAll() 才知道最後需要清除哪些資料。
     */
    createdUserIds.push(user.id);

    /**
     * Assert Domain Result
     *
     * Repository 回傳的是 Domain User，
     * 而不是 Prisma persistence object。
     */
    expect(user.id).toEqual(expect.any(String));

    expect(user.email.value).toBe(email.value);

    expect(user.status).toBe('ACTIVE');

    /**
     * 直接透過 Prisma 查 Database。
     *
     * 這裡不是透過 Repository 再查一次，
     * 因為我們要確認 Repository.create()
     * 真的有把資料正確寫進 PostgreSQL。
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
     *
     * 先建立一個 User，
     * 再用相同 Email 測試 findByEmail()。
     */
    const email = Email.create(`lookup-${randomUUID()}@example.test`);

    const createdUser = await repository.create({
      email,
      passwordHash: 'lookup-test-password-hash',
    });

    /**
     * 使用新 Email，
     * 所以建立應該成功。
     */
    expect(createdUser).not.toBeNull();

    if (!createdUser) {
      throw new Error('Expected test user creation to succeed');
    }

    createdUserIds.push(createdUser.id);

    /**
     * Act
     */
    const foundUser = await repository.findByEmail(email);

    /**
     * Assert
     *
     * findByEmail()：
     *
     * User
     * → 有找到資料
     *
     * null
     * → Query 正常完成但不存在
     */
    expect(foundUser).not.toBeNull();

    expect(foundUser?.id).toBe(createdUser.id);

    expect(foundUser?.email.value).toBe(email.value);

    expect(foundUser?.status).toBe('ACTIVE');
  });

  it('returns null when the email does not exist', async () => {
    /**
     * Arrange
     *
     * 這個 Email 不會被 INSERT。
     */
    const email = Email.create(`missing-${randomUUID()}@example.test`);

    /**
     * Act
     */
    const foundUser = await repository.findByEmail(email);

    /**
     * Assert
     *
     * null 的意思非常明確：
     *
     * Database Query 正常執行，
     * 但不存在符合條件的 User。
     *
     * 如果是：
     *
     * - PostgreSQL unavailable
     * - Connection failure
     * - Prisma unexpected error
     *
     * Repository 不應該回 null，
     * 而應該讓原始 Error 往上 throw。
     */
    expect(foundUser).toBeNull();
  });

  it('returns null when a duplicate email violates the unique constraint', async () => {
    /**
     * Arrange
     *
     * 建立一個新的 Email。
     */
    const email = Email.create(`duplicate-${randomUUID()}@example.test`);

    /**
     * 第一次建立應該成功。
     */
    const firstUser = await repository.create({
      email,
      passwordHash: 'first-test-password-hash',
    });

    expect(firstUser).not.toBeNull();

    if (!firstUser) {
      throw new Error('Expected first user creation to succeed');
    }

    createdUserIds.push(firstUser.id);

    /**
     * Act + Assert
     *
     * 直接第二次呼叫 Repository.create()，
     * 使用完全相同的 Email。
     *
     * 這裡刻意不經過：
     *
     * RegisterUserUseCase.findByEmail()
     *
     * 因為這個 Test 要驗證的是
     * Database 最後一道一致性保護。
     *
     * 流程：
     *
     * 第二次 INSERT 相同 Email
     *          ↓
     * PostgreSQL UNIQUE constraint
     *          ↓
     * Prisma P2002
     *          ↓
     * PrismaUserRepository
     *          ↓
     * return null
     *
     * Repository 只表達：
     *
     * 「User 沒有建立成功，
     *   因為發生已知的 unique conflict。」
     *
     * Repository 不決定：
     *
     * - AppError
     * - HTTP 409
     * - EMAIL_ALREADY_IN_USE
     *
     * 這些業務與 HTTP 語意
     * 由 Application Layer 負責。
     */
    await expect(
      repository.create({
        email,
        passwordHash: 'another-password-hash',
      }),
    ).resolves.toBeNull();

    /**
     * 再直接查 Database，
     * 確認 duplicate INSERT 並沒有額外建立 User。
     */
    const persistedUsers = await prisma.user.findMany({
      where: {
        email: email.value,
      },
    });

    expect(persistedUsers).toHaveLength(1);

    expect(persistedUsers[0]?.id).toBe(firstUser.id);

    expect(persistedUsers[0]?.passwordHash).toBe('first-test-password-hash');
  });

  it('finds a user by id', async () => {
    const email = Email.create(`find-by-id-${randomUUID()}@example.test`);

    const createdUser = await repository.create({
      email,
      passwordHash: 'find-by-id-password-hash',
    });

    expect(createdUser).not.toBeNull();

    if (!createdUser) {
      throw new Error('Expected user creation to succeed');
    }

    createdUserIds.push(createdUser.id);

    /**
     * Access Token 的 sub 會保存 User ID。
     *
     * GET /auth/me 最後就是透過這個 ID
     * 查詢目前 User。
     */
    const foundUser = await repository.findById(createdUser.id);

    expect(foundUser).not.toBeNull();

    expect(foundUser?.id).toBe(createdUser.id);

    expect(foundUser?.email.value).toBe(email.value);
  });

  it('returns local authentication data by email', async () => {
    const email = Email.create(`local-auth-${randomUUID()}@example.test`);

    const passwordHash = 'stored-local-password-hash';

    const createdUser = await repository.create({
      email,
      passwordHash,
    });

    expect(createdUser).not.toBeNull();

    if (!createdUser) {
      throw new Error('Expected user creation to succeed');
    }

    createdUserIds.push(createdUser.id);

    /**
     * Login 和一般 User Query 不同。
     *
     * Login 還需要 Persistence 中的：
     *
     * passwordHash
     *
     * 但 passwordHash 不放進 Domain User Entity。
     */
    const authUser = await repository.findLocalAuthByEmail(email);

    expect(authUser).not.toBeNull();

    expect(authUser?.user.id).toBe(createdUser.id);

    expect(authUser?.user.email.value).toBe(email.value);

    expect(authUser?.passwordHash).toBe(passwordHash);
  });
});
