import type { User } from '../../../domain/entities/user.js';
import type { Email } from '../../../domain/value-objects/email.js';

export interface CreateUserInput {
  email: Email;
  passwordHash: string;
}

export interface UserRepository {
  /**
   * 找到 User：
   * → User
   *
   * 查詢正常完成但不存在：
   * → null
   *
   * Infrastructure error：
   * → throw
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * 建立成功：
   * → User
   *
   * 已知的資料唯一性衝突：
   * → null
   *
   * 其他 Infrastructure error：
   * → throw
   *
   * Repository 不負責決定 HTTP status 或 AppError。
   */
  create(input: CreateUserInput): Promise<User | null>;
}
