import React from "react";
import type { ComponentRenderer } from "@a2ui/core";
import { ALIGNMENT_CSS } from "./constants";

// ═══════════════════════════════════════════════════════════════════════════
// A2UI v0.8 Standard Catalog — List 容器组件
// 协议属性：children (required: explicitList | template), direction (optional), alignment (optional)
// ═══════════════════════════════════════════════════════════════════════════

/** 协议层 List 组件属性 */
export interface ListProps {
  children: {
    explicitList?: string[];
    template?: { componentId: string; dataBinding: string };
  };
  direction?: "vertical" | "horizontal";
  alignment?: "start" | "center" | "end" | "stretch";
}

/** renderMap 入口：协议 props → ContainerVNode */
export const List: ComponentRenderer = (props, componentId?) => {
  const { children, direction = "vertical", alignment = "stretch" } = props;
  return {
    __a2ui_container: true,
    type: "List",
    props: { direction, alignment },
    componentId,
    childIds: children?.explicitList ?? [],
    template: children?.template ?? undefined,
  };
};

/** treeBuilder 解析后的 List 渲染属性 */
export interface ResolvedListProps {
  direction?: string;
  alignment?: string;
  componentId?: string;
}

/** React 渲染组件：VNode → DOM */
export function ListRenderer({
  direction,
  alignment,
  componentId,
  children,
}: ResolvedListProps & { children: React.ReactNode }) {
  return React.createElement("div", {
    id: componentId ?? undefined,
    style: {
      display: "flex",
      flexDirection: direction === "horizontal" ? "row" : "column",
      justifyContent: "flex-start",
      alignItems: ALIGNMENT_CSS[alignment ?? ""] ?? "stretch",
      gap: 8,
      padding: 8,
    },
  }, children);
}
