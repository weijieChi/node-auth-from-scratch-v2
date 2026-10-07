import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

import { BcryptPasswordHasher } from '../../../src/infrastructure/auth/bcrypt-password-hasher.js';

describe('BcryptPasswordHasher', () => {
  const passwordHasher = new BcryptPasswordHasher();

  it('hashes a password with bcrypt', async () => {
    const password = 'correct-horse-battery-staple';

    const passwordHash = await passwordHasher.hash(password);

    /**
     * Hash 不應該等於原始密碼。
     */
    expect(passwordHash).not.toBe(password);

    /**
     * 直接交給 bcrypt.compare() 驗證，
     * 確認產生出來的確實是有效的 bcrypt hash。
     */
    await expect(bcrypt.compare(password, passwordHash)).resolves.toBe(true);
  });

  it('rejects passwords that exceed the bcrypt byte limit', async () => {
    /**
     * 一個中文字 UTF-8 通常占 3 bytes。
     *
     * 25 個中文字就會超過 bcrypt 的 72-byte input limit，
     * 可以確認我們沒有把「character count」
     * 錯當成「byte count」。
     */
    const password = '密'.repeat(25);

    await expect(passwordHasher.hash(password)).rejects.toBeInstanceOf(RangeError);
  });
});
