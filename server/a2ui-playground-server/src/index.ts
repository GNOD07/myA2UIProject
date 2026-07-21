import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { createReadStream } from "fs";
import { join } from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { buildA2UIAgentPrompt } from "./prompts/a2ui-agent-prompt.js";

dotenv.config();

// 初始化 OpenAI 客户端（兼容 DeepSeek 等 OpenAI 兼容 API）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const CHAT_MODEL = process.env.MODEL_NAME || "deepseek-chat";

/** 多模态消息内容：纯文本字符串 或 OpenAI content 数组 */
type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

/** 会话存储：sessionId → LLM 对话历史 */
const sessions = new Map<
  string,
  Array<{ role: "system" | "user" | "assistant"; content: MessageContent }>
>();

const app = new Koa();
const router = new Router();

// Mock数据集合
const MOCK_DATA: Record<string, string> = {
  "simple-text": join(process.cwd(), "../../packages/a2ui-core/mock/simple-text.json"),
  "column-with-texts": join(process.cwd(), "../../packages/a2ui-core/mock/column-with-texts.json"),
  "complex-nested-tree": join(process.cwd(), "../../packages/a2ui-core/mock/complex-nested-tree.json"),
  "button-demo": join(process.cwd(), "../../packages/a2ui-core/mock/button-demo.json"),
  "image-demo": join(process.cwd(), "../../packages/a2ui-core/mock/image-demo.json"),
  "icon-demo": join(process.cwd(), "../../packages/a2ui-core/mock/icon-demo.json"),
  "card-demo": join(process.cwd(), "../../packages/a2ui-core/mock/card-demo.json"),
  "data-binding-smoke": join(process.cwd(), "../../packages/a2ui-core/mock/data-binding-smoke.json"),
  "list-template-smoke": join(process.cwd(), "../../packages/a2ui-core/mock/list-template-smoke.json"),
  "cart-list-smoke": join(process.cwd(), "../../packages/a2ui-core/mock/cart-list-smoke.json"),
  "local-action-text-demo": join(process.cwd(), "../../packages/a2ui-core/mock/local-action-text-demo.json"),
  "agent-back": join(process.cwd(), "../../packages/a2ui-core/mock/agent-back.json"),
  "row-column-mixed": join(process.cwd(), "../../packages/a2ui-core/mock/row-column-mixed.json"),
};

// 读取JSON文件内容
async function readJsonFile(filePath: string): Promise<string> {
  const fs = await import("fs");
  return fs.promises.readFile(filePath, "utf-8");
}

/**
 * 尝试修复格式有问题的 JSON 字符串。
 *
 * 常见问题：LLM 生成的 JSON 中 Card/Button 等组件加了 style 后
 * 嵌套深度增加但缺少对应的闭合花括号。
 *
 * 修复策略（按优先级依次尝试）：
 * 1. 组件边界补 }：扫描 `}}},` 模式（3 个 } 后跟逗号）→ 补为 `}}}},`
 *    这是 Card/Button 加 style 后最典型的缺失模式
 * 2. 末尾补 }：使括号总数平衡
 * 3. 在数组 ] 前补 }：针对中间缺括号的情况
 */
function tryRepairJson(jsonStr: string): any | null {
  // 策略 1: 修复组件边界 `}},` → `}}}},`（Card/Button 加 style 后少括号）
  // 这个模式表示: } 闭style } 闭组件props } 闭组件type , → 但还缺 } 闭外层 entry
  // 补上缺失的 } 变成: }}}} ,
  const boundaryFixed = jsonStr.replace(/"padding":(\d+)\}\}\},/g, '"padding":$1}}}},');
  if (boundaryFixed !== jsonStr) {
    try {
      return JSON.parse(boundaryFixed);
    } catch {
      // 边界修复后仍不合法，继续尝试后续策略
    }
  }

  // 策略 2: 计算括号深度，在末尾补全缺失的 }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }

  if (depth > 0) {
    const closed = jsonStr + '}'.repeat(depth);
    try {
      return JSON.parse(closed);
    } catch {
      // 继续尝试策略 3
    }
  }

  // 策略 3: 在 components 数组的 ] 之前补 }
  if (depth > 0) {
    const lastBracket = jsonStr.lastIndexOf(']');
    if (lastBracket > 0) {
      const patched = jsonStr.slice(0, lastBracket) + '}'.repeat(depth) + jsonStr.slice(lastBracket);
      try {
        return JSON.parse(patched);
      } catch {
        // 放弃
      }
    }
  }

  return null;
}

