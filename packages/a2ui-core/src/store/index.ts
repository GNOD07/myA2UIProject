/**
 * a2ui-core/store: 全局状态管理
 *
 * 使用 zustand/vanilla 实现，解除对 React 的依赖。
 * Store 是全局单例，通过 getStore() 获取实例。
 *
 * 核心设计：
 *  - 用空间换时间，所有实体通过 Map（Record）存储
 *  - 在 parser 阶段一次性构建好所需信息
 *  - 通过 id 高效查找、更新、删除
 */

import { createStore } from "zustand/vanilla";
import type { A2UIStore, RenderMap, TreeChangeCallback } from "./types";
import type { Surface, HydrateNode, A2UIError } from "./types";
import { isBoundValue, resolveBoundValue } from "../binding/index.js";
import { buildTree } from "../treeBuilder/index.js";

export type { A2UIStore } from "./types";
export * from "./types";

/**
 * 数据 Map 初始状态（不含 renderMap）
 */
const EMPTY_DATA = {
  surfaceMap: {} as Record<string, Surface>,
  hydrateNodeMap: {} as Record<string, HydrateNode>,
  errorMap: {} as Record<string, A2UIError>,
  dataModelMap: {} as Record<string, Record<string, any>>,
  dataModelVersion: 0,
};

/**
 * onTreeChange 节流间隔（毫秒）。
 * 100ms 平衡点：
 *  - SSE 服务端（50-150ms 间隔）→ 保留增量流式效果
 *  - playground 分块流（10ms 间隔）→ 合并防抖避免闪烁
 */
const TREE_CHANGE_DEBOUNCE_MS = 100;

/**
 * 创建 store 实例
 */
