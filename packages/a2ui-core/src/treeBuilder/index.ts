/**
 * a2ui-core/treeBuilder: 组件树构建器
 *
 * 从 hydrateNodeMap 中组装出组件树结构。
 * 在 parser 解析 A2UI JSONL 协议后调用，返回可直接渲染的组件树。
 *
 * 当前阶段（mock 只有一个组件）：
 *  - 遍历所有已开始渲染的 Surface
 *  - 提取每个 Surface 的 rootNode._vnode（已被 renderMap 渲染）
 *  - 按 Surface 维度组装为 { surfaceId, rootComponent } 列表
 *
 * 后续扩展方向：
 *  - 当 HydrateNode 包含 children 时，递归构建子树
 *  - 处理多 Surface 的层叠/并排布局
 */

import { getStore } from "../store/index.js";
import type { VNode } from "../store/types.js";

/**
 * 单个 Surface 的组件树节点
 */
export interface SurfaceTree {
  /** 所属 Surface ID */
  surfaceId: string;
  /** 根组件（已渲染的 _vnode） */
  rootComponent: VNode;
}

/**
 * 构建组件树
 *
 * @returns 所有活跃 Surface 的组件树列表
 *
 * 调用时机：parser 解析 A2UI JSONL 协议后
 */
export function buildTree(): SurfaceTree[] {
  const state = getStore().getState();

  const trees: SurfaceTree[] = [];

  for (const surfaceId of Object.keys(state.surfaceMap)) {
    const surface = state.surfaceMap[surfaceId];

    // 仅处理已开始渲染且有根节点的 Surface
    if (!surface.beginRender || !surface.rootNode) {
      continue;
    }

    trees.push({
      surfaceId,
      rootComponent: surface.rootNode._vnode,
    });
  }

  return trees;
}
