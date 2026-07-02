import React, { useMemo } from "react";
import type { VNode } from "@a2ui/core";
import { useStore } from "../useStore";
import { FadeIn } from "../FadeIn";

import { TextRenderer } from "./Text";
import { ImageRenderer } from "./Image";
import { IconRenderer } from "./Icon";
import { VideoRenderer } from "./Video";
import { ColumnRenderer } from "./Column";
import { RowRenderer } from "./Row";
import { ListRenderer } from "./List";
import { ButtonRenderer } from "./Button";
import { CardRenderer } from "./Card";

// ═══════════════════════════════════════════════════════════════════════════
// A2UIRenderer — VNode → React Element 调度器
//
// 按 VNode 类型分流：
//  - ContainerVNode (__a2ui_container)  → Column/Row/List/Button/Card 渲染器
//  - ComponentVNode (__a2ui_component)  → Text/Image/Icon/Video 渲染器
//  - ReactElement ($$typeof)            → 直接返回（旧 renderMap 兼容）
//  - 原始 component { Type: props }     → 走 renderMap 动态渲染
// ═══════════════════════════════════════════════════════════════════════════

export interface A2UIRendererProps {
  vnode: VNode;
}

export function A2UIRenderer({ vnode }: A2UIRendererProps) {
  const renderMap = useStore((s) => s.renderMap);

  return useMemo(() => {
    if (vnode === null || vnode === undefined) return null;
    if (typeof vnode === "string" || typeof vnode === "number") {
      return vnode as React.ReactNode;
    }

    const obj = vnode as Record<string, unknown>;

    // ── ContainerVNode ──
    if (obj.__a2ui_container === true) {
      const container = obj as Record<string, any>;
      const { type, props, componentId } = container;
      const children: unknown[] = container.children ?? [];

      // 先递归渲染所有 children
      const renderedChildren = children.map((child, i) => (
        <A2UIRenderer key={i} vnode={child} />
      ));

      const inner = renderContainer(type, props, componentId, renderedChildren);

      return componentId ? (
        <FadeIn componentId={componentId}>{inner}</FadeIn>
      ) : (
        inner
      );
    }

    // ── ComponentVNode ──
    if (obj.__a2ui_component === true) {
      const comp = obj as Record<string, any>;
      const { type, props, componentId } = comp;

      const inner = renderComponent(type, props, componentId);

      return componentId ? (
        <FadeIn componentId={componentId}>{inner}</FadeIn>
      ) : (
        inner
      );
    }

    // ── ReactElement（旧 renderMap 兼容） ──
    if (typeof vnode === "object" && "$$typeof" in (vnode as object)) {
      const compId = (vnode as any)?.props?.id as string | undefined;
      const element = vnode as unknown as React.ReactNode;
      return compId ? <FadeIn componentId={compId}>{element}</FadeIn> : element;
    }

    // ── 原始 component { Type: props } → renderMap 动态渲染 ──
    if (typeof vnode === "object" && vnode !== null) {
      const keys = Object.keys(vnode);
      if (keys.length === 1) {
        const compType = keys[0];
        const compProps = (obj as Record<string, any>)[compType];
        const renderFn = renderMap[compType];
        if (renderFn) {
          const result = renderFn(compProps) as any;
          if (
            result &&
            typeof result === "object" &&
            ("__a2ui_container" in result || "__a2ui_component" in result)
          ) {
            return <A2UIRenderer vnode={result} />;
          }
          return result as React.ReactNode;
        }
      }
    }

    // ── 兜底：JSON 展示 ──
    return React.createElement(
      "pre",
      { style: { fontSize: 12, color: "#999" } },
      JSON.stringify(vnode, null, 2),
    );
  }, [vnode, renderMap]);
}

/** 容器组件渲染分发 */
function renderContainer(
  type: string,
  props: Record<string, any>,
  componentId: string | undefined,
  children: React.ReactNode,
): React.ReactElement {
  switch (type) {
    case "Column":
      return React.createElement(ColumnRenderer, { ...props, componentId, children });
    case "Row":
      return React.createElement(RowRenderer, { ...props, componentId, children });
    case "List":
      return React.createElement(ListRenderer, { ...props, componentId, children });
    case "Button":
      return React.createElement(ButtonRenderer, { ...props, componentId, children });
    case "Card":
      return React.createElement(CardRenderer, { componentId, children });
    default:
      return React.createElement(
        "pre",
        { style: { fontSize: 12, color: "#999" } },
        JSON.stringify({ type, props, children: "[...]" }, null, 2),
      );
  }
}

/** 叶子组件渲染分发 */
function renderComponent(
  type: string,
  props: Record<string, any>,
  componentId: string | undefined,
): React.ReactElement {
  switch (type) {
    case "Text":
      return React.createElement(TextRenderer, {
        text: props.text,
        usageHint: props.usageHint,
        componentId,
      });
    case "Image":
      return React.createElement(ImageRenderer, {
        url: props.url,
        fit: props.fit,
        usageHint: props.usageHint,
        componentId,
      });
    case "Icon":
      return React.createElement(IconRenderer, {
        name: props.name,
        componentId,
      });
    case "Video":
      return React.createElement(VideoRenderer, {
        url: props.url,
        componentId,
      });
    default:
      return React.createElement(
        "pre",
        { style: { fontSize: 12, color: "#999" } },
        JSON.stringify({ type, props }, null, 2),
      );
  }
}
