import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { env } from '../config/env.js';

const { colorize, combine, errors, json, printf, timestamp } = format;

/**
 * 將 Date 轉成帶有本機 UTC offset 的 ISO 8601 字串。
 *
 * 例如台灣 UTC+8：
 *
 *   2026-10-06T02:35:12.345+08:00
 *
 * 而不是 UTC：
 *
 *   2026-10-05T18:35:12.345Z
 *
 * Date#getTimezoneOffset() 的正負號和 ISO offset 剛好相反，
 * 所以這裡需要取負值。
 */
function toLocalIsoString(date = new Date()): string {
  const timezoneOffsetMinutes = -date.getTimezoneOffset();

  const sign = timezoneOffsetMinutes >= 0 ? '+' : '-';

  const absoluteOffsetMinutes = Math.abs(timezoneOffsetMinutes);

  const offsetHours = Math.floor(absoluteOffsetMinutes / 60);
  const offsetMinutes = absoluteOffsetMinutes % 60;

  const offset = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(
    2,
    '0',
  )}`;

  /**
   * 先把時間位移成本地時間，
   * 再使用 toISOString() 取得：
   *
   * YYYY-MM-DDTHH:mm:ss.sss
   *
   * 最後自行補上 +08:00 之類的 offset。
   */
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, -1);

  return `${localTime}${offset}`;
}

/**
 * Development Timestamp
 *
 * 使用本機時區，但仍維持完整 ISO 8601。
 */
const developmentTimestamp = timestamp({
  format: () => toLocalIsoString(),
});

/**
 * Production Timestamp
 *
 * Winston / logform 預設就是：
 *
 *   new Date().toISOString()
 *
 * 因此會是 UTC ISO 8601：
 *
 *   2026-10-05T18:35:12.345Z
 */
const productionTimestamp = timestamp();

/**
 * Development Console
 */
const developmentConsoleFormat = combine(
  errors({ stack: true }),
  developmentTimestamp,
  colorize(),
  printf(({ timestamp, level, message, stack, ...metadata }) => {
    const details = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';

    const errorDetails = typeof stack === 'string' ? `\n${stack}` : '';

    return `${String(timestamp)} ${level}: ${String(message)}${details}${errorDetails}`;
  }),
);

/**
 * Development File
 *
 * JSON Lines：
 * 每一行都是獨立的 structured log event。
 *
 * timestamp：
 *
 *   2026-10-06T02:35:12.345+08:00
 */
const developmentStructuredFormat = combine(errors({ stack: true }), developmentTimestamp, json());

/**
 * Production Structured Log
 *
 * timestamp：
 *
 *   2026-10-05T18:35:12.345Z
 */
const productionStructuredFormat = combine(errors({ stack: true }), productionTimestamp, json());

const applicationDailyTransport = new DailyRotateFile({
  dirname: 'logs',
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: env.LOG_LEVEL,
  format: developmentStructuredFormat,
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: false,
});

const errorDailyTransport = new DailyRotateFile({
  dirname: 'logs',
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  format: developmentStructuredFormat,
  maxSize: '20m',
  maxFiles: '30d',
  zippedArchive: false,
});

const securityOnly = format((info) => {
  if (info.category === 'security') {
    return info;
  }

  return false;
});

const securityDailyTransport = new DailyRotateFile({
  dirname: 'logs',
  filename: 'security-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: env.LOG_LEVEL,

  format: combine(securityOnly(), developmentStructuredFormat),

  maxSize: '20m',
  maxFiles: '30d',
  zippedArchive: false,
});

for (const transport of [applicationDailyTransport, errorDailyTransport, securityDailyTransport]) {
  transport.on('error', (error) => {
    console.error('Log file transport error:', error);
  });
}

const developmentTransports = [
  new transports.Console({
    level: env.LOG_LEVEL,
    format: developmentConsoleFormat,
  }),

  applicationDailyTransport,
  errorDailyTransport,
  securityDailyTransport,
];

const productionTransports = [
  new transports.Console({
    level: env.LOG_LEVEL,
    format: productionStructuredFormat,
  }),
];

export const logger = createLogger({
  level: env.LOG_LEVEL,

  transports: env.NODE_ENV === 'development' ? developmentTransports : productionTransports,
});
