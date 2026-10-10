import type { Router } from 'express';

import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case.js';

import { BcryptPasswordHasher } from '../infrastructure/auth/bcrypt-password-hasher.js';
import { PrismaUserRepository } from '../infrastructure/database/prisma/prisma-user.repository.js';

import { RegisterController } from '../presentation/http/controllers/register.controller.js';
import { createAuthRouter } from '../presentation/http/routes/auth.routes.js';

import { GetCurrentUserUseCase } from '../application/use-cases/get-current-user.use-case.js';
import { LoginUserUseCase } from '../application/use-cases/login-user.use-case.js';

import { JoseAccessTokenService } from '../infrastructure/auth/jose-access-token.service.js';

import { LoginController } from '../presentation/http/controllers/login.controller.js';
import { MeController } from '../presentation/http/controllers/me.controller.js';
import { AuthenticateAccessTokenMiddleware } from '../presentation/http/middleware/authenticate-access-token.js';

import { env } from '../config/env.js';

/**
 * Application 啟動完成後，
 * createApp() 真正需要的 dependencies。
 *
 * create-app.ts 不需要知道：
 *
 * - PrismaUserRepository
 * - BcryptPasswordHasher
 * - RegisterUserUseCase
 *
 * 它只需要已經組裝完成的 Router。
 */
export interface AppContainer {
  authRouter: Router;
}

/**
 * Manual Dependency Injection / Composition Root。
 *
 * 所有 concrete implementation 集中在這裡組裝。
 *
 * Dependency Graph：
 *
 * PrismaUserRepository
 *          ↓
 *     UserRepository
 *          ↓
 * RegisterUserUseCase
 *          ↑
 *    PasswordHasher
 *          ↑
 * BcryptPasswordHasher
 *
 *          ↓
 *
 * RegisterController
 *
 *          ↓
 *
 * Auth Router
 */
export function createContainer(): AppContainer {
  /**
   * Infrastructure
   */
  const userRepository = new PrismaUserRepository();

  const passwordHasher = new BcryptPasswordHasher();

  const accessTokenService = new JoseAccessTokenService({
    secret: env.ACCESS_TOKEN_SECRET,
    issuer: env.ACCESS_TOKEN_ISSUER,
    audience: env.ACCESS_TOKEN_AUDIENCE,
    ttlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
  });

  /**
   * Application
   */
  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);

  const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, accessTokenService);

  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);

  /**
   * Presentation
   */
  const registerController = new RegisterController(registerUserUseCase);

  const loginController = new LoginController(loginUserUseCase);

  const meController = new MeController(getCurrentUserUseCase);

  const authenticateAccessToken = new AuthenticateAccessTokenMiddleware(accessTokenService);

  const authRouter = createAuthRouter(
    registerController,
    loginController,
    authenticateAccessToken,
    meController,
  );

  return {
    authRouter,
  };
}
