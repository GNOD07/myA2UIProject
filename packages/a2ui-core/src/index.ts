export * from "./parser";
export * from "./vnode";
export * from "./treeBuilder";
export * from "./store";
export * from "./buffer";
export * from "./binding";

// 导出 init 作为初始化入口（带 renderMap 参数）
export { initStore as init, getStore, destroyStore, resetStore } from "./store";
export type { RenderMap, ComponentRenderer, UserActionPayload } from "./store";
