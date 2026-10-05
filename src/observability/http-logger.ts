import morgan from 'morgan';

import { logger } from './logger.js';

/**
 * Morgan HTTP Access Logger
 *
 * Morgan 負責產生 HTTP request/response access log，
 * 最後不直接 console.log，
 * 而是送進 Winston。
 *
 * 因此 HTTP Log 最終也會進入：
 *
 * Development:
 *   Console
 *   application-YYYY-MM-DD.log
 *
 * Production:
 *   JSON stdout/stderr
 */
export const httpLogger = morgan(':method :url :status :response-time ms', {
  stream: {
    write(message) {
      logger.http(message.trim());
    },
  },
});
