import express from 'express';

import { httpLogger } from '../observability/http-logger.js';
import { errorHandler, notFoundHandler } from '../presentation/http/middleware/error-handler.js';
import { healthRouter } from '../presentation/http/routes/health.routes.js';

/**
 * 建立 Express Application。
 *
 * 這個函式只負責組裝 HTTP Application：
 *
 * Middleware
 * Routes
 * 404 Handler
 * Global Error Handler
 *
 * 這裡刻意不呼叫 app.listen()。
 *
 * 好處：
 *
 * Production:
 *   main.ts → createApp() → listen()
 *
 * Step 06 HTTP Test:
 *   Supertest → createApp()
 *
 * 測試不需要真的占用固定 TCP Port。
 */
export function createApp() {
  const app = express();

  /**
   * Express 預設會回傳：
   *
   * X-Powered-By: Express
   *
   * Application 沒有必要主動暴露框架資訊。
   */
  app.disable('x-powered-by');

  /**
   * HTTP Access Log
   *
   * Morgan 產生 HTTP access log，
   * 再送進 Winston。
   */
  app.use(httpLogger);

  /**
   * JSON Request Body Parser
   *
   * Express 5 已內建 JSON parser，
   * 不需要另外安裝 body-parser。
   */
  app.use(
    express.json({
      limit: '1mb',
    }),
  );

  /**
   * Routes
   */
  app.use('/health', healthRouter);

  /**
   * 找不到 Route。
   *
   * 必須放在所有正常 Route 後面。
   */
  app.use(notFoundHandler);

  /**
   * Global Error Handler 必須最後註冊。
   */
  app.use(errorHandler);

  return app;
}
