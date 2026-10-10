import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { LoginUserUseCase } from '../../../src/application/use-cases/login-user.use-case.js';
import { User } from '../../../src/domain/entities/user.js';
import { Email } from '../../../src/domain/value-objects/email.js';

import { FakeAccessTokenService } from '../../fakes/fake-access-token.service.js';
import { FakePasswordHasher } from '../../fakes/fake-password-hasher.js';
import { FakeUserRepository } from '../../fakes/fake-user.repository.js';

describe('LoginUserUseCase', () => {
  let userRepository: FakeUserRepository;

  let passwordHasher: FakePasswordHasher;

  let accessTokenService: FakeAccessTokenService;

  let useCase: LoginUserUseCase;

  beforeEach(() => {
    /**
     * 每個 Test 都建立全新的 Fake dependencies，
     * 避免測試之間共用狀態。
     */
    userRepository = new FakeUserRepository();

    passwordHasher = new FakePasswordHasher();

    accessTokenService = new FakeAccessTokenService();

    useCase = new LoginUserUseCase(userRepository, passwordHasher, accessTokenService);
  });

  /**
   * 建立 Login Test 所需要的 User。
   *
   * 這只是 Test Helper，
   * 不屬於 Production Code。
   */
  function addLocalUser(
    options: {
      email?: string;
      password?: string;
      status?: 'ACTIVE' | 'DISABLED';
    } = {},
  ): User {
    const email = Email.create(options.email ?? 'user@example.com');

    const user = new User({
      id: randomUUID(),
      email,
      status: options.status ?? 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    userRepository.users.push(user);

    userRepository.passwordHashes.set(user.id, `hashed:${options.password ?? 'correct-password'}`);

    return user;
  }

  it('logs in a local user and issues an access token', async () => {
    /**
     * Arrange
     */
    const user = addLocalUser({
      password: 'correct-password',
    });

    /**
     * Act
     */
    const result = await useCase.execute({
      email: 'user@example.com',
      password: 'correct-password',
    });

    /**
     * Assert
     *
     * Login 成功後必須取得 Access Token。
     */
    expect(result.accessToken).toEqual(expect.any(String));

    /**
     * 確認 Use Case 有真的呼叫 PasswordHasher.verify()。
     */
    expect(passwordHasher.verifiedPasswords).toEqual([
      {
        password: 'correct-password',

        passwordHash: 'hashed:correct-password',
      },
    ]);

    /**
     * Access Token 必須替正確的 User 簽發。
     */
    expect(accessTokenService.issuedUserIds).toEqual([user.id]);
  });

  it('normalizes the email before login', async () => {
    const user = addLocalUser({
      email: 'user@example.com',
    });

    const result = await useCase.execute({
      email: '  USER@EXAMPLE.COM  ',
      password: 'correct-password',
    });

    expect(result.accessToken).toEqual(expect.any(String));

    expect(accessTokenService.issuedUserIds).toEqual([user.id]);
  });

  it('rejects login when the email does not exist', async () => {
    /**
     * 不存在的 Email 和錯誤 Password
     * 對 Client 應使用相同錯誤。
     *
     * 避免 API 暴露：
     *
     * 「這個 Email 到底有沒有帳號」
     */
    await expect(
      useCase.execute({
        email: 'missing@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 401,
      message: 'Invalid email or password',
    });

    /**
     * User 都不存在，
     * 不應該呼叫 password verify。
     */
    expect(passwordHasher.verifiedPasswords).toHaveLength(0);

    expect(accessTokenService.issuedUserIds).toHaveLength(0);
  });

  it('rejects login when the password is incorrect', async () => {
    addLocalUser({
      password: 'correct-password',
    });

    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 401,
      message: 'Invalid email or password',
    });

    /**
     * Password 錯誤時一定有做 verify，
     * 但不應該簽發 Token。
     */
    expect(passwordHasher.verifiedPasswords).toHaveLength(1);

    expect(accessTokenService.issuedUserIds).toHaveLength(0);
  });

  it('rejects local login when the user has no password hash', async () => {
    /**
     * 模擬未來 OAuth-only account。
     */
    const user = new User({
      id: randomUUID(),
      email: Email.create('oauth@example.com'),
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    userRepository.users.push(user);

    /**
     * 故意不加入：
     *
     * userRepository.passwordHashes
     *
     * 因此：
     *
     * passwordHash = null
     */

    await expect(
      useCase.execute({
        email: 'oauth@example.com',
        password: 'anything',
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 401,
      message: 'Invalid email or password',
    });

    expect(passwordHasher.verifiedPasswords).toHaveLength(0);

    expect(accessTokenService.issuedUserIds).toHaveLength(0);
  });

  it('rejects login when the account is disabled', async () => {
    const user = addLocalUser({
      password: 'correct-password',
      status: 'DISABLED',
    });

    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 403,
      code: 'ACCOUNT_DISABLED',
      message: 'Account is disabled',
    });

    /**
     * 先確認 Password 正確後，
     * 才暴露 Account Disabled 狀態。
     */
    expect(passwordHasher.verifiedPasswords).toHaveLength(1);

    /**
     * Disabled Account 不應拿到 Token。
     */
    expect(accessTokenService.issuedUserIds).not.toContain(user.id);
  });
});
