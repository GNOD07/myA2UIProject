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
  Text: (props: Record<string, any>) => {
    const { text, usageHint } = props;
    const tag = usageHint || "div";
    return React.createElement(
      tag,
      {
        key: `text-${text.literalString}`,
        style: { padding: "8px 0" },
      },
      text.literalString as string,
    );
  },
};
