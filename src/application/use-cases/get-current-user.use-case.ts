import { AppError } from '../errors/app-error.js';
import type { UserRepository } from '../ports/repositories/user.repository.js';

import type { User } from '../../domain/entities/user.js';

interface GetCurrentUserInput {
  userId: string;
}

export class GetCurrentUserUseCase {
  private readonly userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async execute(input: GetCurrentUserInput): Promise<User> {
    const user = await this.userRepository.findById(input.userId);

    /**
     * JWT 本身可能仍然 cryptographically valid，
     * 但 User 已被刪除。
     */
    if (!user) {
      throw new AppError('Authentication required', 401);
    }

    if (user.status === 'DISABLED') {
      throw new AppError('Account is disabled', 403, 'ACCOUNT_DISABLED');
    }

    return user;
  }
}
