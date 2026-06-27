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

// ============================================================
// 原始 JSON Stream 缓冲器（无 \n 分隔符的原始 JSON 流）
// ============================================================

/**
 * 原始 JSON Stream 缓冲器
 *
 * 适用场景：LLM 逐 token 输出原始 JSON（无 \n 分隔符），
 * 50 字符/50ms 这样的随机切分到达。
 *
 * 通过 { } 括号计数（忽略字符串内）来检测完整 JSON 对象，
 * 不依赖 `\n` 作为消息分隔符。
 */
export class StreamBuffer {
  private _buffer = "";

  /**
   * 喂入一个原始文本 chunk，返回本次可提取的完整 JSON 对象字符串数组。
   * 不完整的尾部保留在内部缓冲中。
   */
  feed(chunk: string): string[] {
    this._buffer += chunk;
    return this._extractComplete();
  }

  /** 冲刷最后残留（可能是不完整的，尝试解析） */
  flush(): string[] {
    const remaining = this._buffer.trim();
    this._buffer = "";
    return remaining ? [remaining] : [];
  }

  reset(): void {
    this._buffer = "";
  }

  /**
   * 括号计数状态机：扫描 _buffer，每当顶层 { } 配对闭合时切出一个完整 JSON。
   * 正确处理字符串字面量和转义字符。
   */
  private _extractComplete(): string[] {
    const complete: string[] = [];
    let depth = 0;
    let inString = false;
    let escape = false;
    let start = 0;

    for (let i = 0; i < this._buffer.length; i++) {
      const ch = this._buffer[i];

      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          complete.push(this._buffer.slice(start, i + 1));
          start = i + 1;
        }
      }
    }

    this._buffer = this._buffer.slice(start);
    return complete;
  }
}

/**
 * 将包含多个 component 的 surfaceUpdate 拆成 N 条单组件消息。
 *
 * 示例输入：
 *   { surfaceUpdate: { surfaceId: "s1", components: [A, B, C] } }
 *
 * 输出 3 条：
 *   { surfaceUpdate: { surfaceId: "s1", components: [A] } }
 *   { surfaceUpdate: { surfaceId: "s1", components: [B] } }
 *   { surfaceUpdate: { surfaceId: "s1", components: [C] } }
 *
 * 非 surfaceUpdate 消息原样返回（数组包装）。
 */
export function splitSurfaceUpdate(message: A2UIMessage): A2UIMessage[] {
  if (!("surfaceUpdate" in message)) {
    return [message];
  }

  const { surfaceId, components } = message.surfaceUpdate;
  return components.map((comp) => ({
    surfaceUpdate: { surfaceId, components: [comp] },
  }));
}

/**
 * 处理原始 JSON Stream chunk：
 * 1. StreamBuffer 提取完整 JSON 对象
 * 2. JSON.parse → A2UIMessage
 * 3. splitSurfaceUpdate → 拆为单组件消息
 * 4. 每条消息 processMessage + onMessage 回调
 */
export function processStreamChunk(
  chunk: string,
  buffer: StreamBuffer,
  opts?: StreamOptions,
): void {
  const jsonStrings = buffer.feed(chunk);
  for (const raw of jsonStrings) {
    _processStreamJson(raw, opts);
  }
}

/** 冲刷 StreamBuffer 残留 */
export function flushStreamBuffer(
  buffer: StreamBuffer,
  opts?: StreamOptions,
): void {
  const jsonStrings = buffer.flush();
  for (const raw of jsonStrings) {
    _processStreamJson(raw, opts);
  }
}

