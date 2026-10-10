import type { PasswordHasher } from '../../src/application/ports/services/password-hasher.js';

/**
 * PasswordHasher 的測試用 Fake Implementation。
 *
 * Unit Test 不需要真的執行 bcrypt。
 *
 * Register：
 *
 * raw password
 *      ↓
 * hash()
 *      ↓
 * hashed:<password>
 *
 * Login：
 *
 * raw password
 * +
 * stored hash
 *      ↓
 * verify()
 *      ↓
 * boolean
 *
 * bcryptjs 本身是否正確 hash / verify，
 * 由 BcryptPasswordHasher 自己的 Unit Test 負責。
 */
export class FakePasswordHasher implements PasswordHasher {
  /**
   * 記錄所有要求 hash 的 password。
   *
   * Register Test 可以確認：
   *
   * - hash() 是否真的被呼叫
   * - 傳入的 password 是否正確
   */
  readonly hashedPasswords: string[] = [];

  /**
   * 記錄 Login 曾經要求驗證過的 password / hash。
   *
   * 可以確認 LoginUserUseCase：
   *
   * - 有沒有真的驗證密碼
   * - 使用的是不是 Repository 回傳的 hash
   */
  readonly verifiedPasswords: {
    password: string;
    passwordHash: string;
  }[] = [];

  /**
   * Fake hash 格式固定為：
   *
   * hashed:<raw-password>
   */
  hash(password: string): Promise<string> {
    this.hashedPasswords.push(password);

    return Promise.resolve(`hashed:${password}`);
  }

  /**
   * Fake password verification。
   *
   * 例如：
   *
   * password:
   *   correct-password
   *
   * passwordHash:
   *   hashed:correct-password
   *
   * → true
   */
  verify(password: string, passwordHash: string): Promise<boolean> {
    this.verifiedPasswords.push({
      password,
      passwordHash,
    });

    return Promise.resolve(passwordHash === `hashed:${password}`);
  }
}
