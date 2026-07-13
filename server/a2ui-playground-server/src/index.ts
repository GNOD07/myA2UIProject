import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { createReadStream } from "fs";
import { join } from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// 初始化 OpenAI 客户端（兼容 DeepSeek 等 OpenAI 兼容 API）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const CHAT_MODEL = process.env.CHAT_MODEL || "deepseek-chat";

const app = new Koa();
const router = new Router();

// Mock数据集合
const MOCK_DATA = {
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

// 随机选择一个mock数据
function getRandomMockData(): Promise<string> {
  const keys = Object.keys(MOCK_DATA);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return readJsonFile(MOCK_DATA[randomKey]);
}

router.get("/health", (ctx) => {
  ctx.body = { status: "ok" };
});

// 新增API端点用于生成UI（模拟 LLM 逐 token 流式输出）
router.post("/api/generate-ui", async (ctx) => {
  try {
    const { prompt } = ctx.request.body;
    console.log("收到请求, prompt:", prompt);

    // 读取 mock 数据
    const mockData = await getRandomMockData();
    const data = JSON.parse(mockData);
    const keys = Object.keys(data);
    console.log(`Mock数据keys: ${keys.join(", ")}`);

    // 先设置状态码和SSE头部
    ctx.status = 200;
    ctx.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // 发送开始事件
    ctx.res.write(`data: ${JSON.stringify({ type: "RUN_STARTED", content: "开始生成界面..." })}\n\n`);

    // 将所有消息拼接为一个完整的 JSONL 字符串，然后切割发送
    const lines: string[] = [];
    for (const key of keys) {
      lines.push(JSON.stringify({ [key]: data[key] }));
    }
    const fullJsonl = lines.join("\n") + "\n";
    console.log(`完整 JSONL 长度: ${fullJsonl.length} 字符`);

    // 按 50 字符切割
    const chunkSize = 50;
    let sent = 0;
    for (let i = 0; i < fullJsonl.length; i += chunkSize) {
      const chunk = fullJsonl.slice(i, i + chunkSize);
      // 每 50ms 发送一个碎片
      await new Promise(resolve => setTimeout(resolve, 50));
      ctx.res.write(`data: ${JSON.stringify({ type: "CHUNK", content: chunk })}\n\n`);
      sent += chunk.length;
    }
    console.log(`共发送 ${sent} 字符`);

    // 发送完成事件
    ctx.res.write(`data: ${JSON.stringify({ type: "RUN_FINISHED", content: "界面生成完成" })}\n\n`);
    ctx.res.write(`data: [DONE]\n\n`);
    ctx.res.end();
    console.log("SSE流式响应已发送完毕");

  } catch (error) {
    console.error("Error in /api/generate-ui:", error);
    ctx.status = 500;
    ctx.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    ctx.res.write(`data: ${JSON.stringify({ type: "ERROR", content: error.message })}\n\n`);
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
