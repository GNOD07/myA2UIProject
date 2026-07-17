/**
 * a2ui-core/binding: 数据绑定工具模块
 *
 * 协议 v0.8 定义的数据模型和 BoundValue 解析逻辑。
 * 纯 TypeScript，无框架依赖。
 */

// ============================================================================
// 类型定义（匹配协议 v0.8 schema）
// ============================================================================

/**
 * valueMap 中的一个条目（协议规定：仅有 key + valueString/Number/Boolean，无嵌套 valueMap）
 */
export interface DataModelMapEntry {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
}

/**
 * dataModelUpdate.contents 中的一个条目
 *
 * 根据协议 v0.8 schema：
 * - 顶级 contents 可包含 valueMap
 * - valueMap 内的条目仅含 valueString/Number/Boolean（DataModelMapEntry）
 */
export interface DataModelEntry {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueMap?: DataModelMapEntry[];
}

/**
 * BoundValue — 组件属性中可绑定的值
 *
 * 协议支持：literalString / literalNumber / literalBoolean / literalArray / path
 */
export interface BoundValue {
  literalString?: string;
  literalNumber?: number;
  literalBoolean?: boolean;
  literalArray?: string[];
  path?: string;
}

// ============================================================================
// parseAdjacencyListToObject — 邻接表 → 嵌套对象
// ============================================================================

/**
 * 将 dataModelUpdate.contents 的邻接表格式转为嵌套 JS 对象。
 *
 * 协议示例（标准数组格式）：
 *   [{key:"user", valueMap:[{key:"name",valueString:"Bob"}]}]
 *   → { user: { name: "Bob" } }
 *
 * 容错：valueMap 为对象格式（非标准）时自动转换为数组再处理
 */
export function parseAdjacencyListToObject(
  entries: DataModelEntry[],
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const entry of entries) {
    if (entry.valueMap !== undefined) {
      // valueMap → 递归转对象
      const mapObj: Record<string, any> = {};

      // 容错：LLM 可能生成对象格式 {"key":"value"} 而非标准数组 [{key, valueString}]
      const items: Array<{ key: string; valueString?: string; valueNumber?: number; valueBoolean?: boolean }> =
        Array.isArray(entry.valueMap)
          ? entry.valueMap
          : Object.entries(entry.valueMap as Record<string, unknown>).map(
              ([k, v]) => ({
                key: k,
                valueString: typeof v === 'string' ? v : undefined,
                valueNumber: typeof v === 'number' ? v : undefined,
                valueBoolean: typeof v === 'boolean' ? v : undefined,
              }),
            );

      for (const item of items) {
        if (item.valueString !== undefined) {
          mapObj[item.key] = item.valueString;
        } else if (item.valueNumber !== undefined) {
          mapObj[item.key] = item.valueNumber;
        } else if (item.valueBoolean !== undefined) {
          mapObj[item.key] = item.valueBoolean;
        }
      }
      result[entry.key] = mapObj;
    } else if (entry.valueString !== undefined) {
      result[entry.key] = entry.valueString;
    } else if (entry.valueNumber !== undefined) {
      result[entry.key] = entry.valueNumber;
    } else if (entry.valueBoolean !== undefined) {
      result[entry.key] = entry.valueBoolean;
    }
  }

  return result;
}

// ============================================================================
// isBoundValue — 类型检测
// ============================================================================

/**
 * 判断一个值是否为 BoundValue 对象。
 * 只要包含 literalString/literalNumber/literalBoolean/literalArray/path 之一即返回 true。
 */
export function isBoundValue(value: unknown): value is BoundValue {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    'literalString' in obj ||
    'literalNumber' in obj ||
    'literalBoolean' in obj ||
    'literalArray' in obj ||
    'path' in obj
  );
}

// ============================================================================
// resolveBoundValue — 解析单个 BoundValue
// ============================================================================

/**
 * 将单个 BoundValue 解析为实际值。
 *
 * 规则（来自协议 v0.8 §4.2）：
 *  - 仅 literal*  → 直接返回 literal 值
 *  - 仅 path       → 从 dataModel 取值，不存在则返回 undefined
 *  - path + literal → dataModel 有值则返回 dataModel 值，否则返回 literal 兜底
 *
 * @param boundValue  待解析的 BoundValue
 * @param dataModel   当前 surface 的数据模型
 * @param contextPath 模板上下文路径（模板内相对路径拼接用）
 */
