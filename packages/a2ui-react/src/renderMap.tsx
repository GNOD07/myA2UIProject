import React from "react";
import type { RenderMap } from "@a2ui/core";

/**
 * A2UI 默认组件渲染映射表
 *
 * key 对应 JSONLine 协议中的组件类型（如 "Text"），
 * value 是对应的渲染函数，接收 props 返回 ReactElement。
 *
 * 上层（playground）在 init(renderMap) 时注入此映射表，
 * parser 解析到对应组件类型时调用渲染函数，将结果存入 _vnode。
 */
export const defaultRenderMap: RenderMap = {
  /**
   * Text 组件渲染
   * 协议格式：{ "Text": { "text": { "literalString": "Hello" } } }
   */
  Text: (props: Record<string, any>, componentId?: string) => {
    const { text, usageHint } = props;
    const tag = usageHint || "div";
    return React.createElement(
      tag,
      {
        id: componentId ?? undefined,
        key: `text-${componentId ?? text.literalString}`,
        style: { padding: "8px 0" },
      },
      text.literalString as string,
    );
  },

  /**
   * Column 容器组件渲染
   *
   * 产出中间表示（非最终 ReactElement），children 仅记录 componentId 列表。
   * treeBuilder 阶段会递归解析这些 ID → hydrateNodeMap 中的 _vnode 实例，
   * 最终由 VNodeRenderer 递归渲染。
   *
   * 协议格式：
   * {
   *   "children": { "explicitList": ["text1", "text2", "text3"] },
   *   "distribution": "start",   // 可选，垂直分布
   *   "alignment": "stretch"      // 可选，水平对齐
   * }
   */
  Column: (props: Record<string, any>, componentId?: string) => {
    const { children, distribution = "start", alignment = "stretch" } = props;
    const childIds: string[] = children?.explicitList ?? [];

    return {
      __a2ui_container: true,
      type: "Column",
      props: { distribution, alignment },
      componentId,
      childIds,
    };
  },

  /**
   * Row 容器组件渲染
   *
   * 与 Column 结构完全一致，区别仅在于 type。
   * VNodeRenderer 根据 type 决定 flexDirection：Column → column，Row → row。
   *
   * 协议格式：
   * {
   *   "children": { "explicitList": ["col1", "col2", "col3"] },
   *   "distribution": "start",   // 可选，水平分布
   *   "alignment": "stretch"      // 可选，垂直对齐
   * }
   */
  Row: (props: Record<string, any>, componentId?: string) => {
    const { children, distribution = "start", alignment = "stretch" } = props;
    const childIds: string[] = children?.explicitList ?? [];

    return {
      __a2ui_container: true,
      type: "Row",
      props: { distribution, alignment },
      componentId,
      childIds,
    };
  },

  /**
   * Button 组件渲染
   *
   * 协议格式（standard_catalog_definition.json）：
   * {
   *   "child": "text_id",           // 子组件 ID（通常为 Text）
   *   "primary": true,              // 可选，是否主按钮样式
   *   "action": {
   *     "name": "submit_form",      // 动作名
   *     "context": [                // 可选，上下文键值对
   *       { "key": "formId", "value": { "literalString": "f1" } }
   *     ]
   *   }
   * }
   */
  Button: (props: Record<string, any>, componentId?: string) => {
    const { child, primary = false, action } = props;
    return {
      __a2ui_container: true,
      type: "Button",
      props: { primary, action },
      componentId,
      childIds: child ? [child] : [],
    };
  },

  /**
   * Image 组件渲染（叶子组件，无子节点）
   *
   * 协议格式（standard_catalog_definition.json）：
   * {
   *   "url": { "literalString": "https://..." } | { "path": "/data/url" },
   *   "fit": "contain" | "cover" | "fill" | "none" | "scale-down",  // 可选
   *   "usageHint": "icon" | "avatar" | "smallFeature" | ...         // 可选
   * }
   */
  Image: (props: Record<string, any>, componentId?: string) => {
    const { url, fit = "cover", usageHint } = props;
    const src = url?.literalString ?? url?.path ?? "";

    // usageHint → 尺寸/样式映射
    const hintStyles: Record<string, Record<string, any>> = {
      icon: { width: 40, height: 40 },
      avatar: { width: 48, height: 48, borderRadius: "50%" },
      smallFeature: { width: 180, height: 120 },
      mediumFeature: { width: 320, height: 200 },
      largeFeature: { width: 480, height: 320 },
      header: { width: "100%", height: 200 },
    };

    const baseStyle: Record<string, any> = {
      display: "block",
      objectFit: fit,
      borderRadius: 8,
    };

    return React.createElement("img", {
      id: componentId ?? undefined,
      key: `image-${componentId ?? src.slice(0, 20)}`,
      src,
      alt: usageHint ?? "image",
      style: {
        ...baseStyle,
        ...(usageHint ? hintStyles[usageHint] ?? {} : {}),
      },
    });
  },
};
