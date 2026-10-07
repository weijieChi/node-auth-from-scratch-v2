import express, { type Express, type Router } from 'express';

import { httpLogger } from '../observability/http-logger.js';
import { errorHandler, notFoundHandler } from '../presentation/http/middleware/error-handler.js';
import { healthRouter } from '../presentation/http/routes/health.routes.js';

/**
 * createApp() 可以接受已經由 Composition Root
 * 建立完成的 Router。
 *
 * authRouter 設成 optional，
 * 主要是讓既有 Health Test：
 *
 *   createApp()
 *
 * 仍然可以單獨建立最小 Express Application，
 * 不需要為了測 /health 額外連結整套 Auth dependencies。
 */
interface CreateAppOptions {
  authRouter?: Router;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  /**
   * 不暴露 Express framework 資訊。
   */
  app.disable('x-powered-by');

  /**
   * HTTP access log。
   */
  app.use(httpLogger);

  /**
   * JSON Request Body Parser。
   *
   * POST /auth/register
   *
   * 的：
   *
   * {
   *   "email": "...",
   *   "password": "..."
   * }
   *
   * 會在這裡被解析成 req.body。
   */
  app.use(
    express.json({
      limit: '1mb',
    }),
  );

  /**
   * Health Check。
   */
  app.use('/health', healthRouter);

  /**
   * Authentication Routes。
   *
   * Production Application 會從 container 傳進來。
   *
   * Health-only Test 可以不提供。
   */
  if (options.authRouter) {
    app.use('/auth', options.authRouter);
  }

  /**
   * Routes 都沒有匹配到才進 404。
   *
   * Error Handler 一定要放在所有 Routes 後面。
   */
  app.use(notFoundHandler);

  /**
   * Global Error Handler 必須最後註冊。
   */
  app.use(errorHandler);

  return app;
}
