import { defineConfig } from 'vitest/config';

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
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/auth_test',

      /**
       * 測試時不要讓每個 HTTP Request
       * 都一直印 Morgan http log。
       */
      LOG_LEVEL: 'error',
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
    },
  },
});
