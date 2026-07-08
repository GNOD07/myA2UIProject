/**
 * a2ui-server 入口
 *
 * 基于 Koa 的 A2UI Agent 服务器：
 * - 接受用户自然语言 UI 描述
 * - 调用 Agent 生成 A2UI 协议
 * - 通过 AG-UI 协议 SSE 流式返回
 *
 * 当前阶段使用 Mock Agent（读取本地 A2UI mock 文件模拟输出）。
 */

import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import dotenv from "dotenv";
import { healthHandler } from "./routes/health.js";
import { agentHandler, generateHandler } from "./routes/generate.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";

dotenv.config();

const app = new Koa();
const router = new Router();

// ===== 路由注册 =====
router.get("/health", healthHandler);
router.post("/agent", agentHandler);                     // AG-UI 标准端点
router.post("/api/generate", generateHandler);           // 旧版兼容别名

// ===== 中间件注册 =====
app.use(errorHandler);
app.use(requestLogger);
app.use(cors());
app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

// ===== 启动 =====
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;

app.listen(port, () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║   A2UI Server (Mock Mode)           ║");
  console.log("  ║   基于 AG-UI 协议的流式 Agent 服务   ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");
  console.log(`  → AG-UI 端点: POST http://localhost:${port}/agent`);
  console.log(`  → 兼容端点:   POST http://localhost:${port}/api/generate`);
  console.log(`  → 健康检查:   GET  http://localhost:${port}/health`);
  console.log("");
});
