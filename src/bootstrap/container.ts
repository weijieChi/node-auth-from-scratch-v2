import type { Router } from 'express';

import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case.js';

import { BcryptPasswordHasher } from '../infrastructure/auth/bcrypt-password-hasher.js';
import { PrismaUserRepository } from '../infrastructure/database/prisma/prisma-user.repository.js';

import { RegisterController } from '../presentation/http/controllers/register.controller.js';
import { createAuthRouter } from '../presentation/http/routes/auth.routes.js';

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

  /**
   * Application
   */
  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);

  /**
   * Presentation
   */
  const registerController = new RegisterController(registerUserUseCase);

  const authRouter = createAuthRouter(registerController);

  return {
    authRouter,
  };
}
