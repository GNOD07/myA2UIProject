export interface SurfaceUpdateMessage {
  surfaceUpdate: {
    surfaceId: string;
    components: Array<{ id: string; component: Record<string, any> }>;
  };
}

export interface DataModelUpdateMessage {
  dataModelUpdate: {
    surfaceId: string;
    contents: Record<string, any>;
    path?: string;
  };
}

export interface BeginRenderingMessage {
  beginRendering: {
    surfaceId: string;
    root: string;
    catalogId?: string;
  };
}

export interface DeleteSurfaceMessage {
  deleteSurface: {
    surfaceId: string;
  };
}

export type A2UIMessage =
  | SurfaceUpdateMessage
  | DataModelUpdateMessage
  | BeginRenderingMessage
  | DeleteSurfaceMessage;

import type { HydrateNode } from "../store/types.js";

export interface ParsedResult {
  surfaces: Record<string, { components: Record<string, any> }>;
  hydrateNodeMap: Record<string, HydrateNode>;
  messagesByType: {
    surfaceUpdate: SurfaceUpdateMessage[];
    dataModelUpdate: DataModelUpdateMessage[];
    beginRendering: BeginRenderingMessage[];
    deleteSurface: DeleteSurfaceMessage[];
  };
}

export function parseJsonl(raw: string): A2UIMessage[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as A2UIMessage);
}

import { getStore } from "../store/index.js";
import { ErrorType } from "../store/types.js";
import { buildTree } from "../treeBuilder/index.js";

export function parseMessages(messages: any[]): ParsedResult {
  const result: ParsedResult = {
    surfaces: {},
    hydrateNodeMap: {},
    messagesByType: {
      surfaceUpdate: [],
      dataModelUpdate: [],
      beginRendering: [],
      deleteSurface: [],
    },
  };

  for (const message of messages) {
    if ('surfaceUpdate' in message) {
      result.messagesByType.surfaceUpdate.push(message as SurfaceUpdateMessage);
      const { surfaceId, components } = message.surfaceUpdate;
      if (!result.surfaces[surfaceId]) {
        result.surfaces[surfaceId] = { components: {} };
      }
      for (const component of components) {
        result.surfaces[surfaceId].components[component.id] = component;
        result.hydrateNodeMap[component.id] = {
          componentId: component.id,
          ownerSurfaceId: surfaceId,
          protocol: JSON.stringify(message),
          _vnode: component.component,
          hasMounted: false,
        };
      }
    } else if ('dataModelUpdate' in message) {
      result.messagesByType.dataModelUpdate.push(message as DataModelUpdateMessage);
    } else if ('beginRendering' in message) {
      result.messagesByType.beginRendering.push(message as BeginRenderingMessage);
    } else if ('deleteSurface' in message) {
      result.messagesByType.deleteSurface.push(message as DeleteSurfaceMessage);
    }
  }

  return result;
}

/**
 * 处理单条 A2UI 消息并增量更新 store。
 *
 * 这是流式处理的核心：每条消息到达后立即更新 store，
 * 而不是等所有消息收集完再批量处理。
 *
 * 支持的消息类型：
 *  - surfaceUpdate：注册组件节点 + 创建/更新 Surface
 *  - dataModelUpdate：数据模型更新（当前仅追踪）
 *  - beginRendering：标记 Surface 可渲染 + 设置根节点
 *  - deleteSurface：清空 Surface 及其关联数据
 */
