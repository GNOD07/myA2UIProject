import React, { useCallback } from "react";
import { useStore } from "./useStore";

export interface FadeInProps {
  /** 组件 ID，对应 HydrateNode.componentId */
  componentId: string;
  children: React.ReactNode;
}

/**
 * 标记清除淡入动画包装器。
 *
 * - 流式到达的新组件 hasMounted=false → 播放 0.3s 淡入动画
 * - 动画结束 → 调用 store.markMounted(componentId) 清除标记
 * - 已挂载组件（hasMounted !== false）→ 直接渲染，无动画
 */
export function FadeIn({ componentId, children }: FadeInProps) {
  const hasMounted = useStore(
    (s) => s.hydrateNodeMap[componentId]?.hasMounted ?? true,
  );
  const markMounted = useStore((s) => s.markMounted);

  const handleAnimationEnd = useCallback(() => {
    markMounted(componentId);
  }, [markMounted, componentId]);

  // 已挂载（或 store 中不存在该节点）→ 直接渲染
  if (hasMounted !== false) {
    return React.createElement(React.Fragment, null, children);
  }

  // 首次渲染 → 淡入动画
  return React.createElement(
    "div",
    {
      style: {
        animation: "a2ui-fade-in 0.3s ease-out forwards",
      },
      onAnimationEnd: handleAnimationEnd,
    },
    children,
  );
}
