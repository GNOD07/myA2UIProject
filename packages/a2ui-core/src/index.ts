export * from "./parser";
export * from "./vnode";
export * from "./treeBuilder";
export * from "./store";
export * from "./buffer";
export * from "./binding";

// 导出 init 作为初始化入口（带 renderMap 参数）
export { initStore as init, getStore, destroyStore, resetStore } from "./store";
export type { RenderMap, ComponentRenderer, UserActionPayload } from "./store";

// 导出 Store 序列化器（多轮对话用）
export { serializeStore, serializeStoreToLines } from "./store/serializer";
export type { SerializeStoreOptions } from "./store/serializer";
