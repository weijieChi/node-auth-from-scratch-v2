import { Router, type Router as ExpressRouter } from 'express';

import type { RegisterController } from '../controllers/register.controller.js';

/**
 * 建立 Authentication Router。
 *
 * Route Layer 只負責：
 *
 * HTTP Method
 * +
 * URL
 * +
 * Controller
 *
 * 不放 Business Logic。
 */
export function createAuthRouter(registerController: RegisterController): ExpressRouter {
  const router = Router();

  /**
   * POST /auth/register
   *
   * create-app.ts 會把這個 Router mount 在：
   *
   * /auth
   *
   * 因此這裡只需要：
   *
   * /register
   */
  router.post('/register', registerController.handle);

  return router;
}
