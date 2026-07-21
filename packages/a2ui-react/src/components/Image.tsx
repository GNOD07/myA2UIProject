import React from "react";
import type { ComponentRenderer } from "@a2ui/core";

// ═══════════════════════════════════════════════════════════════════════════
// A2UI v0.8 Standard Catalog — Image 组件
// 协议属性：url (required: literalString | path), fit (optional), usageHint (optional)
// ═══════════════════════════════════════════════════════════════════════════

/** 协议层 Image 组件属性 */
export interface ImageProps {
  url: { literalString?: string; path?: string };
  fit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  usageHint?: "icon" | "avatar" | "smallFeature" | "mediumFeature" | "largeFeature" | "header";
}

/** treeBuilder 解析 BoundValue 后的 Image 属性 */
export interface ResolvedImageProps {
  url: string;
  fit?: string;
  usageHint?: string;
  componentId?: string;
  style?: Record<string, any>;
}

const HINT_STYLES: Record<string, Record<string, any>> = {
  icon: { width: 40, height: 40 },
  avatar: { width: 48, height: 48, borderRadius: "50%" },
  smallFeature: { width: 180, height: 120 },
  mediumFeature: { width: 320, height: 200 },
  largeFeature: { width: 480, height: 320 },
  header: { width: "100%", height: 200 },
};

/** renderMap 入口：协议 props → ComponentVNode */
export const Image: ComponentRenderer = (props, componentId?) => ({
  __a2ui_component: true,
  type: "Image",
  props: {
    url: props.url,
    fit: props.fit ?? "cover",
    usageHint: props.usageHint,
    style: props.style,
  },
  componentId,
});

/** React 渲染组件：VNode → DOM */
export function ImageRenderer({ url, fit, usageHint, componentId, style }: ResolvedImageProps) {
  return React.createElement("img", {
    id: componentId ?? undefined,
    src: String(url ?? ""),
    alt: usageHint ?? "image",
    style: {
      display: "block",
      objectFit: fit ?? "cover",
      borderRadius: 8,
      ...(usageHint ? HINT_STYLES[usageHint] ?? {} : {}),
      ...(style ?? {}),
    },
  });
}
