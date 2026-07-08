/**
 * Mock Agent：读取现有 A2UI mock JSONL 文件，模拟 Agent 流式生成。
 *
 * 工作原理：
 * 1. 根据 scenario 参数选择对应的 mock 文件
 * 2. 读取并解析 JSONL → A2UI 消息数组
 * 3. 逐条延迟发送，模拟 LLM token 输出节奏
 *
 * 后续替换为真实 LLM Agent 时，只需实现相同的 streamGenerate 接口即可。
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { AGUIEvent } from "../types.js";
import { EventType, generateId } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** mock 文件映射表：scenario → mock 文件路径 */
const MOCK_FILE_MAP: Record<string, string> = {
  cart: "../../../../packages/a2ui-core/mock/cart-list-mock.json",
  "data-binding": "../../../../packages/a2ui-core/mock/data-binding-mock.json",
  list: "../../../../packages/a2ui-core/mock/list-mock.json",
  button: "../../../../packages/a2ui-core/mock/button-mock.json",
  image: "../../../../packages/a2ui-core/mock/image-mock.json",
  icon: "../../../../packages/a2ui-core/mock/icon-mock.json",
  video: "../../../../packages/a2ui-core/mock/video-mock.json",
  card: "../../../../packages/a2ui-core/mock/card-mock.json",
  column: "../../../../packages/a2ui-core/mock/column-mock.json",
  simple: "../../../../packages/a2ui-core/mock/simple-text.json",
  "open-link": "../../../../packages/a2ui-core/mock/open-link-mock.json",
  "local-update": "../../../../packages/a2ui-core/mock/local-update-mock.json",
};

/** 默认使用的 mock 场景 */
const DEFAULT_SCENARIO = "cart";

/**
 * 读取并解析 A2UI mock JSONL 文件，返回 A2UI 协议消息数组。
 */
function loadMockMessages(scenario: string): Record<string, unknown>[] {
  const relativePath = MOCK_FILE_MAP[scenario];
  if (!relativePath) {
    throw new Error(
      `未知的 mock 场景: "${scenario}"，可用场景: ${Object.keys(MOCK_FILE_MAP).join(", ")}`
    );
  }

  const filePath = resolve(__dirname, relativePath);
  const raw = readFileSync(filePath, "utf-8");

  // JSONL 格式：每行一个完整 JSON
  const messages: Record<string, unknown>[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      messages.push(JSON.parse(trimmed));
    } catch {
      console.warn(`[mock-agent] 跳过无法解析的行: ${trimmed.slice(0, 80)}...`);
    }
  }

  console.log(`[mock-agent] 加载场景 "${scenario}": ${messages.length} 条 A2UI 消息`);
  return messages;
}

/** 每个事件回调内部使用 */
type EventCallback = (event: AGUIEvent) => void;

/**
 * 模拟 Agent 流式生成 A2UI 协议。
 *
 * @param prompt - 用户自然语言输入
 * @param surfaceId - 目标 surfaceId
 * @param scenario - mock 场景名（默认 "cart"）
 * @param onEvent - 事件回调（每生成一个 A2UI 消息就调用一次，包装为 AG-UI CUSTOM 事件）
 * @param signal - AbortSignal，用于客户端断开时取消流
 * @returns 统计信息
 */
export async function streamGenerate(
  prompt: string,
  surfaceId: string,
  scenario: string = DEFAULT_SCENARIO,
  onEvent: EventCallback,
  signal?: AbortSignal,
): Promise<{ messagesGenerated: number; surfaceId: string }> {
  const threadId = generateId("t");
  const runId = generateId("r");

  // 1. 发送 RUN_STARTED
  onEvent({
    type: EventType.RUN_STARTED,
    threadId,
    runId,
  });

  // 2. 加载 mock 数据
  const messages = loadMockMessages(scenario);

  // 3. 逐条发送 A2UI 消息，每条间隔延迟模拟流式输出
  let messagesGenerated = 0;
  for (const msg of messages) {
    if (signal?.aborted) {
      console.log("[mock-agent] 客户端断开，停止流式输出");
      break;
    }

    // 替换 surfaceId 以匹配请求中的 surfaceId
    const normalized = normalizeSurfaceId(msg, surfaceId);

    // 包装为 AG-UI CUSTOM 事件
    onEvent({
      type: EventType.CUSTOM,
      name: "a2ui",
      value: normalized,
    });

    messagesGenerated++;

    // 模拟流式延迟（50-150ms 随机）
    await sleep(50 + Math.random() * 100);
  }

  // 4. 发送 RUN_FINISHED
  onEvent({
    type: EventType.RUN_FINISHED,
    threadId,
    runId,
  });

  console.log(`[mock-agent] 完成: 输出 ${messagesGenerated} 条消息`);
  return { messagesGenerated, surfaceId };
}

/**
 * 将 mock 数据中的 surfaceId 替换为请求指定的 surfaceId。
 * 确保 mock 数据适配任意 surfaceId。
 */
function normalizeSurfaceId(
  msg: Record<string, unknown>,
  targetSurfaceId: string,
): Record<string, unknown> {
  // 检查所有已知的消息类型并替换 surfaceId
  const msgTypes = ["surfaceUpdate", "dataModelUpdate", "beginRendering", "deleteSurface"];
  for (const type of msgTypes) {
    if (type in msg && typeof msg[type] === "object" && msg[type] !== null) {
      const inner = msg[type] as Record<string, unknown>;
      // 保留原始 surfaceId 字段（部分 mock 数据以 s1 作为 surfaceId）
      // 只在 surfaceId 字段存在时才替换
      if ("surfaceId" in inner) {
        inner.surfaceId = targetSurfaceId;
      }
    }
  }
  return msg;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
