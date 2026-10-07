import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { EmailAlreadyInUseError } from '../../../application/errors/email-already-in-use-error.js';
import { logger } from '../../../observability/logger.js';

/**
 * 沒有任何 Route 匹配時，
 * 回傳統一 JSON 404 Response。
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
 * Express 5 可以把 async route/controller
 * rejected Promise 自動傳到這裡。
 *
 * 因此一般 Controller 不需要大量：
 *
 * try {
 * } catch {
 *   next(error);
 * }
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  /**
   * Response Header 已經送出時，
   * 交回 Express 預設 Error Handler。
   */
  if (res.headersSent) {
    next(error);

    return;
  }

  /**
   * Application Error
   *       ↓
   * HTTP Error
   *
   * Email 重複屬於正常 Business Conflict，
   * 不是 Server Failure，
   * 因此不記成 logger.error。
   */
  if (error instanceof EmailAlreadyInUseError) {
    res.status(409).json({
      error: {
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'Email address is already in use',
      },
    });

    return;
  }

  /**
   * 其餘未知錯誤才當成 Server Error。
   *
   * Stack Trace 只寫 Log，
   * 不回傳給 Client。
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

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
  });
}
