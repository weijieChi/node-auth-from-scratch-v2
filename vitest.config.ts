import 'dotenv/config';

import { defineConfig } from 'vitest/config';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run tests');
}

export default defineConfig({
  test: {
    /**
     * 我們測的是 Node.js Backend，
     * 不需要 Browser DOM。
     *
     * Vitest 預設其實就是 node，
     * 這裡明確寫出來方便閱讀。
     */
    environment: 'node',

    /**
     * 只把 tests/ 底下的 *.test.ts
     * 視為測試檔案。
     */
    include: ['tests/**/*.test.ts'],

    /**
     * 測試執行時提供專用環境變數。
     *
     * 因為 createApp()
     *   ↓
     * logger
     *   ↓
     * env.ts
     *
     * 仍然會經過我們 Step 03 的 Zod Config Validation。
     *
     * DATABASE_URL 現在只是合法格式即可，
     * Step 06 還不會真的連 PostgreSQL。
     */
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      LOG_LEVEL: 'error',

      /**
       * Step 10 Access Token Test Configuration。
       *
       * Test 使用固定值，
       * 不需要使用 development secret。
       */
      ACCESS_TOKEN_SECRET: 'test-access-token-secret-at-least-32-characters-long',

      ACCESS_TOKEN_ISSUER: 'node-auth-from-scratch-v2-test',

      ACCESS_TOKEN_AUDIENCE: 'node-auth-from-scratch-v2-test-client',

      ACCESS_TOKEN_TTL_SECONDS: '900',
    },

    coverage: {
      /**
       * 使用 Node.js V8 原生 Coverage。
       */
      provider: 'v8',

      /**
       * Terminal 顯示結果，
       * 同時產生可用 Browser 開啟的 HTML。
       */
      reporter: ['text', 'html'],

      reportsDirectory: 'coverage',

      /**
       * Coverage 看正式 Application Code，
       * 不統計 tests 本身。
       */
      include: ['src/**/*.ts'],

      exclude: [
        /**
         * Prisma 自動產生的 Client。
         *
         * 不是我們自己維護的程式碼，
         * 不需要納入 Coverage。
         */
        'src/generated/**',

        /**
         * TypeScript declaration files。
         *
         * 只有型別宣告，沒有 runtime behavior。
         */
        '**/*.d.ts',

        /**
         * Application Ports。
         *
         * 主要是 interface / type，
         * 沒有可以實際執行的邏輯。
         */
        'src/application/ports/**',

        /**
         * Process Entry Point。
         *
         * main.ts 主要負責：
         *
         * - 啟動 HTTP Server
         * - process signal
         * - uncaughtException
         * - unhandledRejection
         *
         * 不適合用一般 Unit / Integration Coverage
         * 當作核心業務測試指標。
         */
        'src/main.ts',

        /**
         * Process shutdown lifecycle。
         *
         * 包含 SIGINT / SIGTERM、
         * Server close、Database disconnect 等流程。
         *
         * 未來如果特別做 process lifecycle test，
         * 再考慮移回 Coverage。
         */
        'src/bootstrap/shutdown.ts',

        /**
         * Logger bootstrap / transport configuration。
         *
         * 主要是 Winston transport、
         * formatting、environment-specific setup。
         *
         * http-logger.ts 仍保留 Coverage，
         * 因為它實際參與 HTTP request flow。
         */
        'src/observability/logger.ts',
      ],
    },
  },
});
