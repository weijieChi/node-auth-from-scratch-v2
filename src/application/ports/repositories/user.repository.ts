import type { User } from '../../../domain/entities/user.js';
import type { Email } from '../../../domain/value-objects/email.js';

export interface CreateUserInput {
  email: Email;
  passwordHash: string;
}

/**
 * Local Login 所需要的資料。
 *
 * passwordHash 可能是 null：
 *
 * Google OAuth-only User
 * → 沒有 Local Password
 */
export interface LocalAuthUser {
  user: User;
  passwordHash: string | null;
}

export interface UserRepository {
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Access Token 的 sub 是 userId，
   * /auth/me 會使用這個 method 查 User。
   */
  findById(id: string): Promise<User | null>;

  /**
   * Local Login 專用 Query。
   *
   * Domain User 本身不保存 passwordHash，
   * 所以 Login 所需 credential data
   * 由 Repository 另外提供。
   */
  findLocalAuthByEmail(email: Email): Promise<LocalAuthUser | null>;

  /**
   * B 方案：
   *
   * User
   * → 建立成功
   *
   * null
   * → unique conflict
   *
   * 其他 Infrastructure Error
   * → throw
   */
  create(input: CreateUserInput): Promise<User | null>;
}