function _processStreamJson(raw: string, opts?: StreamOptions): void {
  let message: A2UIMessage;
  try {
    message = JSON.parse(raw) as A2UIMessage;
  } catch (e) {
    const storeState = getStore().getState();
    storeState.addError({
      id: `stream_parse_error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: ErrorType.PARSE_ERROR,
      content: `StreamBuffer: failed to parse JSON. ${(e as Error).message}. Raw: ${raw.slice(0, 100)}`,
    });
    return;
  }

  // 拆分多组件 surfaceUpdate → 每条一个 component
  const messages = splitSurfaceUpdate(message);
  for (const msg of messages) {
    processMessage(msg);
    opts?.onMessage?.(msg);
  }
}

// ============================================================
// AutoCompleteBuffer — JSON.parse 试解析 + 组件边界补全
// ============================================================

/**
 * 自动补全缓冲器。
 *
 * 适用场景：LLM 逐 token 输出原始 JSON，可能在任意位置截断。
 * 不依赖 `\n`，也不依赖完整的 JSON 对象 —— 当 JSON.parse 失败时，
 * 扫描 components 数组内已完整的组件对象，自动用 `]}}` 补全结束符，
 * 包装为标准 surfaceUpdate 消息逐条产出。
 *
 * 处理流程：
 * 1. 累计 chunk
 * 2. 解析 surfaceId（首次出现时记录）
 * 3. 找到 `"components": [` 后的数组中，按 `{...}` 边界扫描完整组件
 * 4. 每个完整组件 → 包装为独立 `surfaceUpdate` JSON → 产出
 * 5. 未完成的组件片段保留在缓冲中等待后续 chunk
 */
export class AutoCompleteBuffer {
  private _buffer = "";
  private _surfaceId: string | null = null;
  /** 正则匹配 components 数组内组件边界：},{"id":"  */
  private static readonly _BOUNDARY_RE = /,(\s*)\{(\s*)"id"(\s*):(\s*)"/g;

  feed(chunk: string): string[] {
    this._buffer += chunk;
    const raw = this._autoComplete();
    return raw.map((r) => this._wrapIfBare(r));
  }

  flush(): string[] {
    const remaining = this._buffer.trim();
    this._buffer = "";
    this._surfaceId = null;
    if (!remaining) return [];

    // 1. 直接解析
    try {
      const parsed = JSON.parse(remaining);
      return [this._wrapIfBare(remaining, parsed)];
    } catch {}

    // 2. 尝试补全闭合（加 `}...]}}`）
    for (let extra = 0; extra <= 10; extra++) {
      const closed = remaining + '}'.repeat(extra) + ']}}';
      try {
        const parsed = JSON.parse(closed);
        return [this._wrapIfBare(closed, parsed)];
      } catch {}
    }

    // 3. 无法挽救，丢弃
    return [];
  }

  /** 若产出的是裸 component 对象 {"id":"...","component":{...}}，用 surfaceId 包装 */
  private _wrapIfBare(raw: string, preParsed?: unknown): string {
    if (!this._surfaceId) return raw;
    try {
      const parsed = preParsed ?? JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'id' in parsed && 'component' in parsed && !('surfaceUpdate' in parsed)) {
        return JSON.stringify({
          surfaceUpdate: {
            surfaceId: this._surfaceId,
            components: [parsed],
          },
        });
      }
    } catch {}
    return raw;
  }

  reset(): void {
    this._buffer = "";
    this._surfaceId = null;
  }

  // ---- 内部实现 ----

  private _autoComplete(): string[] {
    const results: string[] = [];

    if (!this._surfaceId) {
      const m = this._buffer.match(/"surfaceId"\s*:\s*"([^"]+)"/);
      if (m) this._surfaceId = m[1];
    }

    let progress = true;
    while (progress) {
      progress = false;

      // 策略 0: 直接 JSON.parse 成功 → 整段产出
      if (this._tryDirect()) {
        results.push(this._buffer);
        this._buffer = "";
        this._surfaceId = null;
        progress = true;
        continue;
      }

      // 策略 1: 括号计数提取第一个完整 JSON 对象
      const firstJson = this._extractFirstJson();
      if (firstJson) {
        results.push(firstJson);
        progress = true;
        continue;
      }

      // 策略 2: 在最后一个组件边界处截断 + 补全 `]}}`
      if (this._buffer.includes('"components":[') && this._surfaceId) {
        const extracted = this._extractAtBoundary();
        if (extracted) {
          results.push(extracted);
          progress = true;
        }
        // 无边界时不做提前闭合 —— 等更多 chunk 或 flush
      }
    }

    return results;
  }

  /**
   * 找到 components 数组中最后一个完整组件的边界（`},{"id":"`），
   * 截断并补全 `]}}` 产出。后缀保留不完整部分 + 后续消息。
   */
  private _extractAtBoundary(): string | null {
    const boundaries: number[] = [];
    const re = /,(\s*)\{(\s*)"id"(\s*):(\s*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this._buffer)) !== null) {
      boundaries.push(m.index);
    }
    if (boundaries.length === 0) return null;

    const cutIdx = boundaries[boundaries.length - 1];
    const prefix = this._buffer.slice(0, cutIdx);
    // 后缀：从 `{"id":"` 开始（去掉前导逗号）
    let suffix = this._buffer.slice(cutIdx + 1);

    const closed = prefix + ']}}';
    try { JSON.parse(closed); } catch { return null; }

    // 后缀中可能包含原始消息的 `]}}` + 后续 JSON 对象
    // 用 `}}` + `{` 精确匹配消息边界（区别于组件间的 `},{`）
    const doubleClose = suffix.indexOf('}}');
    if (doubleClose !== -1) {
      const after = suffix.slice(doubleClose + 2);
      const nextBrace = after.search(/\s*\{/);
      if (nextBrace !== -1) {
        const braceIdx = doubleClose + 2 + nextBrace; // `{` 开始下一段消息
        const leftover = suffix.slice(braceIdx); // `{beginRendering...`
        suffix = suffix.slice(0, doubleClose + 2); // 到 `}}` 为止
        if (suffix.trim().startsWith('{')) {
          this._buffer =
            `{"surfaceUpdate":{"surfaceId":"${this._surfaceId}","components":[` +
            suffix +
            leftover;
        } else {
          this._buffer = leftover;
          this._surfaceId = null;
        }
        return closed;
      }
    }
    // 无消息边界 → 常规重建
    if (suffix.trim().startsWith('{')) {
      this._buffer =
        `{"surfaceUpdate":{"surfaceId":"${this._surfaceId}","components":[` + suffix;
    } else {
      this._buffer = suffix;
      this._surfaceId = null;
    }

    return closed;
  }

  /** 无边界兜底：尝试补加 `}...]}}` 闭合不完整组件 */
  private _closeIncomplete(): string | null {
    for (let extra = 0; extra <= 10; extra++) {
      const closed = this._buffer + '}'.repeat(extra) + ']}}';
      try {
        JSON.parse(closed);
        // 成功后 buffer 清空（closed 包含了全部当前数据）
        this._buffer = '';
        this._surfaceId = null;
        return closed;
      } catch {}
    }
    return null;
  }

  /** 括号计数提取第一个完整 JSON 对象 */
  private _extractFirstJson(): string | null {
    let depth = 0, inStr = false, esc = false, start = -1;

    for (let i = 0; i < this._buffer.length; i++) {
      const ch = this._buffer[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          const candidate = this._buffer.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            // 兜底：若提取出来的是裸 component 对象，用记录的 surfaceId 包装
            if (parsed.id && parsed.component && this._surfaceId) {
              const wrapped = JSON.stringify({
                surfaceUpdate: {
                  surfaceId: this._surfaceId,
                  components: [parsed],
                },
              });
              this._buffer = this._buffer.slice(0, start) + this._buffer.slice(i + 1);
              return wrapped;
            }
            // 正常消息（surfaceUpdate / beginRendering / dataModelUpdate）
            this._buffer = this._buffer.slice(0, start) + this._buffer.slice(i + 1);
            // 仅在消费非 surfaceUpdate 消息时重置 surfaceId
            if (!parsed.surfaceUpdate) {
              this._surfaceId = null;
            }
            return candidate;
          } catch {
            start = i + 1;
            continue;
          }
        }
      }
    }
    return null;
  }

  private _tryDirect(): boolean {
    try { JSON.parse(this._buffer); return true; } catch { return false; }
  }
}

/**
 * 处理原始 JSON Stream chunk，使用自动补全缓冲器。
 */
export function processAutoCompleteChunk(
  chunk: string,
  buffer: AutoCompleteBuffer,
  opts?: StreamOptions,
): void {
  const jsonStrings = buffer.feed(chunk);
  for (const raw of jsonStrings) {
    _processLine(raw, opts); // surfaceUpdate 已被包装为单组件，直接按行处理
  }
}

/** 冲刷 AutoCompleteBuffer 残留 */
export function flushAutoCompleteBuffer(
  buffer: AutoCompleteBuffer,
  opts?: StreamOptions,
): void {
  const jsonStrings = buffer.flush();
  for (const raw of jsonStrings) {
    _processLine(raw, opts);
  }
}
