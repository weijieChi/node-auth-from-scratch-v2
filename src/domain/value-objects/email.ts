import { z } from 'zod';

import { InvalidEmailError } from '../errors/invalid-email-error.js';

/**
 * Email 的共用 Zod Schema。
 *
 * 處理順序：
 *
 * 原始輸入
 *   ↓
 * trim()
 *   ↓
 * toLowerCase()
 *   ↓
 * z.email()
 *
 * 例如：
 *
 *   "  User@Example.com  "
 *
 * 最後會得到：
 *
 *   "user@example.com"
 *
 * export 的原因是之後 HTTP Request Schema 也可以直接重用，
 * 避免 Domain 與 Presentation 各自維護一套 Email 驗證規則。
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Email Value Object。
 *
 * 這個 class 的目的不是重新實作 Email 驗證，
 * Email 格式驗證已經交給上面的 Zod Schema。
 *
 * Email Value Object 的主要責任是：
 *
 * 1. 確保建立完成的 Email 一定經過標準化與驗證。
 * 2. 避免 Application / Domain 到處直接操作任意 email string。
 * 3. 集中 Email 的相關行為，方便未來擴充。
 *
 * 例如未來如果需要：
 *
 * - Email verification
 * - ChangeEmail
 * - VerifiedEmail
 * - 限制特定 Email domain
 *
 * 可以再從這裡擴充。
 */
export class Email {
  /**
   * 已經通過驗證與標準化的 Email。
   *
   * readonly：
   * Value Object 建立後不允許直接修改內容。
   */
  readonly value: string;

  /**
   * constructor 設為 private，
   * 不允許外部直接：
   *
   *   new Email(...)
   *
   * 必須統一透過：
   *
   *   Email.create(...)
   *
   * 才能保證 value 已經通過 Zod 驗證。
   *
   * 注意：
   *
   * 不使用：
   *
   *   private constructor(public readonly value: string) {}
   *
   * 因為專案開啟了：
   *
   *   erasableSyntaxOnly: true
   *
   * TypeScript Parameter Property 需要編譯器產生額外 JavaScript，
   * 因此不符合 erasableSyntaxOnly 的限制。
   */
  private constructor(value: string) {
    this.value = value;
  }

  /**
   * 建立 Email Value Object。
   *
   * @param rawValue 外部傳入、尚未驗證的 Email 字串。
   *
   * @throws InvalidEmailError
   * Email 格式不合法時拋出 Domain Error，
   * 而不是讓 ZodError 直接流入 Application 層。
   */
  static create(rawValue: string): Email {
    const result = emailSchema.safeParse(rawValue);

    if (!result.success) {
      throw new InvalidEmailError();
    }

    /**
     * result.data 已完成：
     *
     * - 前後空白移除
     * - 轉成小寫
     * - Email 格式驗證
     */
    return new Email(result.data);
  }

  /**
   * 需要一般 string 時可以使用：
   *
   *   email.toString()
   *
   * 或直接：
   *
   *   email.value
   */
  toString(): string {
    return this.value;
  }
}
