import { z } from 'zod';

import { emailSchema } from '../../../domain/value-objects/email.js';

/**
 * Login Request 只驗證 HTTP Input Shape。
 *
 * 注意：
 *
 * Login 不檢查 Registration 的：
 *
 * MIN_PASSWORD_LENGTH = 8
 *
 * 因為 Password Policy 是「建立新 Password」
 * 時使用的規則，不應拿來決定既有 Password
 * 能不能 Login。
 */
export const loginRequestSchema = z.object({
  email: emailSchema,

  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
