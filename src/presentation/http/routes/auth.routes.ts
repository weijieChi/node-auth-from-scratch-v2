import { Router, type Router as ExpressRouter } from 'express';

import type { LoginController } from '../controllers/login.controller.js';
import type { MeController } from '../controllers/me.controller.js';
import type { RegisterController } from '../controllers/register.controller.js';
import type { AuthenticateAccessTokenMiddleware } from '../middleware/authenticate-access-token.js';

export function createAuthRouter(
  registerController: RegisterController,
  loginController: LoginController,
  authenticateAccessToken: AuthenticateAccessTokenMiddleware,
  meController: MeController,
): ExpressRouter {
  const router = Router();

  /**
   * Public Routes
   */
  router.post('/register', registerController.handle);

  router.post('/login', loginController.handle);

  /**
   * Protected Routes
   *
   * Access Token Authentication
   * 必須先執行。
   */
  router.get('/me', authenticateAccessToken.handle, meController.handle);

  return router;
}
