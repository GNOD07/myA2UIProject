/**
 * treeBuilder 单元测试
 *
 * 覆盖：
 *  - resolveNode: 叶子节点 / 容器递归解析
 *  - buildTree: 完整组件树构建
 *  - 嵌套容器
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { initStore, getStore, destroyStore } from '../store/index.js';
import { loadJsonlIntoStore } from '../parser/index.js';
import { buildTree, resolveNode } from '../treeBuilder/index.js';
import type { RenderMap, HydrateNode } from '../store/types.js';

function readMock(fileName: string): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(__dirname, '..', '..', 'mock', fileName);
  return fs.readFileSync(filePath, 'utf-8');
}

const COLUMN_MOCK = readMock('column-mock.json');

// 测试用 renderMap：Text 返回带标记的 VNode，Column 返回容器中间表示
const testRenderMap: RenderMap = {
  Text: (props) => ({
    __rendered: true,
    type: 'Text',
    props,
  }),
  Column: (props) => ({
    __a2ui_container: true,
    type: 'Column',
    props: { distribution: props.distribution ?? 'start', alignment: props.alignment ?? 'stretch' },
    childIds: props.children?.explicitList ?? [],
  }),
};

describe('treeBuilder - resolveNode', () => {
  beforeEach(() => {
    destroyStore();
  });

  it('should return leaf node _vnode directly (no container)', () => {
    const nodeMap: Record<string, HydrateNode> = {
      t1: {
        componentId: 't1',
        _vnode: { __rendered: true, type: 'Text', props: { text: { literalString: 'Hi' } } },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
    };

    const result = resolveNode(nodeMap['t1'], nodeMap);
    expect(result).to.deep.equal(nodeMap['t1']._vnode);
  });

  it('should resolve container children from nodeMap', () => {
    const nodeMap: Record<string, HydrateNode> = {
      col: {
        componentId: 'col',
        _vnode: {
          __a2ui_container: true,
          type: 'Column',
          props: { distribution: 'center', alignment: 'stretch' },
          childIds: ['t1', 't2'],
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
      t1: {
        componentId: 't1',
        _vnode: { __rendered: true, type: 'Text', props: { text: { literalString: 'A' } } },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
      t2: {
        componentId: 't2',
        _vnode: { __rendered: true, type: 'Text', props: { text: { literalString: 'B' } } },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
    };

    const result = resolveNode(nodeMap['col'], nodeMap) as any;

    expect(result).to.have.property('__a2ui_container', true);
    expect(result.type).to.equal('Column');
    expect(result.children).to.be.an('array').with.lengthOf(2);
    expect(result.children[0]).to.deep.equal(nodeMap['t1']._vnode);
    expect(result.children[1]).to.deep.equal(nodeMap['t2']._vnode);
  });

  it('should skip missing child IDs gracefully', () => {
    const nodeMap: Record<string, HydrateNode> = {
      col: {
        componentId: 'col',
        _vnode: {
          __a2ui_container: true,
          type: 'Column',
          props: {},
          childIds: ['t1', 'missing', 't2'],
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
      t1: {
        componentId: 't1',
        _vnode: { __rendered: true, type: 'Text', props: {} },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
      t2: {
        componentId: 't2',
        _vnode: { __rendered: true, type: 'Text', props: {} },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
    };

    const result = resolveNode(nodeMap['col'], nodeMap) as any;
    expect(result.children).to.have.lengthOf(2); // missing filtered out
  });

  it('should recursively resolve nested containers', () => {
    const nodeMap: Record<string, HydrateNode> = {
      outer: {
        componentId: 'outer',
        _vnode: {
          __a2ui_container: true,
          type: 'Column',
          props: {},
          childIds: ['inner', 't1'],
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
      inner: {
        componentId: 'inner',
        _vnode: {
          __a2ui_container: true,
          type: 'Column',
          props: {},
          childIds: ['t2'],
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
      t1: {
        componentId: 't1',
        _vnode: { __rendered: true, type: 'Text', props: { text: { literalString: 'T1' } } },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
      t2: {
        componentId: 't2',
        _vnode: { __rendered: true, type: 'Text', props: { text: { literalString: 'T2' } } },
        ownerSurfaceId: 's1',
        protocol: '{}',
      },
    };

    const result = resolveNode(nodeMap['outer'], nodeMap) as any;

    // outer → [inner, t1]
    expect(result.children).to.have.lengthOf(2);

    // inner 本身是容器，已被递归解析
    const innerResult = result.children[0];
    expect(innerResult).to.have.property('__a2ui_container', true);
    expect(innerResult.children).to.have.lengthOf(1);
    expect(innerResult.children[0]).to.deep.equal(nodeMap['t2']._vnode);

    // t1 是叶子节点
    expect(result.children[1]).to.deep.equal(nodeMap['t1']._vnode);
  });
});

describe('treeBuilder - buildTree with column mock', () => {
  beforeEach(() => {
    destroyStore();
  });

  it('should build tree from column-mock.json with Column + 3 Text children', () => {
    initStore(testRenderMap);
    loadJsonlIntoStore(COLUMN_MOCK);

    const trees = buildTree();
    expect(trees).to.be.an('array').with.lengthOf(1);

    const tree = trees[0];
    expect(tree.surfaceId).to.equal('main_surface');

    // rootComponent 是 Column 容器，已递归解析 children
    const root = tree.rootComponent as any;
    expect(root).to.have.property('__a2ui_container', true);
    expect(root.type).to.equal('Column');
    expect(root.props.distribution).to.equal('start');
    expect(root.props.alignment).to.equal('stretch');

    // children 应为 3 个 Text
    expect(root.children).to.be.an('array').with.lengthOf(3);

    // text1
    expect(root.children[0]).to.have.property('__rendered', true);
    expect(root.children[0].props.text.literalString).to.include('大标题');
    expect(root.children[0].props.usageHint).to.equal('h1');

    // text2
    expect(root.children[1].props.text.literalString).to.include('正文');
    expect(root.children[1].props.usageHint).to.equal('h2');

    // text3
    expect(root.children[2].props.text.literalString).to.include('脚注');
    expect(root.children[2].props.usageHint).to.equal('h3');
  });
});

// ============================================================================
// ComponentVNode + BoundValue 解析测试
// ============================================================================

describe('treeBuilder - ComponentVNode BoundValue resolution', () => {
  beforeEach(() => {
    destroyStore();
  });

  it('resolveNode 对 ComponentVNode 解析 BoundValue（path → 值）', () => {
    initStore();
    const store = getStore();
    store.getState().setDataModelAt('s1', '/', { user: { name: 'Bob' } });

    const nodeMap: Record<string, HydrateNode> = {
      t1: {
        componentId: 't1',
        _vnode: {
          __a2ui_component: true,
          type: 'Text',
          props: { text: { path: '/user/name' }, usageHint: 'h2' },
          componentId: 't1',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const dataModel = store.getState().getDataModel('s1');
    const result = resolveNode(nodeMap['t1'], nodeMap, dataModel) as any;

    // props 中的 BoundValue 已被解析为实际值
    expect(result).to.have.property('__a2ui_component', true);
    expect(result.props.text).to.equal('Bob');
    expect(result.props.usageHint).to.equal('h2');
  });

  it('resolveNode 对 ComponentVNode 仅 literalString → 直接返回', () => {
    initStore();
    const store = getStore();
    store.getState().setDataModelAt('s1', '/', {});

    const nodeMap: Record<string, HydrateNode> = {
      t1: {
        componentId: 't1',
        _vnode: {
          __a2ui_component: true,
          type: 'Text',
          props: { text: { literalString: 'Static' } },
          componentId: 't1',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const dataModel = store.getState().getDataModel('s1');
    const result = resolveNode(nodeMap['t1'], nodeMap, dataModel) as any;

    expect(result.props.text).to.equal('Static');
  });

  it('resolveNode 无 dataModel 时 literalString 正常解析，path 返回 undefined', () => {
    initStore();
    const nodeMap: Record<string, HydrateNode> = {
      t1: {
        componentId: 't1',
        _vnode: {
          __a2ui_component: true,
          type: 'Text',
          props: { text: { path: '/user/name' } },
          componentId: 't1',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    // 不传 dataModel — path 值解析为 undefined（无 literal 兜底）
    const result = resolveNode(nodeMap['t1'], nodeMap) as any;
    expect(result.props.text).to.be.undefined;
  });

  it('叶子节点（非 ContainerVNode/ComponentVNode）直接透传', () => {
    initStore();
    const nodeMap: Record<string, HydrateNode> = {
      t1: {
        componentId: 't1',
        _vnode: { __rendered: true, type: 'Text', props: { text: 'Hi' } },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const result = resolveNode(nodeMap['t1'], nodeMap, {});
    expect(result).to.deep.equal(nodeMap['t1']._vnode);
  });
});

// ============================================================================
// Template 动态列表展开测试
// ============================================================================

describe('treeBuilder - Template expansion', () => {
  beforeEach(() => {
    destroyStore();
  });

  it('ContainerVNode with template 从 dataModel 展开 children', () => {
    initStore();
    const store = getStore();
    store.getState().setDataModelAt('s1', '/', {
      items: {
        a: { name: 'Alpha', price: '¥10' },
        b: { name: 'Beta', price: '¥20' },
      },
    });

    const nodeMap: Record<string, HydrateNode> = {
      row: {
        componentId: 'row',
        _vnode: {
          __a2ui_container: true,
          type: 'Row',
          props: {},
          childIds: [],
          template: { componentId: 'item_tpl', dataBinding: '/items' },
          componentId: 'row',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      item_tpl: {
        componentId: 'item_tpl',
        _vnode: {
          __a2ui_component: true,
          type: 'Text',
          props: { text: { path: 'name' } },
          componentId: 'item_tpl',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const dataModel = store.getState().getDataModel('s1');
    const result = resolveNode(nodeMap['row'], nodeMap, dataModel) as any;

    // 容器仍然保留
    expect(result).to.have.property('__a2ui_container', true);
    // children 已从模板展开：2 个 item
    expect(result.children).to.be.an('array').with.lengthOf(2);

    // 每个 child 是 item_tpl 的克隆，props 已相对于 item data 解析
    // child[0] 对应 items.a
    expect(result.children[0]).to.have.property('__a2ui_component', true);
    expect(result.children[0].props.text).to.equal('Alpha');

    // child[1] 对应 items.b
    expect(result.children[1]).to.have.property('__a2ui_component', true);
    expect(result.children[1].props.text).to.equal('Beta');
  });

  it('template dataBinding 指向不存在路径时返回空 children', () => {
    initStore();
    const store = getStore();
    store.getState().setDataModelAt('s1', '/', {});

    const nodeMap: Record<string, HydrateNode> = {
      row: {
        componentId: 'row',
        _vnode: {
          __a2ui_container: true,
          type: 'Row',
          props: {},
          childIds: [],
          template: { componentId: 'item_tpl', dataBinding: '/nonexistent' },
          componentId: 'row',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      item_tpl: {
        componentId: 'item_tpl',
        _vnode: { __a2ui_component: true, type: 'Text', props: {}, componentId: 'item_tpl' },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const dataModel = store.getState().getDataModel('s1');
    const result = resolveNode(nodeMap['row'], nodeMap, dataModel) as any;

    expect(result.children).to.be.an('array').that.is.empty;
  });

  it('template 无 dataModel 时返回空 children（不崩溃）', () => {
    initStore();
    const nodeMap: Record<string, HydrateNode> = {
      row: {
        componentId: 'row',
        _vnode: {
          __a2ui_container: true,
          type: 'Row',
          props: {},
          childIds: [],
          template: { componentId: 'item_tpl', dataBinding: '/items' },
          componentId: 'row',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      item_tpl: {
        componentId: 'item_tpl',
        _vnode: { __a2ui_component: true, type: 'Text', props: {}, componentId: 'item_tpl' },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const result = resolveNode(nodeMap['row'], nodeMap) as any;
    expect(result.children).to.be.an('array').that.is.empty;
  });

  it('template 组件本身是容器时递归展开', () => {
    initStore();
    const store = getStore();
    store.getState().setDataModelAt('s1', '/', {
      items: {
        x: { title: 'Card X', desc: 'Description X' },
      },
    });

    const nodeMap: Record<string, HydrateNode> = {
      list: {
        componentId: 'list',
        _vnode: {
          __a2ui_container: true,
          type: 'Column',
          props: {},
          childIds: [],
          template: { componentId: 'card_tpl', dataBinding: '/items' },
          componentId: 'list',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      card_tpl: {
        componentId: 'card_tpl',
        _vnode: {
          __a2ui_container: true,
          type: 'Card',
          props: {},
          childIds: ['inner_text'],
          componentId: 'card_tpl',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      inner_text: {
        componentId: 'inner_text',
        _vnode: {
          __a2ui_component: true,
          type: 'Text',
          props: { text: { path: 'title' } },
          componentId: 'inner_text',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const dataModel = store.getState().getDataModel('s1');
    const result = resolveNode(nodeMap['list'], nodeMap, dataModel) as any;

    // list 展开 1 个 child
    expect(result.children).to.have.lengthOf(1);
    // child 是 Card 容器
    const card = result.children[0];
    expect(card).to.have.property('__a2ui_container', true);
    expect(card).to.have.property('type', 'Card');
    // Card 的 children 已递归解析
    expect(card.children).to.have.lengthOf(1);
    // 内层 Text 的 title 已解析
    expect(card.children[0].props.text).to.equal('Card X');
  });

  it('explicitList 和 template 共存时 prioritizes template', () => {
    // 根据协议 children 必须包含 exactly one of explicitList 或 template
    // 这里测试同时存在时 template 优先
    initStore();
    const store = getStore();
    store.getState().setDataModelAt('s1', '/', {
      items: { a: { name: 'A' } },
    });

    const nodeMap: Record<string, HydrateNode> = {
      row: {
        componentId: 'row',
        _vnode: {
          __a2ui_container: true,
          type: 'Row',
          props: {},
          childIds: ['static_child'],
          template: { componentId: 'tpl', dataBinding: '/items' },
          componentId: 'row',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      static_child: {
        componentId: 'static_child',
        _vnode: { __a2ui_component: true, type: 'Text', props: { text: { literalString: 'Static' } }, componentId: 'static_child' },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      tpl: {
        componentId: 'tpl',
        _vnode: { __a2ui_component: true, type: 'Text', props: { text: { path: 'name' } }, componentId: 'tpl' },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const dataModel = store.getState().getDataModel('s1');
    const result = resolveNode(nodeMap['row'], nodeMap, dataModel) as any;

    // template 展开的 children 取代 explicitList
    expect(result.children).to.have.lengthOf(1);
    expect(result.children[0].props.text).to.equal('A');
  });
});

// ============================================================================
// List ContainerVNode 测试
// ============================================================================

describe('treeBuilder - List ContainerVNode', () => {
  beforeEach(() => {
    destroyStore();
  });

  it('List + template 从 dataModel 展开 children 并保留 direction/alignment props', () => {
    initStore();
    const store = getStore();
    store.getState().setDataModelAt('s1', '/', {
      fruits: {
        a: { name: '苹果', emoji: '🍎' },
        b: { name: '香蕉', emoji: '🍌' },
        c: { name: '橙子', emoji: '🍊' },
      },
    });

    const nodeMap: Record<string, HydrateNode> = {
      list: {
        componentId: 'list',
        _vnode: {
          __a2ui_container: true,
          type: 'List',
          props: { direction: 'vertical', alignment: 'stretch' },
          childIds: [],
          template: { componentId: 'item_tpl', dataBinding: '/fruits' },
          componentId: 'list',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      item_tpl: {
        componentId: 'item_tpl',
        _vnode: {
          __a2ui_component: true,
          type: 'Text',
          props: { text: { path: 'name' }, usageHint: 'body' },
          componentId: 'item_tpl',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const dataModel = store.getState().getDataModel('s1');
    const result = resolveNode(nodeMap['list'], nodeMap, dataModel) as any;

    // List 容器保留
    expect(result).to.have.property('__a2ui_container', true);
    expect(result.type).to.equal('List');
    // direction/alignment props 保留
    expect(result.props.direction).to.equal('vertical');
    expect(result.props.alignment).to.equal('stretch');

    // children 已从模板展开：3 个水果
    expect(result.children).to.be.an('array').with.lengthOf(3);

    // 验证每个 item 数据正确 + 唯一 componentId
    expect(result.children[0]).to.have.property('__a2ui_component', true);
    expect(result.children[0].props.text).to.equal('苹果');
    expect(result.children[0].componentId).to.equal('item_tpl_a');

    expect(result.children[1].props.text).to.equal('香蕉');
    expect(result.children[1].componentId).to.equal('item_tpl_b');

    expect(result.children[2].props.text).to.equal('橙子');
    expect(result.children[2].componentId).to.equal('item_tpl_c');
  });

  it('List + explicitList 静态子节点正常解析', () => {
    initStore();
    const store = getStore();

    const nodeMap: Record<string, HydrateNode> = {
      list: {
        componentId: 'list',
        _vnode: {
          __a2ui_container: true,
          type: 'List',
          props: { direction: 'horizontal', alignment: 'center' },
          childIds: ['t1', 't2'],
          componentId: 'list',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      t1: {
        componentId: 't1',
        _vnode: {
          __a2ui_component: true,
          type: 'Text',
          props: { text: { literalString: 'Item 1' } },
          componentId: 't1',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
      t2: {
        componentId: 't2',
        _vnode: {
          __a2ui_component: true,
          type: 'Text',
          props: { text: { literalString: 'Item 2' } },
          componentId: 't2',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const dataModel = store.getState().getDataModel('s1') ?? {};
    const result = resolveNode(nodeMap['list'], nodeMap, dataModel) as any;

    expect(result.type).to.equal('List');
    expect(result.props.direction).to.equal('horizontal');
    expect(result.props.alignment).to.equal('center');
    expect(result.children).to.have.lengthOf(2);
    // literalString 被 resolveProps 解析为纯字符串
    expect(result.children[0].props.text).to.equal('Item 1');
    expect(result.children[1].props.text).to.equal('Item 2');
  });

  it('List direction=horizontal 正确传递到 props', () => {
    initStore();
    const store = getStore();

    const nodeMap: Record<string, HydrateNode> = {
      list: {
        componentId: 'list',
        _vnode: {
          __a2ui_container: true,
          type: 'List',
          props: { direction: 'horizontal', alignment: 'start' },
          childIds: [],
          componentId: 'list',
        },
        ownerSurfaceId: 's1',
        protocol: '{}',
        hasMounted: false,
      },
    };

    const dataModel = store.getState().getDataModel('s1');
    const result = resolveNode(nodeMap['list'], nodeMap, dataModel) as any;

    expect(result.props.direction).to.equal('horizontal');
    expect(result.props.alignment).to.equal('start');
  });
});
