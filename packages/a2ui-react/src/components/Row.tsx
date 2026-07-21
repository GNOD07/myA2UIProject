import React from "react";
import type { ComponentRenderer } from "@a2ui/core";
import { DISTRIBUTION_CSS, ALIGNMENT_CSS } from "./constants";

// ═══════════════════════════════════════════════════════════════════════════
// A2UI v0.8 Standard Catalog — Row 容器组件
// 协议属性：children (required: explicitList | template), distribution (optional), alignment (optional)
// ═══════════════════════════════════════════════════════════════════════════

/** 协议层 Row 组件属性 */
export interface RowProps {
  children: {
    explicitList?: string[];
    template?: { componentId: string; dataBinding: string };
  };
  distribution?: "start" | "center" | "end" | "spaceAround" | "spaceBetween" | "spaceEvenly";
  alignment?: "start" | "center" | "end" | "stretch";
}

/** renderMap 入口：协议 props → ContainerVNode */
export const Row: ComponentRenderer = (props, componentId?) => {
  const { children, distribution = "start", alignment = "stretch" } = props;
  return {
    __a2ui_container: true,
    type: "Row",
    props: { distribution, alignment, style: props.style },
    componentId,
    childIds: children?.explicitList ?? [],
    template: children?.template ?? undefined,
  };
};

/** treeBuilder 解析后的 Row 渲染属性 */
export interface ResolvedRowProps {
  distribution?: string;
  alignment?: string;
  componentId?: string;
  style?: Record<string, any>;
}

/** React 渲染组件：VNode → DOM */
export function RowRenderer({
  distribution,
  alignment,
  componentId,
  style,
  children,
}: ResolvedRowProps & { children: React.ReactNode }) {
  return React.createElement("div", {
    id: componentId ?? undefined,
    style: {
      display: "flex",
      flexDirection: "row",
      justifyContent: DISTRIBUTION_CSS[distribution ?? ""] ?? "flex-start",
      alignItems: ALIGNMENT_CSS[alignment ?? ""] ?? "stretch",
      gap: 8,
      padding: 8,
      border: "1px dashed #bae7ff",
      borderRadius: 8,
      flexWrap: "wrap",
      ...(style ?? {}),
    },
  }, children);
}
