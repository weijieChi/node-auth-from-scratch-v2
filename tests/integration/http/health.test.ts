import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../src/bootstrap/create-app.js';

/**
 * HTTP Integration Test
 *
 * 測試範圍：
 *
 * Supertest
 *    ↓
 * Express Middleware
 *    ↓
 * Route
 *    ↓
 * Response
 *
 * 不會執行 main.ts，
 * 也不需要真的啟動 localhost:3000。
 */
describe('GET /health/live', () => {
  const app = createApp();

  /**
   * it() 代表一個具體測試案例。
   *
   * 可以用一句自然語言描述：
   *
   * 「當 Application 還活著時，
   *   GET /health/live 應該回傳 200。」
   */
  it('returns 200 when the application is alive', async () => {
    /**
     * Arrange
     *
     * 這個測試幾乎沒有額外資料需要準備，
     * app 已經在上面 createApp() 完成。
     */

    /**
     * Act
     *
     * Supertest 對 Express 發出 HTTP Request。
     */
    const response = await request(app).get('/health/live');

    /**
     * Assert
     *
     * 驗證 HTTP Status。
     */
    expect(response.status).toBe(200);

    /**
     * Supertest 的 response.body 型別較寬鬆，
     * 先轉成 unknown，
     * 避免 any 直接流進 type-aware ESLint。
     */
    const body: unknown = response.body;

    /**
     * 驗證 Response Body。
     */
    expect(body).toEqual({
      status: 'ok',
    });
  });
});