/**
 * 将美化打印的多行 JSON 文本按顶层对象分割
 * 使用括号计数法处理跨行 JSON 对象。
 *
 * 解析失败的 JSON 会尝试修复（tryRepairJson），
 * 修复仍失败才丢弃并打印警告。
 */
function splitJsonMessages(text: string): any[] {
  const messages: any[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const jsonStr = text.slice(start, i + 1);
        try {
          messages.push(JSON.parse(jsonStr));
        } catch {
          // 尝试修复
          const repaired = tryRepairJson(jsonStr);
          if (repaired) {
            console.warn(`[splitJsonMessages] JSON 已自动修复，消息类型: ${Object.keys(repaired)[0]}`);
            messages.push(repaired);
          } else {
            console.warn(`[splitJsonMessages] JSON 解析失败且无法修复，已丢弃。前80字符: ${jsonStr.slice(0, 80)}`);
          }
        }
        start = -1;
      }
    }
  }

  // 处理末尾未闭合的内容（流可能在此截断）
  if (depth > 0 && start >= 0) {
    const remaining = text.slice(start);
    const repaired = tryRepairJson(remaining);
    if (repaired) {
      console.warn(`[splitJsonMessages] 末尾未闭合 JSON 已自动修复（深度=${depth}），消息类型: ${Object.keys(repaired)[0]}`);
      messages.push(repaired);
    } else {
      console.warn(`[splitJsonMessages] 末尾有未闭合 JSON（深度=${depth}），无法修复已丢弃。前80字符: ${remaining.slice(0, 80)}`);
    }
  }

  return messages;
}

/**
 * 规范化 dataModelUpdate 中非标准的 valueMap 格式
 * 将对象格式 {"key": "value"} 转为标准数组格式 [{"key": "key", "valueString": "value"}]
 */
function normalizeDataModelFormat(message: any): any {
  if (!message.dataModelUpdate) return message;

  const dm = message.dataModelUpdate;
  const normalized = { ...message, dataModelUpdate: { ...dm } };

  if (dm.contents && Array.isArray(dm.contents)) {
    normalized.dataModelUpdate.contents = dm.contents.map((entry: any) => {
      if (entry.valueMap && !Array.isArray(entry.valueMap)) {
        const arr: any[] = [];
        for (const [key, value] of Object.entries(entry.valueMap)) {
          if (typeof value === 'string') {
            arr.push({ key, valueString: value });
          } else if (typeof value === 'number') {
            arr.push({ key, valueNumber: value });
          } else if (typeof value === 'boolean') {
            arr.push({ key, valueBoolean: value });
          }
        }
        return { ...entry, valueMap: arr };
      }
      return entry;
    });
  }

  return normalized;
}

/**
 * 将 agent-back.json 的 dataModelUpdate 格式化为标准 JSONL
 * agent-back.json 使用特殊格式：顶级 contents 元素直接以 key=数字, valueMap={} 对象，
 * 而非标准 valueMap=[{key, valueString}]。这里将整体消息转为标准 JSONL。
 */
function toStandardJsonl(rawText: string): string {
  const messages = splitJsonMessages(rawText);
  const normalized = messages.map(normalizeDataModelFormat);
  return normalized.map((m) => JSON.stringify(m)).join('\n');
}

// 随机选择一个mock数据
function getRandomMockData(): Promise<string> {
  const keys = Object.keys(MOCK_DATA);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return readJsonFile(MOCK_DATA[randomKey]);
}

