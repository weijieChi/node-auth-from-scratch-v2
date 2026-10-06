// Graceful Shutdown

import type { Server } from 'node:http';

import { logger } from '../observability/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * 停止 HTTP Server。
 *
 * 正常流程：
 *
 * SIGTERM / SIGINT
 *      ↓
 * server.close()
 *      ↓
 * 不再接受新 Connection
 *      ↓
 * 等待目前 Request 完成
 *      ↓
 * Server Closed
 *
 * 如果超過 10 秒仍無法結束，
 * 才強制關閉所有 HTTP connections。
 */
async function closeHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      logger.warn('Graceful shutdown timed out, forcing HTTP connections to close', {
        timeoutMs: SHUTDOWN_TIMEOUT_MS,
      });

      server.closeAllConnections();
    }, SHUTDOWN_TIMEOUT_MS);

    /**
     * Timer 本身不應該阻止 Node.js process 結束。
     */
    timeout.unref();

    server.close((error) => {
      clearTimeout(timeout);

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Flush Winston Logger。
 *
 * Winston Logger 本身是一個 Node.js stream。
 *
 * logger.end()
 *      ↓
 * 等待所有 queued logs 寫入 transports
 *      ↓
 * emit "finish"
 */
async function flushLogger(): Promise<void> {
  await new Promise<void>((resolve) => {
    logger.once('finish', resolve);
    logger.end();
  });
}

interface ShutdownOptions {
  server: Server;
  reason: string;
  exitCode?: number;
}

/**
 * Application Graceful Shutdown。
 *
 * 未來加入：
 *
 * Prisma
 * Redis
 * Queue
 *
 * 時，就繼續把關閉流程集中放在這裡。
 */
export async function shutdown({ server, reason, exitCode = 0 }: ShutdownOptions): Promise<void> {
  let finalExitCode = exitCode;

  logger.info('Application shutdown started', {
    reason,
  });

  try {
    await closeHttpServer(server);

    logger.info('HTTP server closed');
  } catch (error) {
    finalExitCode = 1;

    logger.error('Failed to close HTTP server cleanly', {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    });
  }

  await flushLogger();

  /**
   * 不直接 process.exit()。
   *
   * 設定 exitCode 後，
   * 讓 Node.js 自己在 event loop 清空後正常結束。
   */
  process.exitCode = finalExitCode;
}
