/**
 * Application 已經理解並可以安全回傳給 Client 的預期錯誤。
 *
 * 例如：
 *
 * - Business rule 不成立
 * - Authentication 失敗
 * - Resource conflict
 * - Resource not found
 *
 * AppError 與未預期的 Infrastructure / Programming Error 不同。
 *
 * AppError：
 *   Application 知道錯誤的業務意義，
 *   也知道 Client 應收到什麼 HTTP status。
 *
 * Unknown Error：
 *   Prisma connection failure、PostgreSQL failure、
 *   programming bug 等未預期錯誤，
 *   不轉成 AppError。
 *
 *   原始 Error 會一路交給 Global Error Handler，
 *   記錄 stack trace 後統一回 HTTP 500。
 *
 * code 是 optional。
 *
 * 只有 Client 需要 machine-readable code
 * 來決定後續行為時才提供。
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
