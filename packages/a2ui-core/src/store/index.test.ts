/**
 * @file store 单元测试
 *
 * 验证 store 实现是否符合 store.md 契约：
 *  1. 维护原始协议          — HydrateNode.protocol 存储 JSONLine 原文
 *  2. Surface 管理          — Surface 的 CRUD 及 rootNode 指针
 *  3. 组件节点打平          — 所有组件以 componentId 为 key 存入 hydrateNodeMap
 *  4. Error 信息            — 错误实体的 CRUD
 *  5. by id 梯度查找        — 所有查找通过 Map key O(1) 完成
 *  6. zustand/vanilla 实现  — 解除 React 依赖
 *  7. 全局单例              — getStore / initStore 返回同一实例
 */

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { initStore, getStore, destroyStore, resetStore } from './index.js';
import { ErrorType } from './types.js';
import type { Surface, HydrateNode, A2UIError } from './types.js';

// ============================================================================
// Mock 数据工厂 —— 模拟 A2UI JSONLine 协议解析后的真实场景
// ============================================================================

/**
 * 模拟一段 A2UI JSONLine 协议的解析结果。
 *
 * 协议原文（JSONLine，每行一条消息）：
 *   {"surfaceId":"main-page","createSurface":true}
 *   {"componentId":"root-col","componentType":"Column","ownerSurfaceId":"main-page","props":{"children":["name-field","greeting-text","submit-btn"]}}
 *   {"componentId":"name-field","componentType":"TextField","ownerSurfaceId":"main-page","props":{"label":"Name","value":""}}
 *   {"componentId":"greeting-text","componentType":"Text","ownerSurfaceId":"main-page","props":{"test":"Hello"}}
 *   {"componentId":"submit-btn","componentType":"Button","ownerSurfaceId":"main-page","props":{"label":"Submit"}}
 *
 *   — 第 6 行是损坏的 JSON，触发 PARSE_ERROR —
 *   {bad
 */

/** 模拟 HydrateNode：Column 容器（根节点） */
function mockRootColumn(): HydrateNode {
  return {
    componentId: 'root-col',
    ownerSurfaceId: 'main-page',
    _vnode: { type: 'Column', props: { children: ['name-field', 'greeting-text', 'submit-btn'] } },
    protocol: '{"componentId":"root-col","componentType":"Column","ownerSurfaceId":"main-page","props":{"children":["name-field","greeting-text","submit-btn"]}}',
  };
}

/** 模拟 HydrateNode：Text 文本组件 */
function mockTextNode(): HydrateNode {
  return {
    componentId: 'greeting-text',
    ownerSurfaceId: 'main-page',
    _vnode: { type: 'Text', props: { test: 'Hello' } },
    protocol: '{"componentId":"greeting-text","componentType":"Text","ownerSurfaceId":"main-page","props":{"test":"Hello"}}',
  };
}

/** 模拟 HydrateNode：TextField 输入组件 */
function mockTextField(): HydrateNode {
  return {
    componentId: 'name-field',
    ownerSurfaceId: 'main-page',
    _vnode: { type: 'TextField', props: { label: 'Name', value: '' } },
    protocol: '{"componentId":"name-field","componentType":"TextField","ownerSurfaceId":"main-page","props":{"label":"Name","value":""}}',
  };
}

/** 模拟 HydrateNode：Button 按钮组件 */
function mockButton(): HydrateNode {
  return {
    componentId: 'submit-btn',
    ownerSurfaceId: 'main-page',
    _vnode: { type: 'Button', props: { label: 'Submit' } },
    protocol: '{"componentId":"submit-btn","componentType":"Button","ownerSurfaceId":"main-page","props":{"label":"Submit"}}',
  };
}

/** 模拟 Surface：主页面，rootNode 是指向 hydrateNodeMap 中 HydrateNode 实例的指针 */
function mockSurface(rootNode: HydrateNode | null = null): Surface {
  return {
    surfaceId: 'main-page',
    beginRender: false,
    rootNode,
    rootComponentId: null,
  };
}

