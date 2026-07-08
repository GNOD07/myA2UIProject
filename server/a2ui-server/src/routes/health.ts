/**
 * GET /health — 健康检查端点。
 * 返回服务器状态和可用 mock 场景列表。
 */

import type { RouterContext } from "@koa/router";

export async function healthHandler(ctx: RouterContext): Promise<void> {
  ctx.body = {
    status: "ok",
    server: "a2ui-server",
    version: "0.1.0",
    mode: "mock", // mock | production（后续接入真实 LLM 后改为 production）
    availableScenarios: [
      "cart",
      "data-binding",
      "list",
      "button",
      "image",
      "icon",
      "video",
      "card",
      "column",
      "simple",
      "open-link",
      "local-update",
    ],
  };
}
