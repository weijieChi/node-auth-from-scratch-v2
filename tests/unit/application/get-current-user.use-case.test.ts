import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { GetCurrentUserUseCase } from '../../../src/application/use-cases/get-current-user.use-case.js';
import { User } from '../../../src/domain/entities/user.js';
import { Email } from '../../../src/domain/value-objects/email.js';

import { FakeUserRepository } from '../../fakes/fake-user.repository.js';

describe('GetCurrentUserUseCase', () => {
  let userRepository: FakeUserRepository;

  let useCase: GetCurrentUserUseCase;

  beforeEach(() => {
    userRepository = new FakeUserRepository();

    useCase = new GetCurrentUserUseCase(userRepository);
  });

  it('returns the current active user', async () => {
    const user = new User({
      id: randomUUID(),
      email: Email.create('user@example.com'),
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    userRepository.users.push(user);

    const result = await useCase.execute({
      userId: user.id,
    });

    expect(result.id).toBe(user.id);

    expect(result.email.value).toBe('user@example.com');

    expect(result.status).toBe('ACTIVE');
  });

  it('rejects authentication when the user no longer exists', async () => {
    /**
     * Access Token 本身可能仍有效，
     * 但對應 User 已經不存在。
     */
    await expect(
      useCase.execute({
        userId: randomUUID(),
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 401,
      message: 'Authentication required',
    });
  });

  it('rejects access when the account is disabled', async () => {
    const user = new User({
      id: randomUUID(),
      email: Email.create('disabled@example.com'),
      status: 'DISABLED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    userRepository.users.push(user);

    await expect(
      useCase.execute({
        userId: user.id,
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 403,
      code: 'ACCOUNT_DISABLED',
      message: 'Account is disabled',
    });
  });
});
