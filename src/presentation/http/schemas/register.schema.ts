import { Buffer } from 'node:buffer';

import { z } from 'zod';

import { emailSchema } from '../../../domain/value-objects/email.js';

/**
 * Register HTTP Request Schema。
 *
 * Presentation Layer 只負責 HTTP Boundary
 * 可以直接驗證的 request contract。
 *
 * Password 最低長度屬於 Application business rule，
 * 由 RegisterUserUseCase 統一處理。
 */
const MAX_BCRYPT_PASSWORD_BYTES = 72;

/**
 * bcrypt 最多只會處理前 72 bytes。
 *
 * 注意：
 *
 * 72 bytes 不等於 72 characters。
 *
 * UTF-8 中文、Emoji 等字元可能占用多個 bytes。
 *
 * 這裡先在 HTTP Boundary 阻止會被 bcrypt truncate 的輸入，
 * BcryptPasswordHasher 本身仍保留最後一道防護。
 */
const passwordSchema = z
  .string()
  .refine((password) => Buffer.byteLength(password, 'utf8') <= MAX_BCRYPT_PASSWORD_BYTES, {
    message: `Password must not exceed ${MAX_BCRYPT_PASSWORD_BYTES} UTF-8 bytes`,
  });

/**
 * POST /auth/register HTTP Request contract。
 *
 * emailSchema 負責：
 *
 * - trim
 * - lowercase
 * - Email format validation
 *
 * Password 最低長度則會在 RegisterUserUseCase 檢查。
 */
export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
