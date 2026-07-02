/**
 * A2UI 容器组件 CSS 映射常量
 *
 * 对齐 A2UI v0.8 协议中 distribution / alignment / direction 的枚举值。
 */

/** justify-content 映射（distribution → CSS flex） */
export const DISTRIBUTION_CSS: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  spaceBetween: "space-between",
  spaceAround: "space-around",
  spaceEvenly: "space-evenly",
};

/** align-items 映射（alignment → CSS flex） */
export const ALIGNMENT_CSS: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};
