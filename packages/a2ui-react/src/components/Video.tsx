import React from "react";
import type { ComponentRenderer } from "@a2ui/core";

// ═══════════════════════════════════════════════════════════════════════════
// A2UI v0.8 Standard Catalog — Video 组件
// 协议属性：url (required: literalString | path)
// ═══════════════════════════════════════════════════════════════════════════

/** 协议层 Video 组件属性 */
export interface VideoProps {
  url: { literalString?: string; path?: string };
}

/** treeBuilder 解析 BoundValue 后的 Video 属性 */
export interface ResolvedVideoProps {
  url: string;
  componentId?: string;
  style?: Record<string, any>;
}

/** renderMap 入口：协议 props → ComponentVNode */
export const Video: ComponentRenderer = (props, componentId?) => ({
  __a2ui_component: true,
  type: "Video",
  props: {
    url: props.url,
    style: props.style,
  },
  componentId,
});

/** React 渲染组件：VNode → DOM */
export function VideoRenderer({ url, componentId, style }: ResolvedVideoProps) {
  return React.createElement("video", {
    id: componentId ?? undefined,
    src: String(url ?? ""),
    controls: true,
    style: {
      display: "block",
      maxWidth: "100%",
      borderRadius: 8,
      backgroundColor: "#000",
      ...(style ?? {}),
    },
  });
}
