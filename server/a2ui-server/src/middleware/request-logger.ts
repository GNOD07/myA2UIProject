/**
 * 请求日志中间件。
 * 记录每个请求的方法、路径、状态码和耗时。
 */

import type { Middleware } from "koa";

export const requestLogger: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const elapsed = Date.now() - start;

  console.log(
    `[${new Date().toISOString()}] ${ctx.method} ${ctx.path} → ${ctx.status} (${elapsed}ms)`,
  );
};
