import React from "react";
import type { ComponentRenderer } from "@a2ui/core";

// ═══════════════════════════════════════════════════════════════════════════
// A2UI v0.8 Standard Catalog — Card 容器组件
// 协议属性：child (required)
// ═══════════════════════════════════════════════════════════════════════════

/** 协议层 Card 组件属性 */
export interface CardProps {
  child: string;
}

/** renderMap 入口：协议 props → ContainerVNode */
export const Card: ComponentRenderer = (props, componentId?) => {
  const { child } = props;
  return {
    __a2ui_container: true,
    type: "Card",
    props: { style: props.style },
    componentId,
    childIds: child ? [child] : [],
  };
};

/** treeBuilder 解析后的 Card 渲染属性 */
export interface ResolvedCardProps {
  componentId?: string;
  style?: Record<string, any>;
}

/** React 渲染组件：VNode → DOM */
export function CardRenderer({
  componentId,
  style,
  children,
}: ResolvedCardProps & { children: React.ReactNode }) {
  return React.createElement("div", {
    id: componentId ?? undefined,
    style: {
      background: "#fff",
      border: "1px solid #e8e8e8",
      borderRadius: 12,
      padding: 20,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      ...(style ?? {}),
    },
  }, children);
}
