import type { User } from '../../../domain/entities/user.js';
import type { Email } from '../../../domain/value-objects/email.js';

export interface CreateUserInput {
  email: Email;
  passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: Email): Promise<User | null>;

  create(input: CreateUserInput): Promise<User>;
}
