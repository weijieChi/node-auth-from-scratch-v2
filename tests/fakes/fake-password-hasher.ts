import type { PasswordHasher } from '../../src/application/ports/services/password-hasher.js';

/**
 * PasswordHasher 的測試用 Fake Implementation。
 *
 * RegisterUserUseCase 的 Unit Test 不需要真的執行 bcrypt。
 *
 * 這裡要測的是：
 *
 * raw password
 *      ↓
 * RegisterUserUseCase
 *      ↓
 * PasswordHasher.hash()
 *      ↓
 * hashed password
 *
 * 至於 bcryptjs 本身是否真的能 hash / verify，
 * 應該由 BcryptPasswordHasher 自己的測試負責。
 */
export class FakePasswordHasher implements PasswordHasher {
  /**
   * 記錄曾經要求 hash 的原始密碼。
   *
   * 讓測試可以確認：
   *
   * - PasswordHasher 是否真的被呼叫
   * - 傳入的 password 是否正確
   */
  readonly hashedPasswords: string[] = [];

  /**
   * 回傳固定格式的假 Hash。
   *
   * 因為 PasswordHasher interface 要求：
   *
   *   Promise<string>
   *
   * 但 Fake 本身沒有真正的 asynchronous operation，
   * 所以不使用 async，而直接回傳 Promise.resolve()。
   *
   * 這樣可以避免：
   *
   *   @typescript-eslint/require-await
   *
   * 同時仍然符合 PasswordHasher contract。
   */
  hash(password: string): Promise<string> {
    this.hashedPasswords.push(password);

    return Promise.resolve(`hashed:${password}`);
  }
}
