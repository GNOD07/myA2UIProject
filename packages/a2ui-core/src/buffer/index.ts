/**
 * a2ui-core/buffer: JSONL 流式缓冲器
 *
 * 在流式传输 A2UI 协议（JSONL）的场景下，数据以不定长的 chunk 到达。
 * A2UIBuffer 负责：
 *  - 累积 chunk 片段
 *  - 按换行符切分完整的 JSON 行
 *  - 保留不完整的尾部片段供下次 feed 拼接
 *
 * 配合 processMessage() 实现流式增量处理：
 *   chunk → buffer.feed() → JSON.parse → processMessage() → store 更新
 */

import { getStore } from "../store/index.js";
import { ErrorType } from "../store/types.js";
import type { A2UIMessage } from "../parser/index.js";
import { processMessage } from "../parser/index.js";

/**
 * JSONL 流式缓冲器
 *
 * 用法：
 * ```
 * const buffer = new A2UIBuffer();
 * buffer.feed('{"surfaceUpdate":{...}}\\n{"dataM');  // → ['{"surfaceUpdate":{...}}']
 * buffer.feed('odelUpdate":{...}}\\n');                // → ['{"dataModelUpdate":{...}}']
 * buffer.flush();                                      // → [] （无残留）
 * ```
 */
export class A2UIBuffer {
  private _buffer = "";

  /**
   * 喂入一个文本 chunk，返回本次可提取的完整 JSON 行数组。
   * 不完整的尾部会保留在内部缓冲中，等待下一次 feed 拼接。
   *
   * @param chunk - 原始文本片段（可能包含多个换行，可能是不完整的行尾）
   * @returns 完整的 JSON 字符串数组（已去除空行）
   */
  feed(chunk: string): string[] {
    this._buffer += chunk;
    const lines = this._buffer.split("\n");
    // 最后一段可能是未完成的行 → 保留在缓冲区
    this._buffer = lines.pop() ?? "";
    return lines.filter((line) => line.trim() !== "");
  }

  /**
   * 冲刷缓冲区：返回最后残留的内容（如果有），并清空内部缓冲。
   * 在流结束时调用，确保不丢失最后一行（可能没有尾随换行）。
   *
   * @returns 残留的 JSON 字符串数组（最多 1 个元素）
   */
  flush(): string[] {
    const remaining = this._buffer.trim();
    this._buffer = "";
    return remaining ? [remaining] : [];
  }

  /** 清空缓冲区（丢弃所有未处理的数据） */
  reset(): void {
    this._buffer = "";
  }
}

/**
 * 流式处理选项
 */
export interface StreamOptions {
  /**
   * 每条消息处理完成后的回调。
   * 用于流式通知调用方（如 UI 增量渲染、日志等）。
   *
   * @param message - 已解析并处理完成的 A2UI 消息
   */
  onMessage?: (message: A2UIMessage) => void;
}

/**
 * 喂入一个 JSONL chunk 并处理其中所有完整的消息行。
 *
 * 内部流程：
 * 1. buffer.feed(chunk) → 提取完整行
 * 2. 每行 JSON.parse → A2UIMessage
 * 3. processMessage(message) → 更新 store
 * 4. opts.onMessage?.(message)  → 通知调用方
 *
 * @param chunk  - 原始 JSONL 文本片段
 * @param buffer - A2UIBuffer 实例
 * @param opts   - 可选配置（onMessage 回调等）
 */
export function feedJsonlChunk(
  chunk: string,
  buffer: A2UIBuffer,
  opts?: StreamOptions,
): void {
  const lines = buffer.feed(chunk);
  for (const line of lines) {
    _processLine(line, opts);
  }
}

/**
 * 冲刷缓冲区的残留数据并处理。
 * 在流结束时调用。
 *
 * @param buffer - A2UIBuffer 实例
 * @param opts   - 可选配置（onMessage 回调等）
 */
export function flushJsonlBuffer(
  buffer: A2UIBuffer,
  opts?: StreamOptions,
): void {
  const lines = buffer.flush();
  for (const line of lines) {
    _processLine(line, opts);
  }
}

/**
 * 解析并处理单行 JSON 文本
 */
function _processLine(line: string, opts?: StreamOptions): void {
  let message: A2UIMessage;
  try {
    message = JSON.parse(line) as A2UIMessage;
  } catch (e) {
    const storeState = getStore().getState();
    storeState.addError({
      id: `parse_error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: ErrorType.PARSE_ERROR,
      content: `Failed to parse JSONL line: ${(e as Error).message}. Line: ${line.slice(0, 100)}`,
    });
    return;
  }

  processMessage(message);
  opts?.onMessage?.(message);
}
