import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '../../../src/bootstrap/create-app.js';
import { createContainer } from '../../../src/bootstrap/container.js';
import { env } from '../../../src/config/env.js';
import { prisma } from '../../../src/infrastructure/database/prisma/prisma-client.js';

/**
 * Register 成功 Response Schema。
 *
 * 這只是 Test 用來安全讀取 response.body，
 * 避免 Supertest 的 response.body = any
 * 觸發 type-aware ESLint unsafe rules。
 *
 * 正式 Response Schema 等 Step 15 OpenAPI
 * 再統一建立。
 */
const registerResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    status: z.literal('ACTIVE'),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

describe('POST /auth/register', () => {
  /**
   * 使用真正的 Production DI Composition：
   *
   * PrismaUserRepository
   * BcryptPasswordHasher
   * RegisterUserUseCase
   * RegisterController
   * AuthRouter
   */
  const container = createContainer();

  const app = createApp({
    authRouter: container.authRouter,
  });

  /**
   * 記錄這組 HTTP Integration Tests
   * 建立的 Email。
   *
   * Test 完成後只刪除自己的資料。
   */
  const createdEmails: string[] = [];

  beforeAll(() => {
    /**
     * 防止 Integration Test
     * 不小心寫入非測試 Database。
     */
    const databaseUrl = new URL(env.DATABASE_URL);

    const databaseName = databaseUrl.pathname.replace(/^\//, '');

    if (databaseName !== 'auth_test') {
      throw new Error(`Refusing to run HTTP integration tests against "${databaseName}"`);
    }
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: createdEmails,
          },
        },
      });
    }

    await prisma.$disconnect();
  });

  it('registers a local user', async () => {
    /**
     * Arrange
     */
    const email = `http-${randomUUID()}@example.test`;

    const password = 'correct-horse-battery-staple';

    createdEmails.push(email);

    /**
     * Act
     */
    const response = await request(app).post('/auth/register').send({
      email,
      password,
    });

    /**
     * Assert HTTP
     */
    expect(response.status).toBe(201);

    /**
     * Supertest response.body 是 any，
     * 先轉成 unknown 再交給 Zod。
     */
    const responseBody: unknown = response.body;

    const body = registerResponseSchema.parse(responseBody);

    expect(body.user.email).toBe(email);

    expect(body.user.status).toBe('ACTIVE');

    /**
     * Response 不應該洩漏 password。
     */
    expect(responseBody).not.toEqual(
      expect.objectContaining({
        password,
      }),
    );

    /**
     * 直接查 Database，
     * 確認 HTTP Request 最後真的寫入 PostgreSQL。
     */
    const persistedUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    expect(persistedUser).not.toBeNull();

    expect(persistedUser?.passwordHash).not.toBeNull();

    /**
     * 確認 Database 裡存的是有效 bcrypt hash，
     * 而不是 raw password。
     */
    await expect(bcrypt.compare(password, persistedUser?.passwordHash ?? '')).resolves.toBe(true);
  });

  it('normalizes the email before registration', async () => {
    const suffix = randomUUID();

    const normalizedEmail = `normalized-${suffix}@example.test`;

    createdEmails.push(normalizedEmail);

    const response = await request(app)
      .post('/auth/register')
      .send({
        email: `  NORMALIZED-${suffix}@EXAMPLE.TEST  `,
        password: 'correct-horse-battery-staple',
      });

    expect(response.status).toBe(201);

    const responseBody: unknown = response.body;

    const body = registerResponseSchema.parse(responseBody);

    expect(body.user.email).toBe(normalizedEmail);

    const persistedUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    expect(persistedUser).not.toBeNull();
  });

  it('returns 400 when the request is invalid', async () => {
    const response = await request(app).post('/auth/register').send({
      email: 'not-an-email',
      password: 'short',
    });

    expect(response.status).toBe(400);

    const body: unknown = response.body;

    expect(body).toMatchObject({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request validation failed',
      },
    });
  });

  it('returns 409 when the email is already registered', async () => {
    const suffix = randomUUID();

    const email = `duplicate-http-${suffix}@example.test`;

    createdEmails.push(email);

    /**
     * 第一次註冊成功。
     */
    const firstResponse = await request(app).post('/auth/register').send({
      email,
      password: 'first-valid-password-123',
    });

    expect(firstResponse.status).toBe(201);

    /**
     * 第二次故意使用不同大小寫與 whitespace。
     *
     * Zod normalization 後仍然會變成同一個 Email。
     */
    const secondResponse = await request(app)
      .post('/auth/register')
      .send({
        email: `  DUPLICATE-HTTP-${suffix}@EXAMPLE.TEST  `,
        password: 'second-valid-password-123',
      });

    expect(secondResponse.status).toBe(409);

    const body: unknown = secondResponse.body;

    expect(body).toEqual({
      error: {
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'Email address is already in use',
      },
    });
  });
});
