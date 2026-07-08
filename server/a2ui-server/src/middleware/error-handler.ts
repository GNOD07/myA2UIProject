/**
 * Koa 全局错误处理中间件。
 * 捕获未处理的异常，返回 JSON 格式的错误信息。
 */

import type { Middleware } from "koa";

export const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error ? err.message : "服务器内部错误";

    console.error(`[error] ${ctx.method} ${ctx.path}:`, err);

    ctx.status = status;
    ctx.body = {
      error: true,
      message,
      path: ctx.path,
    };
  }
};