export function resolveBoundValue(
  boundValue: BoundValue,
  dataModel: Record<string, any> | undefined,
  contextPath?: string,
): any {
  // 提取 literal 值
  const hasLiteral =
    boundValue.literalString !== undefined ||
    boundValue.literalNumber !== undefined ||
    boundValue.literalBoolean !== undefined ||
    boundValue.literalArray !== undefined;

  const literalValue =
    boundValue.literalString ??
    boundValue.literalNumber ??
    boundValue.literalBoolean ??
    boundValue.literalArray;

  // 无 path → 直接返回 literal（或 undefined）
  if (!boundValue.path) {
    return hasLiteral ? literalValue : undefined;
  }

  // 有 path → 从 dataModel 取值
  let lookupPath = boundValue.path;

  // 相对路径（不以 / 开头）且存在 contextPath → 拼接
  if (contextPath && !lookupPath.startsWith('/')) {
    lookupPath = contextPath + '/' + lookupPath;
  }

  const segments = lookupPath.split('/').filter(Boolean);
  let current: any = dataModel;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return hasLiteral ? literalValue : undefined;
    }
    current = current[seg];
  }

  // dataModel 中找到值 → 返回
  if (current !== undefined) {
    return current;
  }

  // dataModel 中不存在 → literal 兜底
  return hasLiteral ? literalValue : undefined;
}

// ============================================================================
// resolveProps — 批量解析 props 中的 BoundValue
// ============================================================================

/**
 * 遍历 props 对象，将所有 BoundValue 解析为实际值。
 * 非 BoundValue 的 prop 原样透传。
 */
export function resolveProps(
  props: Record<string, any>,
  dataModel: Record<string, any> | undefined,
  contextPath?: string,
): Record<string, any> {
  const resolved: Record<string, any> = {};

  for (const key of Object.keys(props)) {
    const value = props[key];
    if (isBoundValue(value)) {
      resolved[key] = resolveBoundValue(value, dataModel, contextPath);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

// ============================================================================
// extractInitShorthand — 提取初始化简写
// ============================================================================

/**
 * 简写提取结果：包含父路径和数据条目。
 *
 * 例如 BoundValue { path: "/page/title", literalString: "Hello" }
 * → parentPath = "/page", entry = { key: "title", valueString: "Hello" }
 */
export interface ShorthandEntry {
  /** 父路径，如 "/page"（将作为 setDataModelAt 的 path 参数） */
  parentPath: string;
  /** 数据条目（key 为路径最后一截，value* 为 literal 值） */
  entry: DataModelEntry;
}

/**
 * 递归扫描组件 props 中的 BoundValue，提取同时有 path 和 literal* 的简写条目。
 *
 * 协议 §4.2 规定：path + literal 同时存在时，客户端必须：
 *  1. 更新 data model（隐式 dataModelUpdate）
 *  2. 绑定到该 path
 *
 * @returns ShorthandEntry[] — 每个条目包含 parentPath 和对应的 DataModelEntry
 */
export function extractInitShorthand(
  props: Record<string, any>,
): ShorthandEntry[] {
  const result: ShorthandEntry[] = [];

  for (const key of Object.keys(props)) {
    const value = props[key];

    // 跳过非 BoundValue（递归检查嵌套对象）
    if (!isBoundValue(value)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result.push(...extractInitShorthand(value));
      }
      continue;
    }

    const bv = value as BoundValue;

    // 必须同时有 path 和 literal*
    if (!bv.path) continue;

    const hasLiteral =
      bv.literalString !== undefined ||
      bv.literalNumber !== undefined ||
      bv.literalBoolean !== undefined;

    if (!hasLiteral) continue;

    // 提取父路径和 leaf key
    const segments = bv.path.split('/').filter(Boolean);
    const entryKey = segments[segments.length - 1] ?? bv.path;
    const parentPath = segments.length > 1
      ? '/' + segments.slice(0, -1).join('/')
      : '/';

    const entry: DataModelEntry = { key: entryKey };

    if (bv.literalString !== undefined) {
      entry.valueString = bv.literalString;
    } else if (bv.literalNumber !== undefined) {
      entry.valueNumber = bv.literalNumber;
    } else if (bv.literalBoolean !== undefined) {
      entry.valueBoolean = bv.literalBoolean;
    }

    result.push({ parentPath, entry });
  }

  return result;
}
