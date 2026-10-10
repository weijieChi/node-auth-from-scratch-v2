import { randomUUID } from 'node:crypto';

import { errors, jwtVerify, SignJWT } from 'jose';

import type {
  AccessTokenClaims,
  AccessTokenService,
  IssueAccessTokenInput,
} from '../../application/ports/services/access-token.service.js';

const ACCESS_TOKEN_ALGORITHM = 'HS256';

interface JoseAccessTokenServiceOptions {
  secret: string;
  issuer: string;
  audience: string;
  ttlSeconds: number;
}

/**
 * jose implementation of AccessTokenService。
 *
 * Application 只知道：
 *
 * AccessTokenService
 *
 * 不直接知道：
 *
 * SignJWT
 * jwtVerify
 * HS256
 * jose error classes
 */
export class JoseAccessTokenService implements AccessTokenService {
  private readonly secret: Uint8Array;

  private readonly issuer: string;

  private readonly audience: string;

  private readonly ttlSeconds: number;

  constructor(options: JoseAccessTokenServiceOptions) {
    /**
     * jose 的 symmetric HMAC key
     * 使用 Uint8Array。
     */
    this.secret = new TextEncoder().encode(options.secret);

    this.issuer = options.issuer;
    this.audience = options.audience;
    this.ttlSeconds = options.ttlSeconds;
  }

  async issue(input: IssueAccessTokenInput): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT({})
      .setProtectedHeader({
        alg: ACCESS_TOKEN_ALGORITHM,
        typ: 'JWT',
      })
      .setSubject(input.userId)
      .setJti(randomUUID())
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(now)
      .setExpirationTime(now + this.ttlSeconds)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      /**
       * jwtVerify() 同時驗證：
       *
       * - JWT signature
       * - algorithm
       * - issuer
       * - audience
       * - typ
       * - expiration
       * - required claims
       */
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: [ACCESS_TOKEN_ALGORITHM],
        issuer: this.issuer,
        audience: this.audience,
        typ: 'JWT',

        requiredClaims: ['sub', 'jti', 'iat', 'exp'],
      });

      /**
       * requiredClaims 可以確認欄位存在，
       * 這裡再確認 Application 真正需要的型別。
       */
      if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
        return null;
      }

      return {
        userId: payload.sub,
        tokenId: payload.jti,
      };
    } catch (error) {
      /**
       * JWT：
       *
       * - malformed
       * - expired
       * - wrong signature
       * - wrong issuer
       * - wrong audience
       *
       * 都屬於「Client 提供無效 Token」，
       * 對 Application 統一表示為 null。
       *
       * jose 的 JWT claim validation 會檢查 exp；
       * JWTExpired、JWTInvalid 等都屬於 JOSE errors。
       */
      if (error instanceof errors.JOSEError) {
        return null;
      }

      /**
       * 真正未知的程式 / runtime error
       * 保留原始 stack 往上。
       */
      throw error;
    }
  }
}
