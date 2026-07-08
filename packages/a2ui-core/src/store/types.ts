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
 * 单个 Surface 的组件树节点
 * 由 buildTree() 产出，供外部渲染器消费。
 * 放在 store/types 避免 treeBuilder ↔ store 循环依赖。
 */
export interface SurfaceTree {
  /** 所属 Surface ID */
  surfaceId: string;
  /** 根组件（已递归解析的 _vnode 树） */
  rootComponent: VNode;
}

/**
 * 组件树变更回调
 * 由 init(renderMap, onTreeChange) 注入，SDK 在每次 processMessage 后自动调用。
 */
export type TreeChangeCallback = (trees: SurfaceTree[]) => void;

/**
 * 组件渲染函数
 * 接收 props（来自 JSONLine 协议的 component 数据），返回渲染后的 VNode。
 * 具体渲染逻辑由上层（如 a2ui-react）注入，core 层不依赖具体 UI 框架。
 */
export type ComponentRenderer = (props: Record<string, any>, componentId?: string) => VNode;

/**
 * 组件渲染映射表
 * key 为组件类型名（如 "Text"、"Button"），value 为对应的渲染函数。
 */
export type RenderMap = Record<string, ComponentRenderer>;

/**
 * 错误类型枚举
 */
export enum ErrorType {
  /** 协议解析错误 */
  PARSE_ERROR = "PARSE_ERROR",
  /** 组件类型未在 renderMap 中注册对应的渲染函数 */
  RENDERER_NOT_FOUND = "RENDERER_NOT_FOUND",
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
  /**
   * 根节点指针，直接指向 hydrateNodeMap 中的 HydrateNode 实例。
   * 空间换时间：避免二次 Map 查找。
   * 当 beginRendering 先于 surfaceUpdate 到达时可能为 null，
   * 此时等 surfaceUpdate 注册了对应组件后再回补。
   */
  rootNode: HydrateNode | null;
  /**
   * beginRendering 中指定的根组件 ID。
   * 当 rootNode 因组件尚未注册而为 null 时，
   * 后续 surfaceUpdate 可通过此 ID 匹配并回补 rootNode。
   */
  rootComponentId: string | null;
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
  /**
   * 标记清除：组件首次渲染后，由动画结束回调设为 true。
   * stream 流式到达的新组件 hasMounted=false → 触发淡入动画。
   */
  hasMounted: boolean;
}

/**
 * 用户动作负载，由 dispatchAction 构造并传递给 onUserAction 回调。
 * 所有 context BoundValue 已解析为实际值。
 */
export interface UserActionPayload {
  /** 动作名称（来自组件的 action.name） */
  name: string;
  /** 发起动作的 Surface ID */
  surfaceId: string;
  /** 触发动作的源组件 ID */
  sourceComponentId: string;
  /** ISO 8601 时间戳 */
  timestamp: string;
  /** 已解析的 context key→value 映射 */
  context: Record<string, any>;
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
  /** 组件渲染映射表：组件类型 -> 渲染函数，由 init(renderMap) 注入 */
  renderMap: RenderMap;
  /**
   * 组件树变更回调。SDK 在每次 processMessage 后自动调用，
   * 传入 buildTree() 产出的最新 SurfaceTree[]。
   * 由 init(renderMap, onTreeChange) 注入。
   */
  onTreeChange?: TreeChangeCallback;
  /**
   * 用户动作回调。组件触发 action 时调用，由应用层决定如何处理
   * （本地更新数据模型、发送到服务端等）。
   * 由 init(renderMap, onTreeChange, onUserAction) 注入。
   */
  onUserAction?: (action: UserActionPayload) => void;
  /**
   * 数据模型映射表：surfaceId → 嵌套数据对象。
   * 由 dataModelUpdate 消息写入，buildTree 时读取用于解析 BoundValue。
   */
  dataModelMap: Record<string, Record<string, any>>;
  /**
   * 数据模型版本号。每次 setDataModelAt 写入时递增，
   * 用作 React useMemo 的稳定依赖。
   */
  dataModelVersion: number;
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
  /** 标记组件已挂载（动画结束回调），hasMounted → true */
  markMounted: (componentId: string) => void;

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

  // ===== Data Model CRUD =====
  /** 按路径设置数据模型（深层合并；path 为 "/" 或 undefined 时替换整个 model） */
  setDataModelAt: (surfaceId: string, path: string | undefined, value: any) => void;
  /** 获取指定 surface 的完整数据模型 */
  getDataModel: (surfaceId: string) => Record<string, any> | undefined;
  /** 按路径从数据模型取值（如 "/user/name"） */
  getDataModelValue: (surfaceId: string, dataPath: string) => any;
  /** 清除指定 surface 的数据模型 */
  clearDataModel: (surfaceId: string) => void;

  // ===== User Action Dispatch =====
  /**
   * 分发用户动作。解析 context 中的 BoundValue，构造 UserActionPayload，
   * 调用 onUserAction 回调，然后自动触发 onTreeChange 重建组件树。
   */
  dispatchAction: (
    componentId: string,
    action: { name: string; context?: Array<{ key: string; value: any }> },
  ) => void;

  // ===== 流式节流 =====
  /**
   * 立即刷新组件树变更通知（跳过 debounce）。
   * 用于批量加载完成或流式结束时，确保最后一次渲染立即触发。
   */
  flushTreeChange: () => void;
}

/**
 * 完整的 Store 类型
 */
export type A2UIStore = A2UIStoreState & A2UIStoreActions;