function createA2UIStore(
  renderMap: RenderMap = {},
  onTreeChange?: TreeChangeCallback,
  onUserAction?: (action: import("./types").UserActionPayload) => void,
) {
  // 节流状态：闭包变量，不放入 zustand state
  let treeChangeTimer: ReturnType<typeof setTimeout> | null = null;

  // 节流版 onTreeChange：合并高频调用，延迟到空闲后统一触发
  const debouncedTreeChange: TreeChangeCallback = () => {
    if (treeChangeTimer) clearTimeout(treeChangeTimer);
    treeChangeTimer = setTimeout(() => {
      treeChangeTimer = null;
      onTreeChange?.(buildTree());
    }, TREE_CHANGE_DEBOUNCE_MS);
  };

  return createStore<A2UIStore>()((set, get) => ({
    // 初始状态
    ...EMPTY_DATA,
    renderMap,
    onTreeChange: debouncedTreeChange,
    onUserAction,

    // ===== Surface CRUD =====

    addSurface: (surface: Surface) => {
      set((state) => ({
        surfaceMap: {
          ...state.surfaceMap,
          [surface.surfaceId]: surface,
        },
      }));
    },

    getSurface: (surfaceId: string) => {
      return get().surfaceMap[surfaceId];
    },

    updateSurface: (surfaceId: string, updates: Partial<Omit<Surface, "surfaceId">>) => {
      set((state) => {
        const existing = state.surfaceMap[surfaceId];
        if (!existing) return state;
        return {
          surfaceMap: {
            ...state.surfaceMap,
            [surfaceId]: { ...existing, ...updates },
          },
        };
      });
    },

    removeSurface: (surfaceId: string) => {
      set((state) => {
        const { [surfaceId]: _, ...rest } = state.surfaceMap;
        return { surfaceMap: rest };
      });
    },

    // ===== HydrateNode CRUD =====

    addHydrateNode: (node: HydrateNode) => {
      set((state) => ({
        hydrateNodeMap: {
          ...state.hydrateNodeMap,
          [node.componentId]: node,
        },
      }));
    },

    getHydrateNode: (componentId: string) => {
      return get().hydrateNodeMap[componentId];
    },

    updateHydrateNode: (
      componentId: string,
      updates: Partial<Omit<HydrateNode, "componentId">>,
    ) => {
      set((state) => {
        const existing = state.hydrateNodeMap[componentId];
        if (!existing) return state;
        return {
          hydrateNodeMap: {
            ...state.hydrateNodeMap,
            [componentId]: { ...existing, ...updates },
          },
        };
      });
    },

    removeHydrateNode: (componentId: string) => {
      set((state) => {
        const { [componentId]: _, ...rest } = state.hydrateNodeMap;
        return { hydrateNodeMap: rest };
      });
    },

    markMounted: (componentId: string) => {
      set((state) => {
        const existing = state.hydrateNodeMap[componentId];
        if (!existing || existing.hasMounted) return state;
        return {
          hydrateNodeMap: {
            ...state.hydrateNodeMap,
            [componentId]: { ...existing, hasMounted: true },
          },
        };
      });
    },

    // ===== Error CRUD =====

    addError: (error: A2UIError) => {
      set((state) => ({
        errorMap: {
          ...state.errorMap,
          [error.id]: error,
        },
      }));
    },

    getError: (errorId: string) => {
      return get().errorMap[errorId];
    },

    updateError: (errorId: string, updates: Partial<Omit<A2UIError, "id">>) => {
      set((state) => {
        const existing = state.errorMap[errorId];
        if (!existing) return state;
        return {
          errorMap: {
            ...state.errorMap,
            [errorId]: { ...existing, ...updates },
          },
        };
      });
    },

    removeError: (errorId: string) => {
      set((state) => {
        const { [errorId]: _, ...rest } = state.errorMap;
        return { errorMap: rest };
      });
    },

    // ===== 批量操作 =====

    clear: () => {
      set((state) => ({
        ...EMPTY_DATA,
        renderMap: state.renderMap,
        onTreeChange: state.onTreeChange,
      }));
    },

    clearSurface: (surfaceId: string) => {
      set((state) => {
        // 删除该 surface 关联的所有 hydrate nodes
        const newHydrateNodeMap = { ...state.hydrateNodeMap };
        for (const [componentId, node] of Object.entries(newHydrateNodeMap)) {
          if (node.ownerSurfaceId === surfaceId) {
            delete newHydrateNodeMap[componentId];
          }
        }

        // 删除该 surface 关联的所有 errors
        const newErrorMap = { ...state.errorMap };
        for (const [errorId, error] of Object.entries(newErrorMap)) {
          if (error.surfaceId === surfaceId) {
            delete newErrorMap[errorId];
          }
        }

        // 删除 surface 本身
        const { [surfaceId]: _, ...newSurfaceMap } = state.surfaceMap;

        // 删除该 surface 的 data model
        const { [surfaceId]: __, ...newDataModelMap } = state.dataModelMap;

        return {
          surfaceMap: newSurfaceMap,
          hydrateNodeMap: newHydrateNodeMap,
          errorMap: newErrorMap,
          dataModelMap: newDataModelMap,
        };
      });
    },

    // ===== Data Model CRUD =====

    setDataModelAt: (surfaceId: string, path: string | undefined, value: any) => {
      set((state) => {
        const current = state.dataModelMap[surfaceId] ?? {};

        // 根路径或 undefined → 浅合并到 data model 根
        if (path === undefined || path === '/' || path === '') {
          return {
            dataModelMap: {
              ...state.dataModelMap,
              [surfaceId]: { ...current, ...value },
            },
            dataModelVersion: state.dataModelVersion + 1,
          };
        }

        // 深层合并：沿路径查找/创建中间对象
        const segments = path.split('/').filter(Boolean);
        const newModel = JSON.parse(JSON.stringify(current)); // deep clone

        let target: Record<string, any> = newModel;
        for (let i = 0; i < segments.length - 1; i++) {
          if (typeof target[segments[i]] !== 'object' || target[segments[i]] === null) {
            target[segments[i]] = {};
          }
          target = target[segments[i]];
        }

        // 在叶子位置合并（如果已存在对象则合并，否则直接赋值）
        const existing = target[segments[segments.length - 1]];
        if (typeof existing === 'object' && existing !== null && !Array.isArray(existing) &&
            typeof value === 'object' && value !== null && !Array.isArray(value)) {
          target[segments[segments.length - 1]] = { ...existing, ...value };
        } else {
          target[segments[segments.length - 1]] = value;
        }

        return {
          dataModelMap: {
            ...state.dataModelMap,
            [surfaceId]: newModel,
          },
          dataModelVersion: state.dataModelVersion + 1,
        };
      });
    },

    getDataModel: (surfaceId: string) => {
      return get().dataModelMap[surfaceId];
    },

    getDataModelValue: (surfaceId: string, dataPath: string) => {
      const model = get().dataModelMap[surfaceId];
      if (!model) return undefined;

      const segments = dataPath.split('/').filter(Boolean);
      let current: any = model;
      for (const seg of segments) {
        if (current === null || typeof current !== 'object') return undefined;
        current = current[seg];
      }
      return current;
    },

    clearDataModel: (surfaceId: string) => {
      set((state) => {
        const { [surfaceId]: _, ...rest } = state.dataModelMap;
        return { dataModelMap: rest };
      });
    },

    // ===== User Action Dispatch =====

    dispatchAction: (
      componentId: string,
      action: { name: string; context?: Array<{ key: string; value: any }> },
    ) => {
      const state = get();
      const node = state.hydrateNodeMap[componentId];
      if (!node) return;
      const surfaceId = node.ownerSurfaceId;

      // 解析 context 中的 BoundValue
      const resolvedContext: Record<string, any> = {};
      if (action.context) {
        const dataModel = state.dataModelMap[surfaceId];
        for (const ctx of action.context) {
          if (isBoundValue(ctx.value)) {
            resolvedContext[ctx.key] = resolveBoundValue(ctx.value, dataModel);
          } else {
            resolvedContext[ctx.key] = ctx.value;
          }
        }
      }

      const payload: import("./types").UserActionPayload = {
        name: action.name,
        surfaceId,
        sourceComponentId: componentId,
        timestamp: new Date().toISOString(),
        context: resolvedContext,
      };

      // 同步回调：应用层在此回调中调用 setDataModelAt 等更新数据模型
      state.onUserAction?.(payload);

      // 重建组件树：此时数据模型已被 onUserAction 回调更新（zustand set 是同步的）
      state.onTreeChange?.(buildTree());
    },

    // ===== 流式节流 =====
    /**
     * 立即刷新组件树变更通知（跳过 debounce 等待）。
     * 批量加载完成或流式结束时调用，确保最终状态立即渲染。
     */
    flushTreeChange: () => {
      if (treeChangeTimer) {
        clearTimeout(treeChangeTimer);
        treeChangeTimer = null;
      }
      // 始终以最新 store 状态重建并通知
      onTreeChange?.(buildTree());
    },
  }));
}

