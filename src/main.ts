import { createApp } from './bootstrap/create-app.js';
import { shutdown } from './bootstrap/shutdown.js';
import { env } from './config/env.js';
import { logger } from './observability/logger.js';
import { createContainer } from './bootstrap/container.js';

const container = createContainer();

const app = createApp({
  authRouter: container.authRouter,
});

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info('HTTP server started', {
    environment: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
  });
});

/**
 * 防止 SIGINT / SIGTERM 或 Fatal Error
 * 同時重複執行 Shutdown。
 */
let isShuttingDown = false;

async function handleShutdown(reason: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  await shutdown({
    server,
    reason,
    exitCode,
  });
}

/**
 * Ctrl+C
 */
process.once('SIGINT', () => {
  void handleShutdown('SIGINT');
});

/**
 * Docker / Cloud Run / Linux Service
 * 常用 SIGTERM 要求 Application 結束。
 */
process.once('SIGTERM', () => {
  void handleShutdown('SIGTERM');
});

/**
 * HTTP Server 自身發生錯誤。
 */
server.on('error', (error) => {
  logger.error('HTTP server error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  });

  void handleShutdown('HTTP_SERVER_ERROR', 1);
});

/**
 * 未被任何 Promise chain 處理的 rejection。
 *
 * Express Request handler 裡的 rejected Promise
 * 正常情況下會由 Express 5 Global Error Handler 接住，
 * 不應該跑到這裡。
 *
 * 這裡處理的是 Express lifecycle 外的 Fatal Error。
 */
process.once('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason:
      reason instanceof Error
        ? {
            name: reason.name,
            message: reason.message,
            stack: reason.stack,
          }
        : reason,
  });

  void handleShutdown('UNHANDLED_REJECTION', 1);
});

/**
 * 完全沒有被捕捉的同步 Exception。
 *
 * Process 狀態可能已不可靠，因此記錄後關閉 Application。
 */
process.once('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  });

  void handleShutdown('UNCAUGHT_EXCEPTION', 1);
});
