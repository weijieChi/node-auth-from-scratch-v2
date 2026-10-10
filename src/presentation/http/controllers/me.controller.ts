import type { RequestHandler } from 'express';

import type { GetCurrentUserUseCase } from '../../../application/use-cases/get-current-user.use-case.js';

export class MeController {
  private readonly getCurrentUserUseCase: GetCurrentUserUseCase;

  constructor(getCurrentUserUseCase: GetCurrentUserUseCase) {
    this.getCurrentUserUseCase = getCurrentUserUseCase;
  }

  readonly handle: RequestHandler = async (req, res): Promise<void> => {
    /**
     * /me Route 一定應該先經過
     * AuthenticateAccessTokenMiddleware。
     *
     * 如果這裡沒有 auth，
     * 代表 Route wiring 有 bug，
     * 不是正常 Client Error。
     */
    if (!req.auth) {
      throw new Error('Authenticated route is missing authentication context');
    }

    const user = await this.getCurrentUserUseCase.execute({
      userId: req.auth.userId,
    });

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email.value,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  };
}