router.get("/health", (ctx) => {
  ctx.body = { status: "ok" };
});

// 读取指定 Mock 数据文件，以 SSE 流式逐条返回 JSONL 消息
router.get("/api/mock/:name", async (ctx) => {
  const { name } = ctx.params;
  const filePath = MOCK_DATA[name];
  if (!filePath) {
    ctx.status = 404;
    ctx.body = { error: `Mock "${name}" 不存在`, available: Object.keys(MOCK_DATA) };
    return;
  }

  // 设置 SSE 响应头
  ctx.status = 200;
  ctx.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const rawText = await readJsonFile(filePath);

    // 分割并规范化 JSON 消息
    const messages = splitJsonMessages(rawText);
    const normalizedMessages = messages.map(normalizeDataModelFormat);

    if (normalizedMessages.length === 0) {
      ctx.res.write(
        `data: ${JSON.stringify({ type: "ERROR", content: "Mock 文件中未找到有效 JSON 消息" })}\n\n`
      );
      ctx.res.write(`data: [DONE]\n\n`);
      ctx.res.end();
      return;
    }

    console.log(`[mock/${name}] 开始 SSE 流式发送，共 ${normalizedMessages.length} 条消息`);

    // 发送开始事件
    ctx.res.write(
      `data: ${JSON.stringify({ type: "RUN_STARTED", content: `Mock "${name}" 开始流式加载...` })}\n\n`
    );

    // 逐条发送 CHUNK，模拟真实流式传输延迟
    for (let i = 0; i < normalizedMessages.length; i++) {
      const msg = normalizedMessages[i];
      const msgType = Object.keys(msg)[0];
      const jsonlLine = JSON.stringify(msg) + "\n";

      ctx.res.write(
        `data: ${JSON.stringify({ type: "CHUNK", content: jsonlLine })}\n\n`
      );

      console.log(`[mock/${name}] 已发送消息 ${i + 1}/${normalizedMessages.length}: ${msgType} (${jsonlLine.length} 字符)`);

      // 模拟网络延迟，让前端有时间逐条处理
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`[mock/${name}] SSE 流式发送完成`);

    // 发送完成事件
    ctx.res.write(
      `data: ${JSON.stringify({ type: "RUN_FINISHED", content: `Mock "${name}" 加载完成，共 ${normalizedMessages.length} 条消息` })}\n\n`
    );
    ctx.res.write(`data: [DONE]\n\n`);
    ctx.res.end();
  } catch (e: any) {
    console.error(`[mock/${name}] 错误:`, e);
    ctx.res.write(
      `data: ${JSON.stringify({ type: "ERROR", content: e.message || "未知错误" })}\n\n`
    );
    ctx.res.write(`data: [DONE]\n\n`);
    ctx.res.end();
  }
});

