import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '../../../application/errors/app-error.js';
import { logger } from '../../../observability/logger.js';

/**
 * 所有 Route 都沒有匹配時的 HTTP 404。
 *
 * 404 route 本身是 Presentation 層問題，
 * 不需要進 Application AppError。
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found',
    },
  });
};

/**
 * Express Global Error Handler。
 *
 * Express 5 會自動把 async Controller / Middleware
 * rejected Promise 或 thrown error 傳到這裡。
 *
 * 因此一般 request flow 不需要大量 try/catch。
 *
 * Error 分成兩類：
 *
 * AppError
 *   → Application 已預期的錯誤
 *   → 使用指定 HTTP status
 *
 * Unknown Error
 *   → Infrastructure failure、程式 bug、未預期例外
 *   → 記錄完整 error / stack
 *   → Client 統一收到 HTTP 500
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  /**
   * 如果 Response headers 已送出，
   * Express 已無法安全重新產生新的 response。
   *
   * 交回 Express default error handling。
   */
  if (res.headersSent) {
    next(error);

    return;
  }

  /**
   * 預期的 Application Error。
   *
   * code 是 optional：
   *
   * 有些 API error 需要讓 Client 根據 code
   * 做 machine-readable 判斷；
   *
   * 單純只需要 message 的錯誤則不必強迫建立 code。
   */
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        ...(error.code !== undefined ? { code: error.code } : {}),
        message: error.message,
      },
    });

    return;
  }

  /**
   * 所有未預期錯誤統一在這裡記錄。
   *
   * 例如：
   *
   * - PostgreSQL unavailable
   * - Prisma unexpected error
   * - filesystem error
   * - crypto/library error
   * - programming bug
   *
   * Stack trace 只寫入 Server Log，
   * 絕對不回傳給 Client。
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
    /**
     * JavaScript technically 可以：
     *
     * throw 'something'
     * throw 123
     * throw null
     *
     * 雖然專案本身不應這樣做，
     * Global Handler 仍保留最後一道防護。
     */
    logger.error('Unhandled non-Error value', {
      error,
      method: req.method,
      path: req.originalUrl,
    });
  }

  /**
   * 所有未預期錯誤統一在這裡記錄。
   *
   * Infrastructure 不會把未知錯誤包裝成 AppError。
   *
   * 例如：
   *
   * - PostgreSQL unavailable
   * - Prisma unexpected error
   * - filesystem error
   * - crypto/library error
   * - programming bug
   *
   * 因此這裡可以保留原始 Error stack，
   * Server 記錄詳細錯誤，
   * Client 則只收到安全的 HTTP 500 response。
   */
  res.status(500).json({
    error: {
      message: 'Internal server error',
    },
  });
}
