import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  HOST: z.string().min(1).default('0.0.0.0'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) => {
        try {
          const url = new URL(value);

          return url.protocol === 'postgresql:' || url.protocol === 'postgres:';
        } catch {
          return false;
        }
      },
      {
        message: 'DATABASE_URL must be a valid PostgreSQL URL',
      },
    ),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);

  process.exit(1);
}

export const env = Object.freeze(result.data);
