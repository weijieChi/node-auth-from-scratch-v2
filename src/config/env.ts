import { z } from 'zod';

/**
 * Environment Variables Schema
 *
 * Zod 的 Schema 可以理解成：
 *
 * 1. 定義「資料應該長什麼樣子」
 * 2. Runtime 實際檢查資料
 * 3. 驗證成功後，同時得到正確的 TypeScript 型別
 *
 * 這裡要驗證的資料來源是 Node.js 的：
 *
 *   process.env
 *
 * process.env 的原始型別基本上是：
 *
 *   Record<string, string | undefined>
 *
 * 也就是所有環境變數進來時：
 *
 * - 都是 string
 * - 或者根本不存在（undefined）
 *
 * 例如：
 *
 *   PORT=3000
 *
 * 在 Node.js 中其實是：
 *
 *   process.env.PORT === '3000'
 *
 * 而不是 number 3000。
 *
 * 因此這個 Schema 除了驗證，也負責把部分值轉換成
 * Application 真正想使用的型別。
 */
const envSchema = z.object({
  /**
   * NODE_ENV
   *
   * z.enum()：
   * 只允許指定的幾個字串。
   *
   * 合法：
   *   development
   *   test
   *   production
   *
   * 不合法：
   *   dev
   *   staging
   *   abc
   *
   * .default('development')：
   * 如果 process.env.NODE_ENV 是 undefined，
   * Zod 會自動使用 development。
   *
   * 驗證成功後，TypeScript 會知道它不是任意 string，
   * 而是：
   *
   *   'development' | 'test' | 'production'
   */
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * HOST
   *
   * z.string()：
   * 必須是字串。
   *
   * .min(1)：
   * 不允許空字串 ''。
   *
   * .default('0.0.0.0')：
   * 沒設定 HOST 時，自動使用 0.0.0.0。
   *
   * 之後 Express 啟動 Server 時可以使用：
   *
   *   app.listen(env.PORT, env.HOST)
   */
  HOST: z.string().min(1).default('0.0.0.0'),

  /**
   * PORT
   *
   * 這裡特別使用：
   *
   *   z.coerce.number()
   *
   * 而不是：
   *
   *   z.number()
   *
   * 因為環境變數：
   *
   *   PORT=3000
   *
   * 實際進入 process.env 後是：
   *
   *   '3000'
   *
   * z.coerce.number() 會嘗試把它轉成：
   *
   *   3000
   *
   * 接著：
   *
   * .int()
   *   必須是整數。
   *
   * .min(1)
   *   Port 不能小於 1。
   *
   * .max(65535)
   *   TCP/UDP Port 最大為 65535。
   *
   * .default(3000)
   *   沒有設定 PORT 時使用 3000。
   *
   * 驗證完成之後：
   *
   *   env.PORT
   *
   * 的 TypeScript 型別會直接是 number。
   */
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  /**
   * DATABASE_URL
   *
   * Database URL 是必要設定，因此這裡沒有 .default()。
   *
   * 如果完全沒有 DATABASE_URL：
   *
   *   process.env.DATABASE_URL === undefined
   *
   * Zod 就會判定 Validation Failure，
   * Application 不允許繼續啟動。
   *
   * 例如合法格式：
   *
   *   postgresql://postgres:postgres@localhost:5432/auth_dev
   *
   * .refine()：
   * 用於加入 Zod 本身基本型別驗證以外的
   * 自訂規則。
   *
   * 這裡我們要求：
   *
   * 1. 必須可以被 URL parser 解析
   * 2. Protocol 必須是 postgresql: 或 postgres:
   */
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) => {
        try {
          /**
           * 使用 JavaScript 內建 URL class 嘗試解析。
           *
           * 如果不是合法 URL：
           *
           *   new URL(value)
           *
           * 會 throw Error。
           */
          const url = new URL(value);

          /**
           * URL 合法還不夠。
           *
           * 例如：
           *
           *   mysql://...
           *   https://...
           *
           * 都可能是合法 URL，
           * 但不是這個 Application 要的 PostgreSQL URL。
           */
          return url.protocol === 'postgresql:' || url.protocol === 'postgres:';
        } catch {
          /**
           * URL 無法解析。
           *
           * refine callback：
           *
           *   true  → 驗證成功
           *   false → 驗證失敗
           */
          return false;
        }
      },
      {
        /**
         * refine() 失敗時顯示的錯誤訊息。
         */
        message: 'DATABASE_URL must be a valid PostgreSQL URL',
      },
    ),

  /**
   * LOG_LEVEL
   *
   * 這些值是我們之後 Winston Logging
   * 預計允許使用的 Log Level。
   *
   * 使用 enum 可以避免：
   *
   *   LOG_LEVEL=abc
   *
   * 這種錯誤設定一路跑到 Winston 才被發現。
   *
   * 沒設定時預設為 info。
   */
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
});

/**
 * 驗證 process.env
 *
 * safeParse() 和 parse() 都能執行驗證，
 * 但失敗行為不同。
 *
 * parse():
 *
 *   envSchema.parse(process.env)
 *
 * 驗證失敗會直接 throw ZodError。
 *
 *
 * safeParse():
 *
 *   envSchema.safeParse(process.env)
 *
 * 不會 throw，而是回傳：
 *
 * 成功：
 *
 *   {
 *     success: true,
 *     data: ...
 *   }
 *
 * 失敗：
 *
 *   {
 *     success: false,
 *     error: ...
 *   }
 *
 * 這裡使用 safeParse，
 * 是因為我們希望自己控制 Application
 * 啟動失敗時顯示的錯誤格式。
 */
const result = envSchema.safeParse(process.env);

/**
 * Environment Validation Failure
 *
 * 如果任何環境變數不符合 Schema，
 * Application 不應該繼續啟動。
 *
 * 例如：
 *
 *   PORT=99999
 *
 * 或：
 *
 *   DATABASE_URL=mysql://localhost/test
 *
 * 都應該在 Application Startup 階段立即失敗，
 * 而不是等到收到 HTTP Request 或連 Database 時
 * 才發現設定錯誤。
 */
if (!result.success) {
  /**
   * z.prettifyError()
   *
   * 將 ZodError 轉成比較適合人閱讀的文字。
   *
   * 例如：
   *
   * Invalid environment configuration:
   *
   * ✖ Invalid input: expected string, received undefined
   *   → at DATABASE_URL
   */
  console.error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);

  /**
   * Exit Code:
   *
   *   0 = 正常結束
   *   非 0 = 程式異常結束
   *
   * Configuration 不合法代表 Application
   * 根本無法正常提供服務，因此使用 exit code 1。
   */
  process.exit(1);
}

/**
 * 驗證成功之後：
 *
 * result.data 已經不是原本鬆散的 process.env。
 *
 * Zod 已經：
 *
 * - 套用 Default
 * - 驗證 enum
 * - 驗證 Database URL
 * - PORT string → number
 * - 建立 TypeScript inferred type
 *
 * 例如：
 *
 * env.NODE_ENV
 * → 'development' | 'test' | 'production'
 *
 * env.HOST
 * → string
 *
 * env.PORT
 * → number
 *
 * env.DATABASE_URL
 * → string
 *
 * env.LOG_LEVEL
 * → Winston log level union
 *
 *
 * Object.freeze()：
 *
 * 防止程式執行期間有人做：
 *
 *   env.PORT = 5000
 *
 * Environment Configuration 應該在程式啟動時決定，
 * 啟動後保持不變。
 */
export const env = Object.freeze(result.data);
