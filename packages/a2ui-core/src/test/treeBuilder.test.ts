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