export function processMessage(message: A2UIMessage): void {
  const store = getStore();
  const storeState = store.getState();

  if ("surfaceUpdate" in message) {
    const { surfaceId, components } = message.surfaceUpdate;

    // 1. 注册所有组件为 hydrateNode
    for (const component of components) {
      const compType = Object.keys(component.component)[0];
      const compProps = component.component[compType];
      const renderFn = storeState.renderMap[compType];

      if (!renderFn) {
        storeState.addError({
          id: `renderer_not_found-${surfaceId}-${component.id}-${compType}`,
          type: ErrorType.RENDERER_NOT_FOUND,
          content: `Component type "${compType}" is not registered in renderMap. Component "${component.id}" in surface "${surfaceId}" will not be rendered.`,
          surfaceId,
          componentId: component.id,
        });
      }

      storeState.addHydrateNode({
        componentId: component.id,
        _vnode: renderFn ? renderFn(compProps, component.id) : component.component,
        ownerSurfaceId: surfaceId,
        protocol: JSON.stringify(component),
        hasMounted: false, // 标记清除初始态：尚未挂载，触发淡入动画
      });
    }

    // 2. 确保 Surface 存在（后续 beginRendering 会更新 rootNode）
    const existingSurface = storeState.getSurface(surfaceId);
    if (!existingSurface) {
      storeState.addSurface({
        surfaceId,
        beginRender: false,
        rootNode: null,
      });
    }
  } else if ("dataModelUpdate" in message) {
    // 数据模型更新：当前仅追踪，后续可扩展 dataModelMap 存储
    // 保留此分支供未来按 path 更新组件 props
  } else if ("beginRendering" in message) {
    const { surfaceId, root } = message.beginRendering;

    // 确保 Surface 存在（处理 beginRendering 先于 surfaceUpdate 到达的边缘情况）
    const existingSurface = storeState.getSurface(surfaceId);
    if (!existingSurface) {
      storeState.addSurface({
        surfaceId,
        beginRender: false,
        rootNode: null,
      });
    }

    const rootNode = storeState.getHydrateNode(root) ?? null;
    storeState.updateSurface(surfaceId, {
      beginRender: true,
      rootNode,
    });
  } else if ("deleteSurface" in message) {
    storeState.clearSurface(message.deleteSurface.surfaceId);
  }

  // SDK 驱动：通知外部组件树已变更
  storeState.onTreeChange?.(buildTree());
}

export function loadJsonlIntoStore(raw: string): ParsedResult {
  const messages = parseJsonl(raw);

  // 流式处理每条消息 → 增量更新 store
  for (const message of messages) {
    processMessage(message);
  }

  // 返回 ParsedResult 保持向后兼容
  return parseMessages(messages);
}

// ============================================================
// StreamProcessor — 集成缓冲区的流式解析器
// ============================================================

import { AutoCompleteBuffer } from "../buffer/index.js";

/**
 * 每次成功处理一条消息后的回调
 */
export type MessageCallback = (message: A2UIMessage) => void;

/**
 * 流式处理器：将缓冲区集成到 processMessage 调用链中。
 *
 * 用法：
 * ```
 * const sp = new StreamProcessor();
 * sp.feed('{"surfaceUpdate":{"surfa');   // 不完整 → 暂存
 * sp.feed('ceId":"s1","components":[...  // 拼出完整 JSON → processMessage
 * sp.flush();                              // 冲刷残留
 * ```
 */
export class StreamProcessor {
  private _buffer = new AutoCompleteBuffer();

  /**
   * @param onMessage - 每条消息处理完后的回调（可选）
   */
  constructor(private _onMessage?: MessageCallback) {}

  /** 喂入一个原始文本 chunk，内部自动缓冲、补全、解析、处理 */
  feed(chunk: string): void {
    const jsonStrings = this._buffer.feed(chunk);
    for (const raw of jsonStrings) {
      this._processOne(raw);
    }
  }

  /** 冲刷缓冲区残留 */
  flush(): void {
    const jsonStrings = this._buffer.flush();
    for (const raw of jsonStrings) {
      this._processOne(raw);
    }
  }

  /** 清空缓冲区（丢弃所有未处理数据） */
  reset(): void {
    this._buffer.reset();
  }

  private _processOne(raw: string): void {
    let message: A2UIMessage;
    try {
      message = JSON.parse(raw) as A2UIMessage;
    } catch (e) {
      const storeState = getStore().getState();
      storeState.addError({
        id: `stream_parse_error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: ErrorType.PARSE_ERROR,
        content: `StreamProcessor: failed to parse JSON. ${(e as Error).message}. Raw: ${raw.slice(0, 100)}`,
      });
      return;
    }

    processMessage(message);
    this._onMessage?.(message);
  }
}
