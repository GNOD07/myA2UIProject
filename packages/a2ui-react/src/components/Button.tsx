import React from "react";
import type { ComponentRenderer } from "@a2ui/core";

// ═══════════════════════════════════════════════════════════════════════════
// A2UI v0.8 Standard Catalog — Button 容器组件
// 协议属性：child (required), primary (optional), action (required: { name, context? })
// ═══════════════════════════════════════════════════════════════════════════

/** 协议层 Button 组件属性 */
export interface ButtonProps {
  child: string;
  primary?: boolean;
  action: {
    name: string;
    context?: Array<{
      key: string;
      value: { path?: string; literalString?: string; literalNumber?: number; literalBoolean?: boolean };
    }>;
  };
}

/** renderMap 入口：协议 props → ContainerVNode */
export const Button: ComponentRenderer = (props, componentId?) => {
  const { child, primary = false, action } = props;
  return {
    __a2ui_container: true,
    type: "Button",
    props: { primary, action },
    componentId,
    childIds: child ? [child] : [],
  };
};

/** treeBuilder 解析后的 Button 渲染属性 */
export interface ResolvedButtonProps {
  primary?: boolean;
  action?: { name: string; context?: unknown[] };
  componentId?: string;
}

/** React 渲染组件：VNode → DOM */
export function ButtonRenderer({
  primary,
  action,
  componentId,
  children,
}: ResolvedButtonProps & { children: React.ReactNode }) {
  return React.createElement("button", {
    id: componentId ?? undefined,
    onClick: () => {
      console.log("[A2UI Button] action:", action?.name, action?.context);
    },
    style: {
      padding: "8px 20px",
      borderRadius: 6,
      border: primary ? "none" : "1px solid #d9d9d9",
      backgroundColor: primary ? "#1677ff" : "#fff",
      color: primary ? "#fff" : "#333",
      fontSize: 14,
      fontWeight: primary ? 600 : 400,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
    },
  }, children);
}
