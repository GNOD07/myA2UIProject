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

export type { A2UIStore } from "./types";
export * from "./types";

/**
 * 数据 Map 初始状态（不含 renderMap）
 */
const EMPTY_DATA = {
  surfaceMap: {} as Record<string, Surface>,
  hydrateNodeMap: {} as Record<string, HydrateNode>,
  errorMap: {} as Record<string, A2UIError>,
};

/**
 * 创建 store 实例
 */
function createA2UIStore(renderMap: RenderMap = {}, onTreeChange?: TreeChangeCallback) {
  return createStore<A2UIStore>()((set, get) => ({
    // 初始状态
    ...EMPTY_DATA,
    renderMap,
    onTreeChange,

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

        return {
          surfaceMap: newSurfaceMap,
          hydrateNodeMap: newHydrateNodeMap,
          errorMap: newErrorMap,
        };
      });
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
): ReturnType<typeof createA2UIStore> {
  if (!storeInstance) {
    storeInstance = createA2UIStore(renderMap, onTreeChange);
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
