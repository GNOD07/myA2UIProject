// @a2ui/react: React-based A2UI renderer
export { useStore, useRootNode } from "./useStore";
export { defaultRenderMap } from "./renderMap";
export { FadeIn } from "./FadeIn";
export { init, getStore, destroyStore, resetStore } from "@a2ui/core";
export type { A2UIStore, A2UIStoreState, Surface, HydrateNode, RenderMap } from "@a2ui/core";

// 渲染组件
export {
  A2UIRenderer,
  TextRenderer,
  ImageRenderer,
  IconRenderer,
  VideoRenderer,
  ColumnRenderer,
  RowRenderer,
  ListRenderer,
  ButtonRenderer,
  CardRenderer,
} from "./components";
export type {
  A2UIRendererProps,
  TextProps,
  ResolvedTextProps,
  ImageProps,
  ResolvedImageProps,
  IconProps,
  ResolvedIconProps,
  VideoProps,
  ResolvedVideoProps,
  ColumnProps,
  ResolvedColumnProps,
  RowProps,
  ResolvedRowProps,
  ListProps,
  ResolvedListProps,
  ButtonProps,
  ResolvedButtonProps,
  CardProps,
  ResolvedCardProps,
} from "./components";
