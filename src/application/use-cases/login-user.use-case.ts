import { AppError } from '../errors/app-error.js';
import type { UserRepository } from '../ports/repositories/user.repository.js';
import type { AccessTokenService } from '../ports/services/access-token.service.js';
import type { PasswordHasher } from '../ports/services/password-hasher.js';

import { Email } from '../../domain/value-objects/email.js';

interface LoginUserInput {
  email: string;
  password: string;
}

interface LoginUserResult {
  accessToken: string;
}

/**
 * Local Account Login。
 *
 * Application flow：
 *
 * Email
 *   ↓
 * Find Local Auth User
 *   ↓
 * Verify Password
 *   ↓
 * Check Account Status
 *   ↓
 * Issue Access Token
 */
export class LoginUserUseCase {
  private readonly userRepository: UserRepository;

  private readonly passwordHasher: PasswordHasher;

  private readonly accessTokenService: AccessTokenService;

  constructor(
    userRepository: UserRepository,
    passwordHasher: PasswordHasher,
    accessTokenService: AccessTokenService,
  ) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.accessTokenService = accessTokenService;
  }

  async execute(input: LoginUserInput): Promise<LoginUserResult> {
    const email = Email.create(input.email);

    const authUser = await this.userRepository.findLocalAuthByEmail(email);

    /**
     * 不區分：
     *
     * - Email 不存在
     * - OAuth-only Account
     *
     * 對 Client 都回相同 Invalid Credentials，
     * 避免 API 直接暴露帳號存在狀態。
     */
    if (!authUser?.passwordHash) {
      throw new AppError('Invalid email or password', 401);
    }

    const passwordMatches = await this.passwordHasher.verify(input.password, authUser.passwordHash);

    if (!passwordMatches) {
      throw new AppError('Invalid email or password', 401);
    }

    /**
     * 先驗證 password，
     * 再告知帳號 disabled，
     * 避免只知道 Email 就能查詢帳號狀態。
     */
    if (authUser.user.status === 'DISABLED') {
      throw new AppError('Account is disabled', 403, 'ACCOUNT_DISABLED');
    }

    const accessToken = await this.accessTokenService.issue({
      userId: authUser.user.id,
    });

    return {
      accessToken,
    };
  }
}
