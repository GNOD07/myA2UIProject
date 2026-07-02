import React from "react";
import type { ComponentRenderer } from "@a2ui/core";

// ═══════════════════════════════════════════════════════════════════════════
// A2UI v0.8 Standard Catalog — Text 组件
// 协议属性：text (required: literalString | path), usageHint (optional)
// ═══════════════════════════════════════════════════════════════════════════

/** 协议层 Text 组件属性（渲染前，含 BoundValue） */
export interface TextProps {
  text: { literalString?: string; path?: string };
  usageHint?: "h1" | "h2" | "h3" | "h4" | "h5" | "caption" | "body";
}

/** treeBuilder 解析 BoundValue 后的 Text 属性 */
export interface ResolvedTextProps {
  text: string;
  usageHint?: string;
  componentId?: string;
}

/** renderMap 入口：协议 props → ComponentVNode */
export const Text: ComponentRenderer = (props, componentId?) => ({
  __a2ui_component: true,
  type: "Text",
  props: {
    text: props.text,
    usageHint: props.usageHint,
  },
  componentId,
});

/** React 渲染组件：VNode → DOM */
export function TextRenderer({ text, usageHint, componentId }: ResolvedTextProps) {
  const tag = usageHint && usageHint !== "body" ? usageHint : "span";
  return React.createElement(
    tag,
    {
      id: componentId ?? undefined,
      style: {
        padding: "4px 0",
        fontSize:
          usageHint === "h1"
            ? 28
            : usageHint === "h2"
              ? 22
              : usageHint === "h3"
                ? 18
                : usageHint === "caption"
                  ? 12
                  : 14,
        fontWeight: usageHint?.startsWith?.("h") ? 600 : 400,
        color: usageHint === "caption" ? "#999" : "#333",
      },
    },
    String(text ?? ""),
  );
}
