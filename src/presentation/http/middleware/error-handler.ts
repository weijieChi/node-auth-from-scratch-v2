import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { logger } from '../../../observability/logger.js';

/**
 * 404 Handler
 *
 * 能走到這裡代表：
 *
 * 前面的所有 Route 都沒有處理這個 Request。
 *
 * 404 本身不是 Application Crash，
 * 因此不需要 throw Error。
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      path: req.originalUrl,
    },
  });
};

/**
 * Global Express Error Handler
 *
 * Express Error Middleware 必須有四個參數：
 *
 *   error
 *   req
 *   res
 *   next
 *
 * 即使目前沒有直接使用 next，
 * Express 仍然靠這個函式 signature 判斷
 * 它是一個 Error Middleware。
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  /**
   * 如果 Response Header 已經送出去，
   * 我們不能重新產生另一份 JSON Response。
   *
   * 例如未來處理 Stream 時：
   *
   * Response 已開始傳送
   * → 中途發生 Error
   *
   * 這種情況交回 Express default error handler
   * 處理 connection。
   */
  if (res.headersSent) {
    next(error);
    return;
  }

  /**
   * Unknown Error 統一記錄詳細資訊。
   *
   * Error object 的 name/message/stack 明確展開，
   * 避免 JSON serialization 遺失 Error properties。
   */
  if (error instanceof Error) {
    logger.error('Unhandled HTTP error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      method: req.method,
      path: req.originalUrl,
    });
  } else {
    logger.error('Unhandled non-Error value', {
      error,
      method: req.method,
      path: req.originalUrl,
    });
  }

  /**
   * 不把 Error stack/message 直接回傳 Client。
   *
   * Server 保存詳細 Log，
   * Client 只取得安全、穩定的 Error Contract。
   *
   * 之後 Application Error 建立後，
   * 這裡才會逐步加入：
   *
   * Validation → 400
   * Unauthorized → 401
   * Not Found → 404
   * Conflict → 409
   *
   * 現階段所有未知 Error 統一為 500。
   */
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
  });
}
