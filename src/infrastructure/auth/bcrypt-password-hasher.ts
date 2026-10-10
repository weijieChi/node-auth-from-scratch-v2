import bcrypt from 'bcryptjs';

import type { PasswordHasher } from '../../application/ports/services/password-hasher.js';

const BCRYPT_COST_FACTOR = 12;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    /**
     * bcrypt 最多使用 password 前 72 bytes。
     *
     * bcryptjs 不會因為超過限制自動 throw，
     * 所以 Registration 明確阻止 silent truncation。
     */
    if (bcrypt.truncates(password)) {
      throw new RangeError('Password exceeds the bcrypt 72-byte input limit');
    }

    return bcrypt.hash(password, BCRYPT_COST_FACTOR);
  }

  /**
   * 驗證 Login password。
   *
   * 超過 bcrypt 72-byte limit 時直接視為不符合，
   * 不讓 bcrypt silent truncation 造成奇怪的登入結果。
   */
  verify(password: string, passwordHash: string): Promise<boolean> {
    if (bcrypt.truncates(password)) {
      return Promise.resolve(false);
    }

    return bcrypt.compare(password, passwordHash);
  }
}
