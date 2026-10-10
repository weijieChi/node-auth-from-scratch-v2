import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

import { BcryptPasswordHasher } from '../../../src/infrastructure/auth/bcrypt-password-hasher.js';

describe('BcryptPasswordHasher', () => {
  const passwordHasher = new BcryptPasswordHasher();

  it('hashes a password with bcrypt', async () => {
    const password = 'correct-horse-battery-staple';

    const passwordHash = await passwordHasher.hash(password);

    /**
     * Hash 不應該等於 raw password。
     */
    expect(passwordHash).not.toBe(password);

    /**
     * 使用 bcrypt 本身確認：
     *
     * BcryptPasswordHasher.hash()
     * 產生的是有效 bcrypt hash。
     */
    await expect(bcrypt.compare(password, passwordHash)).resolves.toBe(true);
  });

  it('verifies the correct password', async () => {
    const password = 'correct-password';

    const passwordHash = await bcrypt.hash(password, 4);

    /**
     * Login 正確 password
     * 應該得到 true。
     */
    await expect(passwordHasher.verify(password, passwordHash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);

    await expect(passwordHasher.verify('wrong-password', passwordHash)).resolves.toBe(false);
  });

  it('rejects passwords that exceed the bcrypt byte limit when hashing', async () => {
    /**
     * 一個中文字 UTF-8 通常占 3 bytes。
     *
     * 25 個中文字：
     *
     * 約 75 bytes
     *
     * 超過 bcrypt 72-byte limit。
     */
    const password = '密'.repeat(25);

    await expect(passwordHasher.hash(password)).rejects.toBeInstanceOf(RangeError);
  });

  it('returns false when login password exceeds the bcrypt byte limit', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);

    const tooLongPassword = '密'.repeat(25);

    /**
     * Login 不需要把這種 Client Input
     * 變成 Server Error。
     *
     * 對 Authentication 而言：
     *
     * password 不符合
     * → false
     */
    await expect(passwordHasher.verify(tooLongPassword, passwordHash)).resolves.toBe(false);
  });
});
