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
 * 将美化打印的多行 JSON 文本按顶层对象分割
 * 使用括号计数法处理跨行 JSON 对象
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
          // 忽略解析失败的对象
        }
        start = -1;
      }
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

// A2UI Agent 界面生成接口（LLM 实时生成 A2UI JSONL）
router.post("/api/generate-ui", async (ctx) => {
  try {
    const { prompt } = ctx.request.body as { prompt: string };

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      ctx.status = 400;
      ctx.body = { error: "prompt 参数不能为空" };
      return;
    }

    console.log(`[generate-ui] 收到 UI 生成请求: ${prompt.slice(0, 100)}...`);

    // 设置 SSE 响应头
    ctx.status = 200;
    ctx.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // 组装完整 prompt：A2UI system prompt + 用户输入
    const systemPrompt = buildA2UIAgentPrompt({ multimodal: true });
    const chatMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    // 日志输出发给 LLM 的完整 prompt
    console.log(`\n========== 发送给大模型的 Prompt ==========`);
    console.log(`模型: ${CHAT_MODEL}`);
    console.log(`消息数: ${chatMessages.length}`);
    for (const msg of chatMessages) {
      const preview = typeof msg.content === "string"
        ? msg.content.slice(0, 300)
        : JSON.stringify(msg.content).slice(0, 300);
      const totalLen = typeof msg.content === "string"
        ? msg.content.length
        : JSON.stringify(msg.content).length;
      console.log(
        `  [${msg.role}] 长度: ${totalLen} 字符 | 预览: ${preview}${totalLen > 300 ? "..." : ""}`
      );
    }
    console.log(`============================================\n`);

    // 发送开始事件
    ctx.res.write(
      `data: ${JSON.stringify({ type: "RUN_STARTED", content: "A2UI Agent 开始生成界面..." })}\n\n`
    );

    // 调用 LLM 流式生成 A2UI JSONL
    const stream = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: chatMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: true,
    });

    let totalChars = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        totalChars += delta.length;
        ctx.res.write(
          `data: ${JSON.stringify({ type: "CHUNK", content: delta })}\n\n`
        );
      }
    }

    console.log(`[generate-ui] LLM 生成完成，共 ${totalChars} 字符`);

    // 发送完成事件
    ctx.res.write(
      `data: ${JSON.stringify({ type: "RUN_FINISHED", content: `界面生成完成，共 ${totalChars} 字符` })}\n\n`
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
