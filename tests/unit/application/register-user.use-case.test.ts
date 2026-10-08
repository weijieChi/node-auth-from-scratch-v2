import { beforeEach, describe, expect, it } from 'vitest';

import { RegisterUserUseCase } from '../../../src/application/use-cases/register-user.use-case.js';
import { InvalidEmailError } from '../../../src/domain/errors/invalid-email-error.js';

import { FakePasswordHasher } from '../../fakes/fake-password-hasher.js';
import { FakeUserRepository } from '../../fakes/fake-user.repository.js';

describe('RegisterUserUseCase', () => {
  let userRepository: FakeUserRepository;
  let passwordHasher: FakePasswordHasher;
  let useCase: RegisterUserUseCase;

  /**
   * 每個 Test 都重新建立乾淨的 Fake dependencies。
   *
   * 避免：
   *
   * Test A 建立的 User
   *      ↓
   * 污染 Test B
   */
  beforeEach(() => {
    userRepository = new FakeUserRepository();
    passwordHasher = new FakePasswordHasher();

    useCase = new RegisterUserUseCase(userRepository, passwordHasher);
  });

  it('registers a user with a hashed password', async () => {
    /**
     * Arrange
     */
    const rawPassword = 'correct-horse-battery-staple';

    /**
     * Act
     */
    const user = await useCase.execute({
      email: 'user@example.com',
      password: rawPassword,
    });

    /**
     * Assert
     *
     * User 成功建立。
     */
    expect(user.email.value).toBe('user@example.com');

    expect(user.status).toBe('ACTIVE');

    /**
     * 原始 password 必須有送進 PasswordHasher。
     */
    expect(passwordHasher.hashedPasswords).toEqual([rawPassword]);

    /**
     * Repository 收到的必須是 hash，
     * 而不是原始 password。
     */
    expect(userRepository.passwordHashes.get(user.id)).toBe(`hashed:${rawPassword}`);
  });

  it('normalizes the email before registration', async () => {
    /**
     * Email Value Object 目前的規則：
     *
     * trim
     * +
     * lowercase
     */
    const user = await useCase.execute({
      email: '  User@Example.COM  ',
      password: 'correct-horse-battery-staple',
    });

    expect(user.email.value).toBe('user@example.com');

    expect(userRepository.users).toHaveLength(1);

    expect(userRepository.users[0]?.email.value).toBe('user@example.com');
  });

  it('rejects an email that is already registered', async () => {
    /**
     * 第一次註冊成功。
     */
    await useCase.execute({
      email: 'user@example.com',
      password: 'first-password-123',
    });

    /**
     * 雖然第二次使用不同大小寫，
     * Email Value Object 會先 normalization：
     *
     * USER@EXAMPLE.COM
     *       ↓
     * user@example.com
     *
     * 因此應該被視為同一個帳號。
     */
    // 'promise' is assigned a value but never used  @typescript-eslint/no-unused-vars
    // const promise = useCase.execute({
    //   email: 'USER@example.com',
    //   password: 'password123',
    // });

    await expect(
      useCase.execute({
        email: 'USER@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 409,
      code: 'EMAIL_ALREADY_IN_USE',
      message: 'Email address is already in use',
    });

    /**
     * Repository 裡仍然只能有第一個 User。
     */
    expect(userRepository.users).toHaveLength(1);

    /**
     * Duplicate email 在 hash password 之前就應被拒絕。
     *
     * 因此 PasswordHasher 只應該被第一次註冊呼叫一次。
     */
    expect(passwordHasher.hashedPasswords).toHaveLength(1);
  });

  it('rejects an invalid email address', async () => {
    await expect(
      useCase.execute({
        email: 'not-an-email',
        password: 'correct-horse-battery-staple',
      }),
    ).rejects.toBeInstanceOf(InvalidEmailError);

    /**
     * Email 不合法時，
     * 不應該繼續 Hash Password 或寫 Repository。
     */
    expect(passwordHasher.hashedPasswords).toHaveLength(0);

    expect(userRepository.users).toHaveLength(0);
  });

  it('rejects a password shorter than the minimum length', async () => {
    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: '1234567',
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 400,
      message: 'Password must contain at least 8 characters',
    });

    expect(passwordHasher.hashedPasswords).toHaveLength(0);

    expect(userRepository.users).toHaveLength(0);
  });

  it('rejects registration when the repository detects a create conflict', async () => {
    /**
     * findByEmail() 仍然會得到 null，
     * 模擬另一個 concurrent request
     * 在這之後搶先完成 INSERT。
     */
    userRepository.simulateCreateConflict = true;

    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 409,
      code: 'EMAIL_ALREADY_IN_USE',
      message: 'Email address is already in use',
    });

    /**
     * Conflict 發生在 create 階段，
     * 所以 password 已經完成 hash。
     */
    expect(passwordHasher.hashedPasswords).toEqual(['password123']);

    /**
     * Repository 沒有真的建立 User。
     */
    expect(userRepository.users).toHaveLength(0);
  });
});
