import type { RequestHandler } from 'express';

import type { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case.js';

import { registerRequestSchema } from '../schemas/register.schema.js';

/**
 * Register HTTP Controller。
 *
 * Controller 的責任：
 *
 * HTTP Request
 *      ↓
 * Zod Validation
 *      ↓
 * RegisterUserUseCase
 *      ↓
 * HTTP Response
 *
 * Controller 不應該：
 *
 * - 查 Prisma
 * - 使用 bcrypt
 * - 寫 SQL
 * - 判斷 Email 是否重複
 *
 * Business Logic 全部留在 Application Layer。
 */
export class RegisterController {
  /**
   * 不使用：
   *
   * constructor(
   *   private readonly registerUserUseCase: RegisterUserUseCase,
   * ) {}
   *
   * 因為專案啟用了：
   *
   * erasableSyntaxOnly: true
   */
  private readonly registerUserUseCase: RegisterUserUseCase;

  constructor(registerUserUseCase: RegisterUserUseCase) {
    this.registerUserUseCase = registerUserUseCase;
  }

  /**
   * 使用 RequestHandler class field。
   *
   * 這樣傳給：
   *
   * router.post('/register', controller.handle)
   *
   * 時不會發生 this context 遺失。
   *
   * Express 5 會自動處理 rejected Promise，
   * 所以這裡不需要每個 Controller 再包 try/catch。
   */
  readonly handle: RequestHandler = async (req, res): Promise<void> => {
    /**
     * Express 的 req.body 型別本身比較寬鬆，
     * 先視為 unknown，再交給 Zod 做 runtime validation。
     */
    const body: unknown = req.body;

    const result = registerRequestSchema.safeParse(body);

    if (!result.success) {
      /**
       * Request 格式錯誤屬於 HTTP Boundary 問題，
       * Controller 可以直接回應 400。
       *
       * 例如：
       *
       * - email 不合法
       * - password 太短
       * - password 超過 bcrypt 72-byte limit
       */
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',

          details: result.error.issues.map((issue) => ({
            path: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        },
      });

      return;
    }

    /**
     * result.data 現在已經是：
     *
     * {
     *   email: normalized valid email,
     *   password: valid password
     * }
     */
    const user = await this.registerUserUseCase.execute(result.data);

    /**
     * 註冊成功：
     *
     * HTTP 201 Created
     *
     * 注意：
     *
     * Response 絕對不回傳：
     *
     * - raw password
     * - passwordHash
     */
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email.value,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  };
}
