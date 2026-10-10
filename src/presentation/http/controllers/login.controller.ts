import type { RequestHandler } from 'express';

import type { LoginUserUseCase } from '../../../application/use-cases/login-user.use-case.js';

import { loginRequestSchema } from '../schemas/login.schema.js';

export class LoginController {
  private readonly loginUserUseCase: LoginUserUseCase;

  constructor(loginUserUseCase: LoginUserUseCase) {
    this.loginUserUseCase = loginUserUseCase;
  }

  readonly handle: RequestHandler = async (req, res): Promise<void> => {
    const body: unknown = req.body;

    const result = loginRequestSchema.safeParse(body);

    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',

          details: result.error.issues.map((issue) => ({
            path: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        },
      });

      return;
    }

    /**
     * Invalid Credentials / Disabled Account
     * 會直接 throw AppError。
     *
     * Express 5 自動交給 Global Error Handler。
     */
    const resultData = await this.loginUserUseCase.execute(result.data);

    res.status(200).json({
      accessToken: resultData.accessToken,

      tokenType: 'Bearer',
    });
  };
}
