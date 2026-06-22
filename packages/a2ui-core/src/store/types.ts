/**
 * a2ui-core/store: Type definitions
 *
 * 核心实体：
 *  - Surface：渲染表面，代表一个独立的渲染区域
 *  - HydrateNode：水合节点，代表一个组件实例
 *  - A2UIError：错误信息
 *
 * 设计思路：用空间换时间，所有实体通过 Map 存储，
 * 在 parser 阶段一次性构建好所需信息，后续通过 id 高效查找。
 */

/**
 * 通用虚拟节点类型
 * 为了解除对 React 的依赖，使用泛型而非 React.ReactElement
 */
export type VNode = unknown;

/**
 * 错误类型枚举
 */
export enum ErrorType {
  /** 协议解析错误 */
  PARSE_ERROR = "PARSE_ERROR",
}

/**
 * 错误信息
 */
export interface A2UIError {
  /** 错误唯一标识 */
  id: string;
  /** 错误类型 */
  type: ErrorType;
  /** 错误内容描述 */
  content: string;
  /** 关联的 surfaceId（可选） */
  surfaceId?: string;
  /** 关联的 componentId（可选） */
  componentId?: string;
}

/**
 * Surface（渲染表面）
 * 代表一个独立的渲染区域，包含一个根水合节点
 */
export interface Surface {
  /** Surface 唯一标识 */
  surfaceId: string;
  /** 是否已开始渲染 */
  beginRender: boolean;
  /** 根节点指针，指向某个 HydrateNode 的 componentId */
  rootNode: string | null;
}

/**
 * HydrateNode（水合节点）
 * 代表一个组件实例，包含虚拟节点和协议信息
 */
export interface HydrateNode {
  /** 组件唯一标识 */
  componentId: string;
  /** 虚拟节点（解除对 React 的依赖） */
  _vnode: VNode;
  /** 所属 Surface 的 ID */
  ownerSurfaceId: string;
  /** 原始 JSONLine 协议字符串 */
  protocol: string;
}

/**
 * Store 状态
 */
export interface A2UIStoreState {
  /** Surface 映射表：surfaceId -> Surface */
  surfaceMap: Record<string, Surface>;
  /** 水合节点映射表：componentId -> HydrateNode */
  hydrateNodeMap: Record<string, HydrateNode>;
  /** 错误映射表：errorId -> A2UIError */
  errorMap: Record<string, A2UIError>;
}

/**
 * Store 动作
 */
export interface A2UIStoreActions {
  // ===== Surface CRUD =====
  /** 添加 Surface */
  addSurface: (surface: Surface) => void;
  /** 获取 Surface */
  getSurface: (surfaceId: string) => Surface | undefined;
  /** 更新 Surface */
  updateSurface: (surfaceId: string, updates: Partial<Omit<Surface, "surfaceId">>) => void;
  /** 删除 Surface */
  removeSurface: (surfaceId: string) => void;

  // ===== HydrateNode CRUD =====
  /** 添加水合节点 */
  addHydrateNode: (node: HydrateNode) => void;
  /** 获取水合节点 */
  getHydrateNode: (componentId: string) => HydrateNode | undefined;
  /** 更新水合节点 */
  updateHydrateNode: (componentId: string, updates: Partial<Omit<HydrateNode, "componentId">>) => void;
  /** 删除水合节点 */
  removeHydrateNode: (componentId: string) => void;

  // ===== Error CRUD =====
  /** 添加错误 */
  addError: (error: A2UIError) => void;
  /** 获取错误 */
  getError: (errorId: string) => A2UIError | undefined;
  /** 更新错误 */
  updateError: (errorId: string, updates: Partial<Omit<A2UIError, "id">>) => void;
  /** 删除错误 */
  removeError: (errorId: string) => void;

  // ===== 批量操作 =====
  /** 清空所有数据 */
  clear: () => void;
  /** 清空指定 Surface 及其关联的所有节点和错误 */
  clearSurface: (surfaceId: string) => void;
}

/**
 * 完整的 Store 类型
 */
export type A2UIStore = A2UIStoreState & A2UIStoreActions;
