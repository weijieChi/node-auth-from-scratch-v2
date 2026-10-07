import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '../../../config/env.js';
import { PrismaClient } from '../../../generated/prisma/client.js';

/**
 * Prisma ORM 7 使用 Driver Adapter。
 *
 * PrismaClient
 *     ↓
 * PrismaPg
 *     ↓
 * node-postgres (pg)
 *     ↓
 * PostgreSQL
 */
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

export const prisma = new PrismaClient({
  adapter,
});
