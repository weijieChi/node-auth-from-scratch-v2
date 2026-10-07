import bcrypt from 'bcryptjs';

import type { PasswordHasher } from '../../application/ports/services/password-hasher.js';

const BCRYPT_COST_FACTOR = 12;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    /**
     * bcrypt 最多使用 password 的前 72 bytes。
     *
     * bcryptjs 不會預設因為超過 72 bytes 而 throw，
     * 因此明確阻止 silent truncation。
     */
    if (bcrypt.truncates(password)) {
      throw new RangeError('Password exceeds the bcrypt 72-byte input limit');
    }

    return bcrypt.hash(password, BCRYPT_COST_FACTOR);
  }
}
