import { Router } from 'express';

const healthRouter = Router();

/**
 * Liveness Probe
 *
 * 只回答一件事：
 *
 *   Node.js / Express process 是否還活著？
 *
 * 不應該因為 Database 暫時無法連線就回傳失敗。
 * 否則 Container Orchestrator 可能一直重新啟動
 * 一個其實仍然正常運作的 Application process。
 */
healthRouter.get('/live', (_req, res) => {
  res.status(200).json({
    status: 'ok',
  });
});

/**
 * Readiness Probe
 *
 * 回答：
 *
 *   Application 現在是否準備好接收 Request？
 *
 * Step 05 尚未加入 Database，因此目前只代表
 * Express Application 已正常建立。
 *
 * Step 07 加入 PostgreSQL / Prisma 後，
 * 再把 Database readiness check 接進來。
 */
healthRouter.get('/ready', (_req, res) => {
  res.status(200).json({
    status: 'ready',
  });
});

export { healthRouter };
