/**
 * binding 工具模块单元测试
 *
 * 覆盖：
 *  - parseAdjacencyListToObject: 邻接表 → 嵌套对象
 *  - isBoundValue: BoundValue 类型检测
 *  - resolveBoundValue: 单值解析（literal / path / 简写）
 *  - resolveProps: 批量 props 解析
 *  - extractInitShorthand: 简写提取（path + literal → DataModelEntry）
 *
 * 注意：这些函数位于 ../binding/index.ts（尚未创建），测试先写后实现。
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  parseAdjacencyListToObject,
  isBoundValue,
  resolveBoundValue,
  resolveProps,
  extractInitShorthand,
} from '../binding/index.js';
import type { DataModelEntry, DataModelMapEntry, BoundValue, ShorthandEntry } from '../binding/index.js';

// ============================================================================
// parseAdjacencyListToObject
// ============================================================================

describe('binding - parseAdjacencyListToObject', () => {
  it('扁平 key-valueString 转为对象', () => {
    const entries: DataModelEntry[] = [
      { key: 'name', valueString: 'Bob' },
      { key: 'age', valueNumber: 25 },
      { key: 'active', valueBoolean: true },
    ];
    const result = parseAdjacencyListToObject(entries);
    expect(result).to.deep.equal({
      name: 'Bob',
      age: 25,
      active: true,
    });
  });

  it('valueMap 将邻接表转为嵌套对象（协议标准：一级 valueMap）', () => {
    const entries: DataModelEntry[] = [
      {
        key: 'user',
        valueMap: [
          { key: 'name', valueString: 'Alice' },
          { key: 'age', valueNumber: 30 },
          { key: 'active', valueBoolean: true },
        ],
      },
      { key: 'version', valueNumber: 1 },
    ];
    const result = parseAdjacencyListToObject(entries);
    expect(result).to.deep.equal({
      user: {
        name: 'Alice',
        age: 30,
        active: true,
      },
      version: 1,
    });
  });

  it('深层嵌套通过 path 参数分层写入实现（非 valueMap 递归）', () => {
    // 协议不支持 valueMap 内再嵌套 valueMap
    // 深层结构通过多次 dataModelUpdate 调用 + path 参数逐层构建
    // 这里验证 parseAdjacencyListToObject + setDataModelAt 组合：
    // 第一次：path="/" → { user: { address: {...} } }
    // 第二次：path="/user/address" → { city: "Beijing", zip: "100000" }
    // 综合结果：{ user: { address: { city: "Beijing", zip: "100000" } } }

    // 模拟 step 1：根路径写入 address map
    const step1 = parseAdjacencyListToObject([
      {
        key: 'address',
        valueMap: [
          { key: 'city', valueString: 'Beijing' },
          { key: 'zip', valueString: '100000' },
        ],
      },
    ]);
    expect(step1).to.deep.equal({
      address: { city: 'Beijing', zip: '100000' },
    });
  });

  it('空数组返回空对象', () => {
    expect(parseAdjacencyListToObject([])).to.deep.equal({});
  });

  it('valueMap 中 valueString/valueNumber/valueBoolean 正确解析', () => {
    const entries: DataModelEntry[] = [
      { key: 'str', valueString: 'hello' },
      { key: 'num', valueNumber: 42 },
      { key: 'flag', valueBoolean: false },
    ];
    const result = parseAdjacencyListToObject(entries);
    expect(result.str).to.equal('hello');
    expect(result.num).to.equal(42);
    expect(result.flag).to.equal(false);
  });
});

// ============================================================================
// isBoundValue
// ============================================================================

describe('binding - isBoundValue', () => {
  it('literalString 检测为 BoundValue', () => {
    expect(isBoundValue({ literalString: 'hi' })).to.be.true;
  });

  it('literalNumber 检测为 BoundValue', () => {
    expect(isBoundValue({ literalNumber: 42 })).to.be.true;
  });

  it('literalBoolean 检测为 BoundValue（含 false）', () => {
    expect(isBoundValue({ literalBoolean: true })).to.be.true;
    expect(isBoundValue({ literalBoolean: false })).to.be.true;
  });

  it('literalArray 检测为 BoundValue', () => {
    expect(isBoundValue({ literalArray: ['a', 'b'] })).to.be.true;
  });

  it('path 检测为 BoundValue', () => {
    expect(isBoundValue({ path: '/user/name' })).to.be.true;
  });

  it('普通字符串不是 BoundValue', () => {
    expect(isBoundValue('hello')).to.be.false;
  });

  it('普通数字不是 BoundValue', () => {
    expect(isBoundValue(42)).to.be.false;
  });

  it('null / undefined 不是 BoundValue', () => {
    expect(isBoundValue(null)).to.be.false;
    expect(isBoundValue(undefined)).to.be.false;
  });

  it('空对象 {} 不是 BoundValue（无 literal* 或 path key）', () => {
    expect(isBoundValue({})).to.be.false;
  });

  it('普通对象 {foo: "bar"} 不是 BoundValue', () => {
    expect(isBoundValue({ foo: 'bar' })).to.be.false;
  });
});

// ============================================================================
// resolveBoundValue
// ============================================================================

describe('binding - resolveBoundValue', () => {
  const dataModel = {
    user: { name: 'Bob', age: 30 },
    title: 'Welcome',
    count: 5,
    flag: true,
  };

  it('仅 literalString → 返回字符串值', () => {
    const bv: BoundValue = { literalString: 'Hello' };
    expect(resolveBoundValue(bv, dataModel)).to.equal('Hello');
  });

  it('仅 literalNumber → 返回数值', () => {
    expect(resolveBoundValue({ literalNumber: 100 }, dataModel)).to.equal(100);
  });

  it('仅 literalBoolean → 返回布尔值', () => {
    expect(resolveBoundValue({ literalBoolean: true }, dataModel)).to.be.true;
    expect(resolveBoundValue({ literalBoolean: false }, dataModel)).to.be.false;
  });

  it('仅 literalArray → 返回数组', () => {
    expect(resolveBoundValue({ literalArray: ['a', 'b'] }, dataModel)).to.deep.equal(['a', 'b']);
  });

  it('仅 path → 从 dataModel 取值', () => {
    expect(resolveBoundValue({ path: '/user/name' }, dataModel)).to.equal('Bob');
    expect(resolveBoundValue({ path: '/user/age' }, dataModel)).to.equal(30);
    expect(resolveBoundValue({ path: '/title' }, dataModel)).to.equal('Welcome');
    expect(resolveBoundValue({ path: '/count' }, dataModel)).to.equal(5);
  });

  it('path + literalString 简写 → dataModel 有值时返回 dataModel 值', () => {
    const bv: BoundValue = { path: '/user/name', literalString: 'Default' };
    expect(resolveBoundValue(bv, dataModel)).to.equal('Bob');
  });

  it('path + literal 简写 → dataModel 无值时返回 literal 兜底', () => {
    const bv: BoundValue = { path: '/nonexistent', literalString: 'Fallback' };
    expect(resolveBoundValue(bv, dataModel)).to.equal('Fallback');
  });

  it('path 不存在且无 literal → 返回 undefined', () => {
    expect(resolveBoundValue({ path: '/ghost' }, dataModel)).to.be.undefined;
  });

  it('path 不存在且无 literal → 不抛错', () => {
    expect(() => {
      resolveBoundValue({ path: '/a/b/c/d/e' }, dataModel);
    }).to.not.throw();
  });

  it('空 dataModel 且仅 path → 返回 undefined', () => {
    expect(resolveBoundValue({ path: '/x' }, {})).to.be.undefined;
  });

  it('绝对路径从根开始解析', () => {
    expect(resolveBoundValue({ path: '/user/name' }, dataModel)).to.equal('Bob');
  });

  it('相对路径（不以 / 开头）从 root 查找', () => {
    // 相对路径等价于绝对路径处理
    expect(resolveBoundValue({ path: 'title' }, dataModel)).to.equal('Welcome');
  });

  it('contextPath 下相对路径拼接后查找', () => {
    // 模板上下文：全量 data model + contextPath 定位到具体 item
    const fullModel = { items: { a: { name: 'Item A', price: '¥99' } } };
    expect(resolveBoundValue({ path: 'name' }, fullModel, '/items/a')).to.equal('Item A');
  });
});

// ============================================================================
// resolveProps
// ============================================================================

describe('binding - resolveProps', () => {
  const dataModel = {
    user: { name: 'Bob' },
    title: 'Hello',
  };

  it('解析 props 中的所有 BoundValue', () => {
    const props = {
      text: { path: '/user/name' },
      usageHint: 'h1', // 非 BoundValue，透传
      url: { literalString: 'https://example.com' },
    };
    const resolved = resolveProps(props, dataModel);
    expect(resolved).to.deep.equal({
      text: 'Bob',
      usageHint: 'h1',
      url: 'https://example.com',
    });
  });

  it('非 BoundValue 的 prop 原样透传', () => {
    const props = {
      distribution: 'center',
      alignment: 'stretch',
      children: { explicitList: ['a', 'b'] },
    };
    const resolved = resolveProps(props, dataModel);
    expect(resolved).to.deep.equal(props);
  });

  it('空 props 返回空对象', () => {
    expect(resolveProps({}, dataModel)).to.deep.equal({});
  });

  it('contextPath 传递给 resolveBoundValue', () => {
    const props = { text: { path: 'name' } };
    const fullModel = { items: { a: { name: 'Item X' } } };
    const resolved = resolveProps(props, fullModel, '/items/a');
    expect(resolved.text).to.equal('Item X');
  });
});

// ============================================================================
// extractInitShorthand
// ============================================================================

describe('binding - extractInitShorthand', () => {
  it('提取同时有 path 和 literalString 的 BoundValue', () => {
    const props = {
      text: { path: '/user/name', literalString: 'Guest' },
      usageHint: 'h1',
    };
    const result = extractInitShorthand(props);
    expect(result).to.have.lengthOf(1);
    expect(result[0].parentPath).to.equal('/user');
    expect(result[0].entry.key).to.equal('name');
    expect(result[0].entry.valueString).to.equal('Guest');
  });

  it('根路径简写 parentPath 为 /', () => {
    const props = { text: { path: '/title', literalString: 'Hello' } };
    const result = extractInitShorthand(props);
    expect(result[0].parentPath).to.equal('/');
    expect(result[0].entry.key).to.equal('title');
  });

  it('仅 path 无 literal → 不提取（不是简写）', () => {
    const props = { text: { path: '/user/name' } };
    expect(extractInitShorthand(props)).to.have.lengthOf(0);
  });

  it('仅 literal 无 path → 不提取', () => {
    const props = { text: { literalString: 'Static' } };
    expect(extractInitShorthand(props)).to.have.lengthOf(0);
  });

  it('多个 BoundValue 简写全部提取', () => {
    const props = {
      text: { path: '/a/x', literalString: 'X' },
      url: { path: '/b/y', literalString: 'Y' },
    };
    const result = extractInitShorthand(props);
    expect(result).to.have.lengthOf(2);
    expect(result[0].parentPath).to.equal('/a');
    expect(result[1].parentPath).to.equal('/b');
  });

  it('非 BoundValue 的 prop 被忽略', () => {
    const props = {
      distribution: 'center',
      text: { path: '/title', literalString: 'T' },
    };
    const result = extractInitShorthand(props);
    expect(result).to.have.lengthOf(1);
  });

  it('空 props 返回空数组', () => {
    expect(extractInitShorthand({})).to.have.lengthOf(0);
  });
});
