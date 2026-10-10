import { describe, expect, it } from 'vitest';

import { JoseAccessTokenService } from '../../../src/infrastructure/auth/jose-access-token.service.js';

/**
 * 這組 Test 不 Mock jose。
 *
 * 因為我們要測的就是：
 *
 * JoseAccessTokenService
 *        ↓
 * jose
 *        ↓
 * 真正 JWT Sign / Verify
 */
describe('JoseAccessTokenService', () => {
  const options = {
    secret: 'test-access-token-secret-at-least-32-characters-long',
    issuer: 'node-auth-from-scratch-v2-test',
    audience: 'node-auth-from-scratch-v2-test-client',
    ttlSeconds: 900,
  };

  it('issues and verifies an access token', async () => {
    const service = new JoseAccessTokenService(options);

    const userId = '550e8400-e29b-41d4-a716-446655440000';

    /**
     * Sign JWT。
     */
    const token = await service.issue({
      userId,
    });

    expect(token).toEqual(expect.any(String));

    /**
     * JWT Compact Serialization：
     *
     * header.payload.signature
     *
     * 因此通常會有三個部分。
     */
    expect(token.split('.')).toHaveLength(3);

    /**
     * 再使用相同 Service 驗證 Token。
     */
    const claims = await service.verify(token);

    expect(claims).not.toBeNull();

    expect(claims?.userId).toBe(userId);

    /**
     * jti 必須存在，
     * 讓每顆 Access Token 都有自己的 ID。
     */
    expect(claims?.tokenId).toEqual(expect.any(String));
  });

  it('returns null for a tampered token', async () => {
    const service = new JoseAccessTokenService(options);

    const token = await service.issue({
      userId: '550e8400-e29b-41d4-a716-446655440000',
    });

    /**
     * 修改 signature 最後一個字元，
     * 模擬 Client 篡改 JWT。
     */
    const replacement = token.endsWith('a') ? 'b' : 'a';

    const tamperedToken = `${token.slice(0, -1)}${replacement}`;

    await expect(service.verify(tamperedToken)).resolves.toBeNull();
  });

  it('returns null when the token uses a different issuer configuration', async () => {
    const issuingService = new JoseAccessTokenService({
      ...options,
      issuer: 'another-issuer',
    });

    const verifyingService = new JoseAccessTokenService(options);

    const token = await issuingService.issue({
      userId: '550e8400-e29b-41d4-a716-446655440000',
    });

    /**
     * Signature Secret 一樣，
     * 但 issuer 不符合。
     *
     * 所以不能只驗 signature，
     * issuer claim 也必須通過。
     */
    await expect(verifyingService.verify(token)).resolves.toBeNull();
  });

  it('returns null for an expired access token', async () => {
    /**
     * 負 TTL 只用於測試，
     * 讓簽出來的 exp 已經位於過去。
     */
    const service = new JoseAccessTokenService({
      ...options,
      ttlSeconds: -1,
    });

    const token = await service.issue({
      userId: '550e8400-e29b-41d4-a716-446655440000',
    });

    await expect(service.verify(token)).resolves.toBeNull();
  });
});
