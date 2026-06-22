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

export interface HydrateNode {
  componentId: string;
  _vnode: any;
  ownerSurfaceId: string;
  protocol: string;
}

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

  Object.entries(parsed.surfaces).forEach(([surfaceId, surface]) => {
    const rootNode = beginRendering?.beginRendering.surfaceId === surfaceId ? beginRendering.beginRendering.root : null;
    storeState.addSurface({
      surfaceId,
      beginRender: !!rootNode,
      rootNode,
    });

    Object.entries(surface.components).forEach(([componentId, component]) => {
      storeState.addHydrateNode({
        componentId,
        _vnode: component.component,
        ownerSurfaceId: surfaceId,
        protocol: JSON.stringify(component),
      });
    });
  });

  parsed.messagesByType.deleteSurface.forEach((message) => {
    storeState.clearSurface(message.deleteSurface.surfaceId);
  });

  return parsed;
}
