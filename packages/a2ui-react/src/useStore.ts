import { useStore as useZustandStore } from "zustand";
import type { A2UIStore } from "@a2ui/core";
import { getStore } from "@a2ui/core";

/**
 * React hook to use the A2UI store
 *
 * @example
 * ```tsx
 * const surfaceMap = useStore((state) => state.surfaceMap);
 * const addSurface = useStore((state) => state.addSurface);
 * ```
 */
export function useStore<T>(selector: (state: A2UIStore) => T): T {
  const store = getStore();
  return useZustandStore(store, selector);
}

/**
 * React hook to get the root HydrateNode for a given surface.
 * rootNode 本身已是指向 hydrateNodeMap 中实例的指针，直接返回即可。
 */
export function useRootNode(surfaceId: string) {
  return useStore((state) => {
    const surface = state.surfaceMap[surfaceId];
    return surface?.rootNode ?? null;
  });
}
