/**
 * a2ui-core/treeBuilder: 组件树构建器
 *
 * 从 hydrateNodeMap 中组装出组件树结构。
 * 在 parser 解析 A2UI JSONL 协议后调用，返回可直接渲染的组件树。
 *
 * 核心职责：
 *  - 递归解析容器组件（Column/Row/List 等）的 children
 *  - 解析 ComponentVNode 中的 BoundValue（path → data model 值）
 *  - 展开 template 动态列表
 *  - 产出完整、可递归渲染的 VNode 树
 */

import { getStore } from "../store/index.js";
import type { VNode, HydrateNode, SurfaceTree } from "../store/types.js";
import { resolveProps } from "../binding/index.js";

/**
 * 容器组件的中间表示（由 renderMap 产出，treeBuilder 解析 children）
 */
interface ContainerVNode {
  __a2ui_container: true;
  type: string;
  props: Record<string, any>;
  childIds: string[];
  /** 模板定义（Row/Column/List 的 children.template） */
  template?: {
    componentId: string;
    dataBinding: string;
  };
  componentId?: string;
}

/**
 * 叶子组件的中间表示（由 renderMap 产出，treeBuilder 解析 BoundValue props）
 */
export interface ComponentVNode {
  __a2ui_component: true;
  type: string;
  props: Record<string, any>;
  componentId?: string;
}

/** ContainerVNode 类型守卫 */
function isContainer(vnode: unknown): vnode is ContainerVNode {
  return (
    typeof vnode === "object" &&
    vnode !== null &&
    "__a2ui_container" in (vnode as Record<string, unknown>)
  );
}

/** ComponentVNode 类型守卫 */
export function isComponentVNode(vnode: unknown): vnode is ComponentVNode {
  return (
    typeof vnode === "object" &&
    vnode !== null &&
    "__a2ui_component" in (vnode as Record<string, unknown>)
  );
}

/**
 * 深度克隆 VNode（模板展开时为每个 item 创建独立副本）
 */
function deepCloneVNode(vnode: VNode): VNode {
  if (vnode === null || vnode === undefined) return vnode;
  if (typeof vnode !== 'object') return vnode;
  if (Array.isArray(vnode)) return (vnode as unknown[]).map(deepCloneVNode) as unknown as VNode;

  const cloned: Record<string, any> = {};
  for (const key of Object.keys(vnode as Record<string, unknown>)) {
    cloned[key] = deepCloneVNode((vnode as Record<string, any>)[key]);
  }
  return cloned as VNode;
}

/**
 * 递归解析节点及其子树
 *
 * - ComponentVNode → 解析 BoundValue props
 * - ContainerVNode → 解析 children（explicitList 或 template）
 * - 其他 VNode → 直接返回（已渲染的 React 元素等）
 */
export function resolveNode(
  node: HydrateNode,
  nodeMap: Record<string, HydrateNode>,
  dataModel?: Record<string, any>,
  contextPath?: string,
): VNode {
  const vnode = node._vnode;

  // ---- ComponentVNode（叶子中间表示）：解析 BoundValue ----
  if (isComponentVNode(vnode)) {
    return {
      ...vnode,
      props: resolveProps(vnode.props, dataModel, contextPath),
    };
  }

  // ---- 非容器节点：直接返回 ----
  if (!isContainer(vnode)) {
    return vnode;
  }

  // ---- 容器节点：解析 children ----

  // 模板展开
  if (vnode.template) {
    if (!dataModel) {
      return { ...vnode, children: [] };
    }

    const { componentId, dataBinding } = vnode.template;
    const templateNode = nodeMap[componentId];
    if (!templateNode) {
      return { ...vnode, children: [] };
    }

    // 从 dataModel 解析 dataBinding 路径
    const segments = dataBinding.split('/').filter(Boolean);
    let listData: any = dataModel;
    for (const seg of segments) {
      if (listData === null || typeof listData !== 'object') {
        return { ...vnode, children: [] };
      }
      listData = listData[seg];
    }

    if (!listData || typeof listData !== 'object') {
      return { ...vnode, children: [] };
    }

    // 为 listData 的每个 key 克隆并解析模板组件
    const expandedChildren: VNode[] = [];
    for (const itemKey of Object.keys(listData)) {
      const itemContextPath = dataBinding + '/' + itemKey;
      const clonedVNode = deepCloneVNode(templateNode._vnode);

      // 注入唯一 componentId，确保每个模板展开项有独立 ID
      const uniqueId = templateNode.componentId + '_' + itemKey;
      if (typeof clonedVNode === 'object' && clonedVNode !== null) {
        (clonedVNode as Record<string, unknown>).componentId = uniqueId;
      }

      const tempNode: HydrateNode = {
        componentId: uniqueId,
        _vnode: clonedVNode,
        ownerSurfaceId: templateNode.ownerSurfaceId,
        protocol: templateNode.protocol,
        hasMounted: false,
      };

      expandedChildren.push(
        resolveNode(tempNode, nodeMap, dataModel, itemContextPath),
      );
    }

    return { ...vnode, children: expandedChildren };
  }

  // explicitList 解析
  const resolvedChildren: VNode[] = [];
  for (const childId of vnode.childIds) {
    const childNode = nodeMap[childId];
    if (childNode) {
      resolvedChildren.push(resolveNode(childNode, nodeMap, dataModel, contextPath));
    }
  }

  return { ...vnode, children: resolvedChildren };
}

/**
 * 构建所有活跃 Surface 的组件树
 */
export function buildTree(): SurfaceTree[] {
  const state = getStore().getState();
  const trees: SurfaceTree[] = [];

  for (const surfaceId of Object.keys(state.surfaceMap)) {
    const surface = state.surfaceMap[surfaceId];
    if (!surface.beginRender || !surface.rootNode) continue;

    trees.push({
      surfaceId,
      rootComponent: resolveNode(
        surface.rootNode,
        state.hydrateNodeMap,
        state.dataModelMap[surfaceId],
      ),
    });
  }

  return trees;
}
