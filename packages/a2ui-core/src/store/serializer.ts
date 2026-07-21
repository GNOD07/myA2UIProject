/**
 * a2ui-core/store/serializer: Store → A2UI JSONL 序列化器
 *
 * 将当前 store 状态反向序列化为 A2UI JSONL 协议文本。
 * 用于多轮对话场景：将当前渲染的 UI 协议发送给 Agent 作为上下文，
 * 让 Agent 基于现有 UI 进行增量微调。
 */

import { getStore } from "./index.js";
import type { DataModelEntry } from "../binding/index.js";

/**
 * 序列化选项
 */
export interface SerializeStoreOptions {
  /**
   * 是否包含 beginRendering 消息。
   * 微调场景下可设为 false，但推荐包含以提供完整上下文。
   * @default true
   */
  includeBeginRendering?: boolean;
}

/**
 * 将嵌套 JS 对象还原为 dataModelUpdate.contents 邻接表格式。
 *
 * 逆向操作：parseAdjacencyListToObject 将邻接表 → 嵌套对象，
 * 本函数将嵌套对象 → 邻接表。
 *
 * @example
 *   { user: { name: "Bob", age: 25 } }
 *   → [{ key: "user", valueMap: [{ key: "name", valueString: "Bob" }, { key: "age", valueNumber: 25 }] }]
 */
function dataModelToEntries(obj: Record<string, any>): DataModelEntry[] {
  const entries: DataModelEntry[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (typeof value === "object" && !Array.isArray(value)) {
      // 嵌套对象 → valueMap
      const subEntries = dataModelToEntries(value);
      if (subEntries.length > 0) {
        entries.push({ key, valueMap: subEntries as any });
      }
    } else if (typeof value === "string") {
      entries.push({ key, valueString: value });
    } else if (typeof value === "number") {
      entries.push({ key, valueNumber: value });
    } else if (typeof value === "boolean") {
      entries.push({ key, valueBoolean: value });
    }
    // 跳过数组和其他不支持的类型
  }

  return entries;
}

/**
 * 生成 A2UI JSONL 消息行数组（不含换行符）。
 * 每项为一行完整的 JSON 字符串。
 *
 * @internal 供 serializeStore 和测试使用
 */
export function serializeStoreToLines(options: SerializeStoreOptions = {}): string[] {
  const { includeBeginRendering = true } = options;
  const state = getStore().getState();
  const lines: string[] = [];

  for (const surfaceId of Object.keys(state.surfaceMap)) {
    const surface = state.surfaceMap[surfaceId];

    // 1. beginRendering（可选）
    if (includeBeginRendering && surface.rootComponentId) {
      lines.push(
        JSON.stringify({
          beginRendering: {
            surfaceId,
            root: surface.rootComponentId,
          },
        })
      );
    }

    // 2. surfaceUpdate：收集该 surface 下的所有组件
    const components: any[] = [];
    for (const node of Object.values(state.hydrateNodeMap)) {
      if (node.ownerSurfaceId !== surfaceId) continue;
      try {
        // node.protocol 存储的是单组件 JSON，如 {"id":"t1","component":{"Text":{...}}}
        const comp = JSON.parse(node.protocol);
        components.push(comp);
      } catch {
        // 解析失败则跳过（极端情况：protocol 被意外损坏）
      }
    }

    if (components.length > 0) {
      lines.push(
        JSON.stringify({
          surfaceUpdate: { surfaceId, components },
        })
      );
    }

    // 3. dataModelUpdate：序列化数据模型
    const dataModel = state.dataModelMap[surfaceId];
    if (dataModel && typeof dataModel === "object" && Object.keys(dataModel).length > 0) {
      const contents = dataModelToEntries(dataModel);
      if (contents.length > 0) {
        lines.push(
          JSON.stringify({
            dataModelUpdate: { surfaceId, contents },
          })
        );
      }
    }
  }

  return lines;
}

/**
 * 将当前 store 状态序列化为 A2UI JSONL 字符串。
 *
 * 返回的字符串可直接作为 currentProtocol 发送给 LLM，
 * 也可以用于持久化、调试等场景。
 *
 * @param options - 序列化选项
 * @returns 完整的 JSONL 文本（每行一个 JSON 对象，换行符 \\n 分隔）
 *
 * @example
 * ```typescript
 * const jsonl = serializeStore();
 * // 输出示例：
 * // {"beginRendering":{"surfaceId":"main","root":"root-col"}}
 * // {"surfaceUpdate":{"surfaceId":"main","components":[...]}}
 * // {"dataModelUpdate":{"surfaceId":"main","contents":[...]}}
 * ```
 */
export function serializeStore(options: SerializeStoreOptions = {}): string {
  const lines = serializeStoreToLines(options);
  return lines.join("\n");
}
