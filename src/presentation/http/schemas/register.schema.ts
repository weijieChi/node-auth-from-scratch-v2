import { Buffer } from 'node:buffer';

import { z } from 'zod';

import { emailSchema } from '../../../domain/value-objects/email.js';

/**
 * Register HTTP Request Schema。
 *
 * Presentation Layer 負責驗證 HTTP Boundary 傳進來的資料：
 *
 * {
 *   email: string,
 *   password: string
 * }
 *
 * 驗證通過之後，Controller 才會把資料交給 Use Case。
 */

/**
 * RegisterUserUseCase 目前要求至少 12 個 characters。
 *
 * HTTP 層也做相同檢查，
 * 讓錯誤可以直接回傳 400 Bad Request，
 * 而不是讓無效資料繼續進入 Application Layer。
 */
const MIN_PASSWORD_LENGTH = 12;

/**
 * bcrypt 最多處理前 72 bytes。
 *
 * 注意：
 *
 * 72 bytes !== 72 characters
 *
 * 例如 UTF-8 中文字通常會占多個 bytes。
 *
 * BcryptPasswordHasher 本身仍然保留 truncation 防護，
 * 這裡則負責提供較好的 HTTP validation response。
 */
const MAX_BCRYPT_PASSWORD_BYTES = 72;

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must contain at least ${MIN_PASSWORD_LENGTH} characters`)
  .refine((password) => Buffer.byteLength(password, 'utf8') <= MAX_BCRYPT_PASSWORD_BYTES, {
    message: `Password must not exceed ${MAX_BCRYPT_PASSWORD_BYTES} UTF-8 bytes`,
  });

/**
 * emailSchema 直接重用 Domain 目前使用的 Zod Schema。
 *
 * 因此：
 *
 * HTTP validation
 * Domain Email Value Object
 *
 * 不會各自維護不同的 Email regex / validation rule。
 *
 * emailSchema 同時會：
 *
 * - trim
 * - lowercase
 * - email validation
 */
export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Controller 可以直接使用 Zod 推導出的 TypeScript Type，
 * 不需要再手動寫另一份：
 *
 * interface RegisterRequest { ... }
 */
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
