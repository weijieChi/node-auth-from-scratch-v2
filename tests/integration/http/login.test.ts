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
 * POST /auth/login 成功 Response。
 *
 * Step 15 OpenAPI 前，
 * Test 自己使用 Zod 安全解析 Supertest response.body。
 */
const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
});

/**
 * GET /auth/me 成功 Response。
 */
const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    status: z.literal('ACTIVE'),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

describe('Login and access token HTTP flow', () => {
  /**
   * 使用真正 Production DI：
   *
   * PrismaUserRepository
   * BcryptPasswordHasher
   * JoseAccessTokenService
   * LoginUserUseCase
   * GetCurrentUserUseCase
   * Authentication Middleware
   * Controllers
   */
  const container = createContainer();

  const app = createApp({
    authRouter: container.authRouter,
  });

  /**
   * 只刪除這個 Test File
   * 自己建立的 User。
   */
  const createdEmails: string[] = [];

  beforeAll(() => {
    /**
     * 防止 Integration Test
     * 誤寫 development / production database。
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

  /**
   * Login Test Helper。
   *
   * 直接透過 Prisma 建立 User，
   * 避免每個 Login Test 都需要先呼叫 Register API。
   *
   * 這樣 Login Test 失敗時，
   * 比較容易確認問題真的出在 Login flow。
   */
  async function createLocalUser(
    options: {
      password?: string;
      status?: 'ACTIVE' | 'DISABLED';
    } = {},
  ): Promise<{
    id: string;
    email: string;
    password: string;
  }> {
    const email = `login-${randomUUID()}@example.test`;

    const password = options.password ?? 'correct-password';

    /**
     * 測試只需要有效 bcrypt hash。
     *
     * cost 4 可以讓 Integration Test
     * 比 production cost 12 快很多。
     */
    const passwordHash = await bcrypt.hash(password, 4);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        status: options.status ?? 'ACTIVE',
      },
    });

    createdEmails.push(email);

    return {
      id: user.id,
      email,
      password,
    };
  }

  it('logs in with a local password and returns an access token', async () => {
    const user = await createLocalUser();

    const response = await request(app).post('/auth/login').send({
      email: user.email,
      password: user.password,
    });

    expect(response.status).toBe(200);

    const responseBody: unknown = response.body;

    const body = loginResponseSchema.parse(responseBody);

    expect(body.accessToken).toEqual(expect.any(String));

    expect(body.tokenType).toBe('Bearer');
  });

  it('returns 401 when the password is incorrect', async () => {
    const user = await createLocalUser();

    const response = await request(app).post('/auth/login').send({
      email: user.email,
      password: 'wrong-password',
    });

    expect(response.status).toBe(401);

    const body: unknown = response.body;

    expect(body).toEqual({
      error: {
        message: 'Invalid email or password',
      },
    });
  });

  it('returns the same 401 response when the email does not exist', async () => {
    /**
     * 不存在 Email 和 Password 錯誤
     * 使用相同 Response。
     *
     * 避免 account enumeration。
     */
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: `missing-${randomUUID()}@example.test`,
        password: 'correct-password',
      });

    expect(response.status).toBe(401);

    const body: unknown = response.body;

    expect(body).toEqual({
      error: {
        message: 'Invalid email or password',
      },
    });
  });

  it('returns 400 when the login request is invalid', async () => {
    const response = await request(app).post('/auth/login').send({
      email: 'not-an-email',
      password: '',
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

  it('returns 403 when the account is disabled', async () => {
    const user = await createLocalUser({
      status: 'DISABLED',
    });

    const response = await request(app).post('/auth/login').send({
      email: user.email,
      password: user.password,
    });

    expect(response.status).toBe(403);

    const body: unknown = response.body;

    expect(body).toEqual({
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'Account is disabled',
      },
    });
  });

  it('uses the access token to get the current user', async () => {
    const user = await createLocalUser();

    /**
     * Step 1：
     * Login 取得 Access Token。
     */
    const loginResponse = await request(app).post('/auth/login').send({
      email: user.email,
      password: user.password,
    });

    expect(loginResponse.status).toBe(200);

    const loginBody = loginResponseSchema.parse(loginResponse.body as unknown);

    /**
     * Step 2：
     *
     * Authorization:
     * Bearer <access-token>
     */
    const meResponse = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginBody.accessToken}`);

    expect(meResponse.status).toBe(200);

    const meBody = meResponseSchema.parse(meResponse.body as unknown);

    expect(meBody.user.id).toBe(user.id);

    expect(meBody.user.email).toBe(user.email);

    expect(meBody.user.status).toBe('ACTIVE');
  });

  it('returns 401 when the access token is missing', async () => {
    const response = await request(app).get('/auth/me');

    expect(response.status).toBe(401);

    expect(response.body as unknown).toEqual({
      error: {
        message: 'Authentication required',
      },
    });
  });

  it('returns 401 when the access token is invalid', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);

    expect(response.body as unknown).toEqual({
      error: {
        message: 'Invalid or expired access token',
      },
    });
  });
});
