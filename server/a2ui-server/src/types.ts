/**
 * AG-UI 协议事件类型定义
 *
 * AG-UI (Agent-User Interaction) 是 agent ↔ 前端之间的标准化通信协议。
 * 通过 SSE 传输，使用 CUSTOM 事件携带 A2UI 协议数据。
 */

/** AG-UI 事件类型枚举 */
export const EventType = {
  /** 运行开始 */
  RUN_STARTED: "RUN_STARTED",
  /** 运行完成 */
  RUN_FINISHED: "RUN_FINISHED",
  /** 运行错误 */
  RUN_ERROR: "RUN_ERROR",
  /** 自定义事件（承载 A2UI 协议数据） */
  CUSTOM: "CUSTOM",
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

/** RUN_STARTED / RUN_FINISHED 生命周期事件 */
export interface RunEvent {
  type: typeof EventType.RUN_STARTED | typeof EventType.RUN_FINISHED;
  threadId: string;
  runId: string;
}

/** RUN_ERROR 错误事件 */
export interface RunErrorEvent {
  type: typeof EventType.RUN_ERROR;
  threadId: string;
  runId: string;
  error: string;
}

/** CUSTOM 事件 — 承载 A2UI 协议消息 */
export interface A2UICustomEvent {
  type: typeof EventType.CUSTOM;
  name: "a2ui";
  value: Record<string, unknown>;
}

/** 所有 AG-UI 事件联合类型 */
export type AGUIEvent = RunEvent | RunErrorEvent | A2UICustomEvent;

/** AG-UI 事件的 SSE 行格式（data: 前缀 + JSON） */
export function formatSSELine(event: AGUIEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * AG-UI 协议 RunAgentInput — 标准请求体。
 * 参考 https://docs.ag-ui.com 规范。
 */
export interface RunAgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RunAgentInput {
  threadId?: string;
  runId?: string;
  messages: RunAgentMessage[];
  tools?: unknown[];
  context?: unknown[];
  state?: Record<string, unknown>;
  forwardedProps?: {
    surfaceId?: string;
    scenario?: string;
  };
}

/**
 * 旧版请求体，做兼容转换。
 * @deprecated 请使用 RunAgentInput 格式
 */
export interface GenerateRequest {
  prompt: string;
  surfaceId?: string;
  scenario?: string;
}

/** 生成 ID 工具函数 */
let idCounter = 0;
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}
