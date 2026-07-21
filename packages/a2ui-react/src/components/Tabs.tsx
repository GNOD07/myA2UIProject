import React, { useState } from "react";
import type { ComponentRenderer } from "@a2ui/core";

// ═══════════════════════════════════════════════════════════════════════════
// A2UI 自定义组件 — Tabs 标签页
// 协议属性：tabItems (required: [{label: string, child: string}])
// ═══════════════════════════════════════════════════════════════════════════

/** 单个标签页定义 */
interface TabItem {
  label: string;
  child: string;
}

/** 协议层 Tabs 组件属性 */
export interface TabsProps {
  tabItems: TabItem[];
}

/** renderMap 入口：协议 props → ContainerVNode */
export const Tabs: ComponentRenderer = (props, componentId?) => {
  const tabItems: TabItem[] = props.tabItems ?? [];
  return {
    __a2ui_container: true,
    type: "Tabs",
    props: { tabItems },
    componentId,
    // 所有 tab 内容都注册为子节点，渲染时只显示 active
    childIds: tabItems.map((item) => item.child),
  };
};

/** treeBuilder 解析后的 Tabs 渲染属性 */
export interface ResolvedTabsProps {
  tabItems?: TabItem[];
  componentId?: string;
  style?: Record<string, any>;
}

/** React 渲染组件：VNode → DOM */
export function TabsRenderer({
  tabItems = [],
  componentId,
  style,
  children,
}: ResolvedTabsProps & { children: React.ReactNode }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const childrenArr = React.Children.toArray(children);

  return React.createElement(
    "div",
    {
      id: componentId ?? undefined,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 0,
        ...(style ?? {}),
      },
    },
    // 标签头部
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          borderBottom: "1px solid #e8e8e8",
          gap: 0,
        },
      },
      ...tabItems.map((item, index) =>
        React.createElement(
          "div",
          {
            key: index,
            onClick: () => setActiveIndex(index),
            style: {
              padding: "10px 20px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: index === activeIndex ? 600 : 400,
              color: index === activeIndex ? "#1677ff" : "#666",
              borderBottom: index === activeIndex
                ? "2px solid #1677ff"
                : "2px solid transparent",
              transition: "all 0.2s",
              userSelect: "none",
            },
          },
          item.label,
        ),
      ),
    ),
    // 当前激活的标签内容
    React.createElement(
      "div",
      {
        style: { padding: "12px 0" },
      },
      childrenArr[activeIndex] ?? null,
    ),
  );
}
