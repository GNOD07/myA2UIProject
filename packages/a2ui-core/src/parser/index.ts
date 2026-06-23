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

export function loadJsonlIntoStore(raw: string): ParsedResult {
  const messages = parseJsonl(raw);
  const parsed = parseMessages(messages);
  const store = getStore();
  const storeState = store.getState();
  const beginRendering = parsed.messagesByType.beginRendering[0];

  // 先将所有组件节点添加到 hydrateNodeMap
  Object.entries(parsed.surfaces).forEach(([surfaceId, surface]) => {
    Object.entries(surface.components).forEach(([componentId, component]) => {
      // 从 component.component 中提取组件类型（如 "Text"）和 props
      const compType = Object.keys(component.component)[0];
      const compProps = component.component[compType];
      const renderFn = storeState.renderMap[compType];

      // 检查组件类型是否已在 renderMap 中注册
      if (!renderFn) {
        storeState.addError({
          id: `renderer_not_found-${surfaceId}-${componentId}-${compType}`,
          type: ErrorType.RENDERER_NOT_FOUND,
          content: `Component type "${compType}" is not registered in renderMap. Component "${componentId}" in surface "${surfaceId}" will not be rendered.`,
          surfaceId,
          componentId,
        });
      }

      storeState.addHydrateNode({
        componentId,
        // 若 renderMap 中有对应的渲染函数则调用，否则保留原始 component 数据
        _vnode: renderFn ? renderFn(compProps) : component.component,
        ownerSurfaceId: surfaceId,
        protocol: JSON.stringify(component),
      });
    });
  });

  // 再添加 surface，此时 rootNode 可以直接指向 hydrateNodeMap 中的实例
  Object.entries(parsed.surfaces).forEach(([surfaceId]) => {
    const rootComponentId = beginRendering?.beginRendering.surfaceId === surfaceId
      ? beginRendering.beginRendering.root
      : null;
    const rootNode = rootComponentId
      ? storeState.getHydrateNode(rootComponentId) ?? null
      : null;

    storeState.addSurface({
      surfaceId,
      beginRender: !!rootNode,
      rootNode,
    });
  });

  parsed.messagesByType.deleteSurface.forEach((message) => {
    storeState.clearSurface(message.deleteSurface.surfaceId);
  });

  return parsed;
}