/**
 * 全局 store 单例
 */
let storeInstance: ReturnType<typeof createA2UIStore> | null = null;

/**
 * 初始化全局 store
 * @param renderMap - 组件渲染映射表，由上层注入（如 a2ui-react 传入 React 渲染函数）
 * 创建单例 store 并返回。若已存在则直接返回现有实例，保证幂等。
 */
export function initStore(
  renderMap: RenderMap = {},
  onTreeChange?: TreeChangeCallback,
  onUserAction?: (action: import("./types").UserActionPayload) => void,
): ReturnType<typeof createA2UIStore> {
  if (!storeInstance) {
    storeInstance = createA2UIStore(renderMap, onTreeChange, onUserAction);
  }
  return storeInstance;
}

/**
 * 获取全局 store 实例
 * 如果实例不存在则创建，保证单例模式
 */
export function getStore(): ReturnType<typeof createA2UIStore> {
  if (!storeInstance) {
    storeInstance = createA2UIStore();
  }
  return storeInstance;
}

/**
 * 重置 store 状态（不销毁实例）
 */
export function resetStore(): void {
  if (storeInstance) {
    const currentRenderMap = storeInstance.getState().renderMap;
    storeInstance.setState({
      ...EMPTY_DATA,
      renderMap: currentRenderMap,
    });
  }
}

/**
 * 销毁 store 单例（主要用于测试）
 * 销毁后下次调用 initStore / getStore 会重新创建实例
 */
export function destroyStore(): void {
  storeInstance = null;
}
