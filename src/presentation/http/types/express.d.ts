import type { AccessTokenClaims } from '../../../application/ports/services/access-token.service.js';

/**
 * 擴充 Express 全域 Request 型別。
 *
 * @types/express-serve-static-core 本身提供空的：
 *
 *   Express.Request
 *
 * 讓應用程式透過 declaration merging
 * 加入自訂 Request property。
 *
 * Authentication Middleware 驗證成功後：
 *
 *   req.auth = claims
 *
 * 後續 protected Controller 就能使用：
 *
 *   req.auth.userId
 *   req.auth.tokenId
 *
 * auth 是 optional，因為 public routes
 * 不一定會經過 authentication middleware。
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenClaims;
    }
  }
}

export {};