/** 模拟 A2UIError：JSONLine 解析失败 */
function mockParseError(): A2UIError {
  return {
    id: 'err-001',
    type: ErrorType.PARSE_ERROR,
    content: 'Unexpected token at line 6: {bad',
    surfaceId: 'main-page',
    componentId: undefined,
  };
}

// ============================================================================
// 测试套件
// ============================================================================

describe('A2UI Store (contract validation against store.md)', () => {
  beforeEach(() => {
    destroyStore();
  });

  // --------------------------------------------------------------------------
  // 1. 全局单例 & 初始状态
  // --------------------------------------------------------------------------

  describe('1. 全局单例', () => {
    it('initStore / getStore 返回同一实例', () => {
      const a = initStore();
      const b = getStore();
      expect(a).to.equal(b);
    });

    it('初始状态三张 Map 均为空', () => {
      const store = initStore();
      const s = store.getState();
      expect(s.surfaceMap).to.deep.equal({});
      expect(s.hydrateNodeMap).to.deep.equal({});
      expect(s.errorMap).to.deep.equal({});
    });
  });

  // --------------------------------------------------------------------------
  // 2. Surface CRUD（store.md 第 2 条：surface 管理）
  // --------------------------------------------------------------------------

  describe('2. Surface CRUD', () => {
    it('addSurface — 添加渲染表面（rootNode 为 null）', () => {
      const store = initStore();
      store.getState().addSurface(mockSurface(null));

      const s = store.getState().getSurface('main-page');
      expect(s).to.exist;
      expect(s!.surfaceId).to.equal('main-page');
      expect(s!.beginRender).to.equal(false);
      expect(s!.rootNode).to.be.null;
    });

    it('addSurface — 添加渲染表面，rootNode 指针指向 hydrateNodeMap 中的实例', () => {
      const store = initStore();
      const rootCol = mockRootColumn();

      // parser 流程：先加节点，再加 surface（此时 rootNode 可指向已存在的节点）
      store.getState().addHydrateNode(rootCol);
      store.getState().addSurface(mockSurface(rootCol));

      const s = store.getState().getSurface('main-page');
      expect(s).to.exist;
      // rootNode 本身就是 HydrateNode 实例
      expect(s!.rootNode).to.equal(rootCol);
      expect(s!.rootNode!.componentId).to.equal('root-col');
    });

    it('updateSurface — 更新 beginRender 状态', () => {
      const store = initStore();
      store.getState().addSurface(mockSurface(null));
      store.getState().updateSurface('main-page', { beginRender: true });

      const s = store.getState().getSurface('main-page');
      expect(s!.beginRender).to.equal(true);
    });

    it('updateSurface — 更新 rootNode 指针', () => {
      const store = initStore();
      const rootCol = mockRootColumn();
      store.getState().addHydrateNode(rootCol);
      store.getState().addSurface(mockSurface(null));
      store.getState().updateSurface('main-page', { rootNode: rootCol });

      const s = store.getState().getSurface('main-page');
      expect(s!.rootNode).to.equal(rootCol);
    });

    it('updateSurface — 对不存在的 surfaceId 安全无操作', () => {
      const store = initStore();
      expect(() => {
        store.getState().updateSurface('ghost', { beginRender: true });
      }).to.not.throw();
    });

    it('removeSurface — 删除渲染表面', () => {
      const store = initStore();
      store.getState().addSurface(mockSurface(null));
      store.getState().removeSurface('main-page');

      expect(store.getState().getSurface('main-page')).to.be.undefined;
      expect(store.getState().surfaceMap).to.deep.equal({});
    });
  });

  // --------------------------------------------------------------------------
  // 3. HydrateNode CRUD（store.md 第 3 条：组件节点打平，第 1 条：维护原始协议）
  // --------------------------------------------------------------------------

  describe('3. HydrateNode CRUD —— 组件节点打平 + 维护原始协议', () => {
    it('addHydrateNode — 添加水合节点，以 componentId 为 key 打平存储', () => {
      const store = initStore();

      // 模拟 parser 一次性构建所有组件节点 —— 空间换时间
      const nodes = [mockRootColumn(), mockTextNode(), mockTextField(), mockButton()];
      for (const node of nodes) {
        store.getState().addHydrateNode(node);
      }

      const s = store.getState();

      // 验证打平存储：每个 componentId 可 O(1) 查找
      expect(Object.keys(s.hydrateNodeMap)).to.have.lengthOf(4);
      expect(s.getHydrateNode('root-col')).to.exist;
      expect(s.getHydrateNode('greeting-text')).to.exist;
      expect(s.getHydrateNode('name-field')).to.exist;
      expect(s.getHydrateNode('submit-btn')).to.exist;
    });

    it('维护原始协议 — 每个节点保留 JSONLine 协议原文', () => {
      const store = initStore();
      store.getState().addHydrateNode(mockTextNode());

      const node = store.getState().getHydrateNode('greeting-text');
      expect(node!.protocol).to.equal(
        '{"componentId":"greeting-text","componentType":"Text","ownerSurfaceId":"main-page","props":{"test":"Hello"}}',
      );
    });

    it('_vnode 存储虚拟节点（解除 React 依赖，使用通用结构）', () => {
      const store = initStore();
      store.getState().addHydrateNode(mockTextField());

      const node = store.getState().getHydrateNode('name-field');
      expect(node!._vnode).to.deep.equal({
        type: 'TextField',
        props: { label: 'Name', value: '' },
      });
    });

    it('updateHydrateNode — 更新节点（如刷新 vnode）', () => {
      const store = initStore();
      store.getState().addHydrateNode(mockTextNode());
      store.getState().updateHydrateNode('greeting-text', {
        _vnode: { type: 'Text', props: { test: 'Updated Hello' } },
        protocol: '{"componentId":"greeting-text","componentType":"Text","ownerSurfaceId":"main-page","props":{"test":"Updated Hello"}}',
      });

      const node = store.getState().getHydrateNode('greeting-text');
      expect((node!._vnode as any).props.test).to.equal('Updated Hello');
    });

    it('removeHydrateNode — 删除节点', () => {
      const store = initStore();
      store.getState().addHydrateNode(mockTextNode());
      store.getState().removeHydrateNode('greeting-text');

      expect(store.getState().getHydrateNode('greeting-text')).to.be.undefined;
    });
  });

  // --------------------------------------------------------------------------
  // 4. Surface + HydrateNode 关联验证（store.md: rootNode 指针直接指向实例）
  // --------------------------------------------------------------------------

  describe('4. Surface ↔ HydrateNode 关联（rootNode 指针）', () => {
    it('rootNode 直接指向 hydrateNodeMap 中的实例，无需二次查找', () => {
      const store = initStore();
      const rootCol = mockRootColumn();

      // parser 流程：先构建节点，再构建 surface 并设置 rootNode 指针
      store.getState().addHydrateNode(rootCol);
      store.getState().addSurface(mockSurface(rootCol));

      const surface = store.getState().getSurface('main-page');

      // rootNode 本身就是 HydrateNode 实例
      expect(surface!.rootNode).to.equal(rootCol);
      expect(surface!.rootNode!.componentId).to.equal('root-col');
      expect(surface!.rootNode!._vnode).to.deep.equal(rootCol._vnode);
    });

    it('多个 surface 各自持有不同的 rootNode 指针', () => {
      const store = initStore();
      const rootCol1 = mockRootColumn();
      const rootCol2: HydrateNode = {
        ...mockRootColumn(),
        componentId: 'sidebar-root',
        ownerSurfaceId: 'sidebar',
      };

      store.getState().addHydrateNode(rootCol1);
      store.getState().addHydrateNode(rootCol2);

      store.getState().addSurface({ ...mockSurface(rootCol1), surfaceId: 'main-page' });
      store.getState().addSurface({
        surfaceId: 'sidebar',
        beginRender: false,
        rootNode: rootCol2,
        rootComponentId: null,
      });

      // 各自 rootNode 指向不同实例
      expect(store.getState().getSurface('main-page')!.rootNode!.componentId).to.equal('root-col');
      expect(store.getState().getSurface('sidebar')!.rootNode!.componentId).to.equal('sidebar-root');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Error CRUD（store.md 第 4 条：error 信息）
  // --------------------------------------------------------------------------

  describe('5. Error CRUD', () => {
    it('addError — 添加 PARSE_ERROR 类型错误', () => {
      const store = initStore();
      store.getState().addError(mockParseError());

      const err = store.getState().getError('err-001');
      expect(err).to.exist;
      expect(err!.type).to.equal(ErrorType.PARSE_ERROR);
      expect(err!.content).to.equal('Unexpected token at line 6: {bad');
      expect(err!.surfaceId).to.equal('main-page');
    });

    it('updateError — 更新错误内容', () => {
      const store = initStore();
      store.getState().addError(mockParseError());
      store.getState().updateError('err-001', { content: 'Updated error message' });

      expect(store.getState().getError('err-001')!.content).to.equal('Updated error message');
    });

    it('removeError — 删除错误', () => {
      const store = initStore();
      store.getState().addError(mockParseError());
      store.getState().removeError('err-001');

      expect(store.getState().getError('err-001')).to.be.undefined;
    });
  });

  // --------------------------------------------------------------------------
  // 6. 批量操作（clear / clearSurface）
  // --------------------------------------------------------------------------

  describe('6. 批量操作', () => {
    it('clear — 清空所有 Map', () => {
      const store = initStore();
      store.getState().addSurface(mockSurface(null));
      store.getState().addHydrateNode(mockTextNode());
      store.getState().addError(mockParseError());
      store.getState().clear();

      const s = store.getState();
      expect(s.surfaceMap).to.deep.equal({});
      expect(s.hydrateNodeMap).to.deep.equal({});
      expect(s.errorMap).to.deep.equal({});
    });

    it('clearSurface — 级联删除 surface 及其关联节点和错误', () => {
      const store = initStore();
      const rootCol = mockRootColumn();

      // 创建 main-page surface + 4 个节点 + 1 个错误
      store.getState().addHydrateNode(rootCol);
      store.getState().addHydrateNode(mockTextNode());
      store.getState().addHydrateNode(mockTextField());
      store.getState().addHydrateNode(mockButton());
      store.getState().addSurface(mockSurface(rootCol));
      store.getState().addError(mockParseError());

      // 再创建一个无关的第二个 surface
      const sidebarNode: HydrateNode = {
        componentId: 'sidebar-text',
        ownerSurfaceId: 'sidebar',
        _vnode: { type: 'Text', props: { test: 'Sidebar' } },
        protocol: '{"componentId":"sidebar-text","ownerSurfaceId":"sidebar",...}',
      };
      store.getState().addHydrateNode(sidebarNode);
      store.getState().addSurface({
        surfaceId: 'sidebar',
        beginRender: false,
        rootNode: null,
        rootComponentId: null,
      });

      // 执行级联删除
      store.getState().clearSurface('main-page');

      const s = store.getState();

      // main-page 的 surface 被删除
      expect(s.getSurface('main-page')).to.be.undefined;

      // main-page 的 4 个节点被删除
      expect(s.getHydrateNode('root-col')).to.be.undefined;
      expect(s.getHydrateNode('greeting-text')).to.be.undefined;
      expect(s.getHydrateNode('name-field')).to.be.undefined;
      expect(s.getHydrateNode('submit-btn')).to.be.undefined;

      // main-page 的错误被删除
      expect(s.getError('err-001')).to.be.undefined;

      // sidebar 不受影响
      expect(s.getSurface('sidebar')).to.exist;
      expect(s.getHydrateNode('sidebar-text')).to.exist;
    });
  });

  // --------------------------------------------------------------------------
  // 7. 完整流程：模拟 Parser 解析后构建 Store
  // --------------------------------------------------------------------------

  describe('7. 完整流程 — 模拟 Parser 解析 A2UI 协议后构建 Store', () => {
    /**
     * 模拟 parser 的工作流程：
     *   - 逐行解析 JSONLine 协议
     *   - 先将所有组件节点构建到 hydrateNodeMap（空间换时间）
     *   - 再构建 Surface 并将 rootNode 指针指向实际的 HydrateNode 实例
     *   - 解析失败时记录 Error
     */
    function simulateParser(store: ReturnType<typeof initStore>): void {
      const state = store.getState();

      // Step 1: 先将所有组件节点打平到 hydrateNodeMap
      const rootCol = mockRootColumn();
      const text = mockTextNode();
      const field = mockTextField();
      const btn = mockButton();

      state.addHydrateNode(rootCol);
      state.addHydrateNode(text);
      state.addHydrateNode(field);
      state.addHydrateNode(btn);

      // Step 2: 构建 Surface，rootNode 直接指向 rootCol 实例（指针）
      state.addSurface({
        surfaceId: 'main-page',
        beginRender: true,
        rootNode: rootCol,
        rootComponentId: null,
      });
    }

    it('parser 构建完成后，rootNode 指针可直接访问组件树', () => {
      const store = initStore();
      simulateParser(store);
      const s = store.getState();

      // rootNode 本身就是 HydrateNode 实例，无需二次 Map 查找
      const surface = s.getSurface('main-page');
      const root = surface!.rootNode!;
      expect(root.componentId).to.equal('root-col');
      expect(root.ownerSurfaceId).to.equal('main-page');

      // 根组件的 children 列表可在 _vnode.props 中获取
      const columnVNode = root._vnode as { type: string; props: { children: string[] } };
      expect(columnVNode.props.children).to.deep.equal([
        'name-field',
        'greeting-text',
        'submit-btn',
      ]);

      // 每个 child 都可在 hydrateNodeMap 中 O(1) 找到
      for (const childId of columnVNode.props.children) {
        expect(s.getHydrateNode(childId)).to.exist;
      }
    });

    it('空间换时间 — hydrateNodeMap O(1) 查找验证', () => {
      const store = initStore();
      simulateParser(store);
      const s = store.getState();

      // 1000 次 O(1) 查找应该都在 microsecond 级别完成
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        s.getHydrateNode('greeting-text');
        s.getHydrateNode('name-field');
        s.getHydrateNode('submit-btn');
      }
      const elapsed = performance.now() - start;

      // 3000 次 Map 查找应在 50ms 以内
      expect(elapsed).to.be.lessThan(50);
    });
  });

  // --------------------------------------------------------------------------
  // 8. 单例生命周期
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // 8. Data Model 存储（dataModelUpdate）
  // --------------------------------------------------------------------------

  describe('8. Data Model CRUD', () => {
    it('setDataModelAt — 根路径 "/" 替换整个 data model', () => {
      const store = initStore();
      store.getState().setDataModelAt('s1', '/', { user: { name: 'Bob' } });

      const model = store.getState().getDataModel('s1');
      expect(model).to.deep.equal({ user: { name: 'Bob' } });
    });

    it('setDataModelAt — undefined path 等同于根路径替换', () => {
      const store = initStore();
      store.getState().setDataModelAt('s1', undefined, { x: 1 });

      expect(store.getState().getDataModel('s1')).to.deep.equal({ x: 1 });
    });

    it('setDataModelAt — 嵌套路径深层合并', () => {
      const store = initStore();
      store.getState().setDataModelAt('s1', '/', { user: { name: 'Bob' } });
      store.getState().setDataModelAt('s1', '/user/age', 25);

      const model = store.getState().getDataModel('s1');
      expect(model).to.deep.equal({ user: { name: 'Bob', age: 25 } });
    });

    it('setDataModelAt — 深层路径自动创建中间对象', () => {
      const store = initStore();
      store.getState().setDataModelAt('s1', '/a/b/c', 'deep');

      const model = store.getState().getDataModel('s1');
      expect(model).to.deep.equal({ a: { b: { c: 'deep' } } });
    });

    it('setDataModelAt — 路径不存在时安全创建（空 data model）', () => {
      const store = initStore();
      store.getState().setDataModelAt('s2', '/key', 'val');

      expect(store.getState().getDataModel('s2')).to.deep.equal({ key: 'val' });
    });

    it('getDataModelValue — 按路径取值', () => {
      const store = initStore();
      store.getState().setDataModelAt('s1', '/', {
        user: { name: 'Bob', age: 30 },
        items: { a: { title: 'Item A' } },
      });

      const s = store.getState();
      expect(s.getDataModelValue('s1', '/user/name')).to.equal('Bob');
      expect(s.getDataModelValue('s1', '/user/age')).to.equal(30);
      expect(s.getDataModelValue('s1', '/items/a/title')).to.equal('Item A');
    });

    it('getDataModelValue — 不存在的路径返回 undefined', () => {
      const store = initStore();
      store.getState().setDataModelAt('s1', '/', { x: 1 });

      expect(store.getState().getDataModelValue('s1', '/y/z')).to.be.undefined;
      expect(store.getState().getDataModelValue('s1', '/nonexistent')).to.be.undefined;
    });

    it('getDataModelValue — 不存在的 surface 返回 undefined（不抛错）', () => {
      const store = initStore();
      expect(store.getState().getDataModelValue('ghost', '/any')).to.be.undefined;
    });

    it('clearDataModel — 清除单个 surface 的 data model', () => {
      const store = initStore();
      store.getState().setDataModelAt('s1', '/', { x: 1 });
      store.getState().setDataModelAt('s2', '/', { y: 2 });

      store.getState().clearDataModel('s1');

      expect(store.getState().getDataModel('s1')).to.be.undefined;
      // s2 不受影响
      expect(store.getState().getDataModel('s2')).to.deep.equal({ y: 2 });
    });

    it('dataModelVersion — 每次 setDataModelAt 递增', () => {
      const store = initStore();
      const v0 = store.getState().dataModelVersion;

      store.getState().setDataModelAt('s1', '/', { a: 1 });
      const v1 = store.getState().dataModelVersion;
      expect(v1).to.be.greaterThan(v0);

      store.getState().setDataModelAt('s1', '/b', 2);
      const v2 = store.getState().dataModelVersion;
      expect(v2).to.be.greaterThan(v1);
    });

    it('clearSurface — 级联清除 data model', () => {
      const store = initStore();
      store.getState().setDataModelAt('s1', '/', { x: 1 });
      store.getState().setDataModelAt('s2', '/', { y: 2 });

      store.getState().clearSurface('s1');

      expect(store.getState().getDataModel('s1')).to.be.undefined;
      expect(store.getState().getDataModel('s2')).to.deep.equal({ y: 2 });
    });

    it('clear — 重置所有 data model', () => {
      const store = initStore();
      store.getState().setDataModelAt('s1', '/', { x: 1 });
      store.getState().clear();

      expect(store.getState().getDataModel('s1')).to.be.undefined;
      expect(store.getState().dataModelMap).to.deep.equal({});
      expect(store.getState().dataModelVersion).to.equal(0);
    });
  });

  describe('9. 单例生命周期', () => {
    it('resetStore 清空状态但不销毁实例', () => {
      const store = initStore();
      store.getState().addSurface(mockSurface(null));
      resetStore();

      const s = store.getState();
      expect(s.surfaceMap).to.deep.equal({});
      expect(s.hydrateNodeMap).to.deep.equal({});
      expect(s.errorMap).to.deep.equal({});

      // 实例未销毁，仍可使用
      store.getState().addSurface(mockSurface(null));
      expect(store.getState().getSurface('main-page')).to.exist;
    });

    it('destroyStore 后重新创建', () => {
      const s1 = initStore();
      destroyStore();
      const s2 = initStore();
      expect(s1).to.not.equal(s2);
    });
  });
});
