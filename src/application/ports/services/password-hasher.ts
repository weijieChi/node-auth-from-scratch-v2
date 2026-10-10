export interface PasswordHasher {
  /**
   * 建立 password hash。
   *
   * Register 使用。
   */
  hash(password: string): Promise<string>;

  /**
   * 驗證 raw password 是否符合既有 hash。
   *
   * Login 使用。
   */
  verify(password: string, passwordHash: string): Promise<boolean>;
}
