import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../../../src/config/env.js';
import { prisma } from '../../../src/infrastructure/database/prisma/prisma-client.js';

describe('Prisma PostgreSQL integration', () => {
  /**
   * Integration Test 有資料寫入能力。
   *
   * 先確認真的指向 auth_test，
   * 避免設定錯誤時不小心把測試資料寫進其他 DB。
   */
  beforeAll(() => {
    const databaseUrl = new URL(env.DATABASE_URL);
    const databaseName = databaseUrl.pathname.replace(/^\//, '');

    if (databaseName !== 'auth_test') {
      throw new Error(`Refusing to run database integration tests against "${databaseName}"`);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates and reads a user from PostgreSQL', async () => {
    const email = `prisma-${randomUUID()}@example.test`;

    const createdUser = await prisma.user.create({
      data: {
        email,
      },
    });

    try {
      const foundUser = await prisma.user.findUnique({
        where: {
          id: createdUser.id,
        },
      });

      expect(createdUser.id).toEqual(expect.any(String));
      expect(createdUser.email).toBe(email);
      expect(createdUser.status).toBe('ACTIVE');

      expect(foundUser).not.toBeNull();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.email).toBe(email);
      expect(foundUser?.status).toBe('ACTIVE');
    } finally {
      /**
       * Assertion 就算失敗，也盡可能把自己的 Test Data 清掉。
       */
      await prisma.user.delete({
        where: {
          id: createdUser.id,
        },
      });
    }
  });
});
