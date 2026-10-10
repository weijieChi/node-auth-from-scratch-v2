/**
 * 建立 Access Token 所需要的資料。
 *
 * Step 10 還沒有 AuthSession，
 * 因此目前只有 userId。
 */
export interface IssueAccessTokenInput {
  userId: string;
}

/**
 * Access Token 驗證成功後，
 * Application / Presentation 可以使用的 claims。
 *
 * 不直接把 jose JWTPayload 往外傳，
 * 避免 Application 依賴 jose。
 */
export interface AccessTokenClaims {
  userId: string;
  tokenId: string;
}

export interface AccessTokenService {
  /**
   * 簽發 Access Token。
   */
  issue(input: IssueAccessTokenInput): Promise<string>;

  /**
   * 驗證 Access Token。
   *
   * valid
   * → claims
   *
   * invalid / expired
   * → null
   *
   * unexpected infrastructure error
   * → throw
   */
  verify(token: string): Promise<AccessTokenClaims | null>;
}
