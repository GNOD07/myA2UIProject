/**
 * POST /agent — AG-UI 协议标准端点。
 *
 * 接收 RunAgentInput → 调用 Mock Agent → SSE 流式返回 AG-UI 事件。
 *
 * 请求：
 *   POST /agent
 *   Content-Type: application/json
 *   Accept: text/event-stream
 *   Body: { messages, forwardedProps?, threadId?, runId?, tools?, context?, state? }
 *
 * 响应 (SSE)：
 *   data: {"type":"RUN_STARTED",...}
 *   data: {"type":"CUSTOM","name":"a2ui","value":{...A2UI 消息...}}
 *   data: {"type":"RUN_FINISHED",...}
 *
 * 同时兼容旧版格式（自动转换 { prompt, scenario } → RunAgentInput）。
 */

import type { RouterContext } from "@koa/router";
import { generateId, formatSSELine } from "../types.js";
import { streamGenerate } from "../agent/mock-agent.js";
import type { RunAgentInput, GenerateRequest } from "../types.js";

/**
 * 从 RunAgentInput 中提取 prompt 和 scenario。
 * 同时兼容旧版 GenerateRequest 格式。
 */
function parseRequest(body: unknown): { prompt: string; surfaceId: string; scenario: string } {
  if (!body || typeof body !== "object") {
    throw new Error("请求体不能为空");
  }

  const b = body as Record<string, unknown>;

  // 新版格式：RunAgentInput
  if (Array.isArray(b.messages)) {
    const messages = b.messages as RunAgentInput["messages"];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const prompt = lastUser?.content?.trim();
    if (!prompt) throw new Error("messages 中缺少 role=user 的消息");

    const props = (b.forwardedProps as Record<string, unknown> | undefined) ?? {};
    return {
      prompt,
      surfaceId: (props.surfaceId as string) ?? `surface-${Date.now()}`,
      scenario: (props.scenario as string) ?? "cart",
    };
  }

  // 旧版兼容：GenerateRequest
  if (typeof b.prompt === "string" && b.prompt.trim()) {
    return {
      prompt: b.prompt.trim(),
      surfaceId: (b.surfaceId as string) ?? `surface-${Date.now()}`,
      scenario: (b.scenario as string) ?? "cart",
    };
  }

  throw new Error("无法解析请求体：请使用 RunAgentInput (messages) 或 GenerateRequest (prompt) 格式");
}

export async function agentHandler(ctx: RouterContext): Promise<void> {
  // 1. 解析请求
  let params: { prompt: string; surfaceId: string; scenario: string };
  try {
    params = parseRequest(ctx.request.body);
  } catch (err) {
    ctx.status = 400;
    ctx.body = { error: true, message: err instanceof Error ? err.message : "请求格式错误" };
    return;
  }

  const { prompt, surfaceId, scenario } = params;

  console.log(`[agent] prompt="${prompt.slice(0, 60)}..." surfaceId="${surfaceId}" scenario="${scenario}"`);

  // 2. SSE 响应 — AG-UI 协议始终 SSE
  ctx.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  ctx.status = 200;
  ctx.respond = false;

  const { res } = ctx;

  ctx.req.on("close", () => {
    console.log("[agent] 客户端断开连接");
  });

  try {
    await streamGenerate(
      prompt,
      surfaceId,
      scenario,
      (event) => res.write(formatSSELine(event)),
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "未知错误";
    console.error("[agent] 错误:", errorMessage);
    try {
      res.write(
        formatSSELine({
          type: "RUN_ERROR" as const,
          threadId: generateId("t"),
          runId: generateId("r"),
          error: errorMessage,
        }),
      );
    } catch {
      // 忽略写入失败
    }
  } finally {
    res.end();
  }
}

/**
 * 旧版兼容端点：POST /api/generate → 内部转发到 agentHandler。
 */
export async function generateHandler(ctx: RouterContext): Promise<void> {
  return agentHandler(ctx);
}
