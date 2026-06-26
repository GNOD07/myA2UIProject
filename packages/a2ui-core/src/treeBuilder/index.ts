/**
 * a2ui-core/treeBuilder: 组件树构建器
 *
 * 从 hydrateNodeMap 中组装出组件树结构。
 * 在 parser 解析 A2UI JSONL 协议后调用，返回可直接渲染的组件树。
 *
 * 核心职责：
 *  - 递归解析容器组件（Column/Row/List 等）的 children
 *  - children.explicitList 中的 componentId → hydrateNodeMap 实例
 *  - 产出完整、可递归渲染的 VNode 树
 */

import { getStore } from "../store/index.js";
import type { VNode, HydrateNode } from "../store/types.js";

/**
 * 单个 Surface 的组件树节点
 */
export interface SurfaceTree {
  /** 所属 Surface ID */
  surfaceId: string;
  /** 根组件（已递归解析的 _vnode 树） */
  rootComponent: VNode;
}

/**
 * 容器组件的中间表示（由 renderMap 产出，treeBuilder 解析 children）
 */
interface ContainerVNode {
  __a2ui_container: true;
  type: string;
  props: Record<string, any>;
  childIds: string[];
}

/**
 * 判断一个 VNode 是否为容器（需要递归解析 children）
 */
function isContainer(vnode: unknown): vnode is ContainerVNode {
  return (
    typeof vnode === "object" &&
    vnode !== null &&
    "__a2ui_container" in (vnode as Record<string, unknown>)
  );
}

/**
 * 递归解析节点及其子树
 *
 * - 容器节点：递归解析 childIds → hydrateNodeMap，构建完整的 children 数组
 * - 叶子节点：直接返回（已是 renderMap 渲染的最终结果）
 *
 * @param node      当前 HydrateNode 实例
 * @param nodeMap   全局 hydrateNodeMap
 * @returns         完整解析后的 VNode（容器已包含递归解析的 children）
 */
export function resolveNode(
  node: HydrateNode,
  nodeMap: Record<string, HydrateNode>,
): VNode {
  const vnode = node._vnode;

  if (!isContainer(vnode)) {
    // 叶子节点（如 Text → ReactElement）
    return vnode;
  }

  // 容器节点：递归解析 children
  const resolvedChildren: VNode[] = [];
  for (const childId of vnode.childIds) {
    const childNode = nodeMap[childId];
    if (childNode) {
      resolvedChildren.push(resolveNode(childNode, nodeMap));
    }
  }

  return {
    ...vnode,
    children: resolvedChildren,
  };
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
      rootComponent: resolveNode(surface.rootNode, state.hydrateNodeMap),
    });
  }

  return trees;
}
