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
/**
 * 所有 Log 都先加入 timestamp。
 *
 * Winston 的 timestamp() 預設使用 ISO 8601 UTC：
 *
 *   2026-10-05T13:30:15.123Z
 *
 * ISO 時間除了標準化，也適合依字串排序。
 */
/**
 * Development Console Format
 *
 * Console 是給開發者直接看的，因此以可閱讀性為主。
 *
 * File / Production 則使用 JSON。
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
 * Structured Log Format
 *
 * 檔案與 Production Console 都使用 JSON。
 *
 * 每一行都是一個獨立 Log Event。
 */

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

/**
 * Development：
 *
 * application-YYYY-MM-DD.log
 *
 * 這個檔案保存「所有」符合 LOG_LEVEL 的 Log。
 *
 * 例如 LOG_LEVEL=debug：
 *
 * error
 * warn
 * info
 * http
 * verbose
 * debug
 *
 * 都會按照 Logger 收到事件的順序 append 到同一個 daily log。
 */

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

/**
 * error-YYYY-MM-DD.log
 *
 * error 同時存在：
 *
 * application-YYYY-MM-DD.log
 * error-YYYY-MM-DD.log
 *
 * application 是完整時間線；
 * error 是快速尋找 Error 的分流。
 */
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

/**
 * Security Log Filter
 *
 * Winston format 可以回傳 false，
 * 表示不要把這筆 Log 傳給該 Transport。
 *
 * 未來例如：
 *
 * logger.warn('Refresh token reuse detected', {
 *   category: 'security',
 *   event: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
 * });
 *
 * 就會同時出現在：
 *
 * application daily log
 * security daily log
 */
const securityOnly = format((info) => {
  if (info.category === 'security') {
    return info;
  }

  return false;
});

/**
 * Security Event Daily Log
 */
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

/**
 * DailyRotateFile 從 5.x 開始會 emit filesystem error。
 *
 * Logging 本身出錯時不能再呼叫 logger.error()，
 * 否則可能形成：
 *
 * logger error
 * → file transport error
 * → logger.error()
 * → file transport error
 * → ...
 *
 * 所以這裡直接使用 console.error 作為最後 fallback。
 */
for (const transport of [applicationDailyTransport, errorDailyTransport, securityDailyTransport]) {
  transport.on('error', (error) => {
    console.error('Log file transport error:', error);
  });
}

/**
 * Development Transports
 */
const developmentTransports = [
  new transports.Console({
    level: env.LOG_LEVEL,
    format: developmentConsoleFormat,
  }),

  applicationDailyTransport,
  errorDailyTransport,
  securityDailyTransport,
];

/**
 * Production
 *
 * 不寫 container 內的 logs/。
 *
 * Application 將 Structured JSON 寫到 stdout / stderr，
 * 後續交給：
 *
 * Docker
 * Cloud Run
 * Loki
 * ELK
 * Cloud Logging
 *
 * 等環境收集。
 */
const productionTransports = [
  new transports.Console({
    level: env.LOG_LEVEL,
    format: productionStructuredFormat,
  }),
];

/**
 * Application Logger
 */
export const logger = createLogger({
  level: env.LOG_LEVEL,

  transports: env.NODE_ENV === 'development' ? developmentTransports : productionTransports,
});
