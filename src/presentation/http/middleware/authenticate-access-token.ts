import type { RequestHandler } from 'express';

import { AppError } from '../../../application/errors/app-error.js';
import type { AccessTokenService } from '../../../application/ports/services/access-token.service.js';

export class AuthenticateAccessTokenMiddleware {
  private readonly accessTokenService: AccessTokenService;

  constructor(accessTokenService: AccessTokenService) {
    this.accessTokenService = accessTokenService;
  }

  readonly handle: RequestHandler = async (req, _res, next): Promise<void> => {
    const authorization = req.get('authorization');

    if (!authorization) {
      throw new AppError('Authentication required', 401);
    }

    /**
     * 預期格式：
     *
     * Authorization: Bearer <token>
     */
    const parts = authorization.trim().split(/\s+/);

    if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer' || !parts[1]) {
      throw new AppError('Authentication required', 401);
    }

    const claims = await this.accessTokenService.verify(parts[1]);

    if (!claims) {
      throw new AppError('Invalid or expired access token', 401);
    }

    /**
     * 後續 Controller 可以使用：
     *
     * req.auth.userId
     * req.auth.tokenId
     */
    req.auth = claims;

    next();
  };
}