// A2UI Agent 界面生成接口（LLM 实时生成 A2UI JSONL，支持多轮对话）
router.post("/api/generate-ui", async (ctx) => {
  try {
    const { prompt, sessionId, imageData } = ctx.request.body as {
      prompt: string;
      sessionId?: string;
      imageData?: string; // base64 data URL
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      ctx.status = 400;
      ctx.body = { error: "prompt 参数不能为空" };
      return;
    }

    // 获取或创建会话历史
    const sid = sessionId || `default-${Date.now()}`;
    const history = sessions.get(sid) ?? [
      { role: "system" as const, content: buildA2UIAgentPrompt({ multimodal: true }) },
    ];

    // 构造用户消息：有图片时用多模态 content 数组
    const userContent: MessageContent = imageData
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageData } },
        ]
      : prompt;
    history.push({ role: "user", content: userContent });

    console.log(
      `[generate-ui] session=${sid.slice(0, 8)}... 第 ${Math.floor((history.length - 1) / 2) + 1} 轮，共 ${history.length} 条消息${imageData ? "，含图片" : ""}`
    );
    console.log(`[generate-ui] 用户输入: ${prompt.slice(0, 100)}...`);

    // 设置 SSE 响应头
    ctx.status = 200;
    ctx.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // 日志输出
    console.log(`[generate-ui] 模型: ${CHAT_MODEL}, 历史消息数: ${history.length}`);

    // 发送开始事件
    ctx.res.write(
      `data: ${JSON.stringify({ type: "RUN_STARTED", content: "A2UI Agent 开始生成界面..." })}\n\n`
    );

    // 调用 LLM 流式生成 A2UI JSONL
    const stream = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: history as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        ctx.res.write(
          `data: ${JSON.stringify({ type: "CHUNK", content: delta })}\n\n`
        );
      }
    }

    console.log(`[generate-ui] LLM 生成完成，共 ${fullResponse.length} 字符`);

    // 尝试修复 AI 可能产出的格式问题（如 Card/Button 缺括号）
    const originalMessages = splitJsonMessages(fullResponse);

    if (originalMessages.length > 0) {
      // 将修复后的内容写回会话历史，让 LLM 在后续轮次看到正确格式
      const repairedContent = originalMessages.map((m) => JSON.stringify(m)).join('\n');
      if (repairedContent !== fullResponse) {
        console.log(`[generate-ui] AI 输出已自动修复（原始 ${fullResponse.length} → 修复后 ${repairedContent.length} 字符）`);
      }
      history.push({ role: "assistant", content: repairedContent });
    } else {
      // 无法解析，但 LLM 仍需看到上下文 → 保存原始内容
      console.warn(`[generate-ui] AI 输出无法解析且无法修复，保留原始内容`);
      history.push({ role: "assistant", content: fullResponse });
    }
    sessions.set(sid, history);

    // 发送完成事件（顺便告知 sessionId）
    ctx.res.write(
      `data: ${JSON.stringify({ type: "RUN_FINISHED", content: `界面生成完成，共 ${fullResponse.length} 字符`, sessionId: sid })}\n\n`
    );
    ctx.res.write(`data: [DONE]\n\n`);
    ctx.res.end();
  } catch (error: any) {
    console.error("[generate-ui] 错误:", error);
    ctx.status = 200;
    ctx.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    ctx.res.write(
      `data: ${JSON.stringify({ type: "ERROR", content: error.message || "未知错误" })}\n\n`
    );
    ctx.res.write(`data: [DONE]\n\n`);
    ctx.res.end();
  }
});

// 模型对话接口（SSE 流式输出）
router.post("/api/chat", async (ctx) => {
  try {
    const { messages } = ctx.request.body as { messages: Array<{ role: string; content: string }> };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      ctx.status = 400;
      ctx.body = { error: "messages 参数不能为空" };
      return;
    }

    console.log(`[chat] 收到对话请求，消息数: ${messages.length}`);

    // 设置 SSE 响应头
    ctx.status = 200;
    ctx.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // 发送开始事件
    ctx.res.write(`data: ${JSON.stringify({ type: "CHAT_STARTED", content: "模型开始生成..." })}\n\n`);

    // 调用 OpenAI 兼容 API 进行流式对话
    const stream = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: true,
    });

    let fullContent = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        ctx.res.write(`data: ${JSON.stringify({ type: "CHAT_CHUNK", content: delta })}\n\n`);
      }
    }

    console.log(`[chat] 模型回复完成，共 ${fullContent.length} 字符`);

    // 发送完成事件
    ctx.res.write(
      `data: ${JSON.stringify({ type: "CHAT_FINISHED", content: fullContent })}\n\n`
    );
    ctx.res.write(`data: [DONE]\n\n`);
    ctx.res.end();
  } catch (error: any) {
    console.error("[chat] 错误:", error);
    ctx.status = 200; // SSE 场景下状态码应为 200
    ctx.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    ctx.res.write(
      `data: ${JSON.stringify({ type: "CHAT_ERROR", content: error.message || "未知错误" })}\n\n`
    );
    ctx.res.write(`data: [DONE]\n\n`);
    ctx.res.end();
  }
});

app.use(cors());
app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`a2ui-playground-server running on http://localhost:${port}`);
});
