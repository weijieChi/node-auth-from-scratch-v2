import { randomUUID } from 'node:crypto';

import type {
  AccessTokenClaims,
  AccessTokenService,
  IssueAccessTokenInput,
} from '../../src/application/ports/services/access-token.service.js';

/**
 * AccessTokenService 的 Fake Implementation。
 *
 * LoginUserUseCase 的 Unit Test
 * 不應該真的使用 jose 或 JWT。
 *
 * Unit Test 要驗證的是：
 *
 * Login 成功
 *     ↓
 * AccessTokenService.issue()
 *     ↓
 * access token
 *
 * jose 是否真的能：
 *
 * - Sign JWT
 * - Verify JWT
 * - 驗證 signature
 * - 驗證 expiration
 *
 * 由 JoseAccessTokenService 自己的 Unit Test 負責。
 */
export class FakeAccessTokenService implements AccessTokenService {
  /**
   * 記錄哪些 User 被要求簽發 Access Token。
   */
  readonly issuedUserIds: string[] = [];

  /**
   * Fake Token → Claims。
   *
   * 讓 verify() 可以模擬：
   *
   * valid token
   * → claims
   *
   * unknown token
   * → null
   */
  private readonly tokens = new Map<string, AccessTokenClaims>();

  issue(input: IssueAccessTokenInput): Promise<string> {
    const tokenId = randomUUID();

    const token = `fake-access-token:${tokenId}`;

    this.issuedUserIds.push(input.userId);

    this.tokens.set(token, {
      userId: input.userId,
      tokenId,
    });

    return Promise.resolve(token);
  }

  verify(token: string): Promise<AccessTokenClaims | null> {
    return Promise.resolve(this.tokens.get(token) ?? null);
  }
}
