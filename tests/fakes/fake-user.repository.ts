import { randomUUID } from 'node:crypto';

import type {
  CreateUserInput,
  UserRepository,
} from '../../src/application/ports/repositories/user.repository.js';
import { User } from '../../src/domain/entities/user.js';
import type { Email } from '../../src/domain/value-objects/email.js';

export class FakeUserRepository implements UserRepository {
  readonly users: User[] = [];

  readonly passwordHashes = new Map<string, string>();

  /**
   * 模擬：
   *
   * findByEmail() 時尚未存在，
   * 但真正 create() 時發生 unique conflict。
   *
   * 用來測 concurrent registration race condition
   * 在 Application Layer 的處理。
   */
  simulateCreateConflict = false;

  findByEmail(email: Email): Promise<User | null> {
    const user = this.users.find((candidate) => candidate.email.value === email.value);

    return Promise.resolve(user ?? null);
  }

  create(input: CreateUserInput): Promise<User | null> {
    if (this.simulateCreateConflict) {
      return Promise.resolve(null);
    }

    const now = new Date();

    const user = new User({
      id: randomUUID(),
      email: input.email,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    this.users.push(user);

    this.passwordHashes.set(user.id, input.passwordHash);

    return Promise.resolve(user);
  }
}
