/**
 * parser 单元测试（放在 src/test，下游运行更集中）
 *
 * 覆盖：
 *  - parseMessages: 纯协议解析
 *  - loadJsonlIntoStore: 解析 + 写入 store（含 renderMap 渲染验证）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, before, beforeEach } from 'mocha';
import { expect } from 'chai';
import { parseMessages, parseJsonl, loadJsonlIntoStore } from '../parser/index.js';
import { initStore, getStore, destroyStore } from '../store/index.js';
import type { RenderMap } from '../store/types.js';

/**
 * 从 mock 文件读取 JSONLine 协议内容
 */
function readMock(fileName: string): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(__dirname, '..', '..', 'mock', fileName);
  return fs.readFileSync(filePath, 'utf-8');
}

const RAW_MOCK = readMock('simple-text.json');

describe('parser - simple-text mock', () => {
  let messages: any[];

  before(() => {
    messages = parseJsonl(RAW_MOCK);
  });

  it('should parse mock and contain messages', () => {
    expect(messages).to.be.an('array');
    expect(messages.length).to.be.greaterThan(0);
  });

  it('parseMessages should produce surfaces, hydrateNodeMap, and message type buckets', () => {
    const result = parseMessages(messages);

    expect(result).to.be.an('object');
    expect(result).to.have.property('surfaces');
    expect(result).to.have.property('hydrateNodeMap');
    expect(result).to.have.property('messagesByType');

    expect(result.messagesByType).to.be.an('object');
    expect(result.messagesByType.surfaceUpdate).to.be.an('array').with.lengthOf(1);
    expect(result.messagesByType.dataModelUpdate).to.be.an('array').with.lengthOf(1);
    expect(result.messagesByType.beginRendering).to.be.an('array').with.lengthOf(1);
    expect(result.messagesByType.deleteSurface).to.be.an('array').with.lengthOf(0);

    expect(result.surfaces).to.have.property('main_surface');
    const surface = result.surfaces['main_surface'];
    expect(surface).to.have.property('components');
    expect(surface.components).to.have.property('root');

    const root = surface.components['root'];
    expect(root).to.have.property('component');
    expect(root.component).to.have.property('Text');
    expect(root.component.Text.text.literalString).to.equal('Hello, A2UI!');

    expect(result.hydrateNodeMap).to.have.property('root');
    const node = result.hydrateNodeMap['root'];
    expect(node.componentId).to.equal('root');
    expect(node.ownerSurfaceId).to.equal('main_surface');
    expect(node.protocol).to.be.a('string');
  });
});

// ============================================================================
// loadJsonlIntoStore + renderMap 渲染验证
// ============================================================================

describe('parser - loadJsonlIntoStore with renderMap', () => {
  beforeEach(() => {
    destroyStore();
  });

  // ------------------------------------------------------------------
  // 1. 不带 renderMap（回退行为）
  // ------------------------------------------------------------------

  describe('1. 无 renderMap：_vnode 保留原始 component 数据 + 记录错误', () => {
    it('_vnode 应为原始 { Text: { text: ... } } 结构', () => {
      initStore();  // 不传 renderMap，使用默认 {}
      loadJsonlIntoStore(RAW_MOCK);

      const store = getStore();
      const node = store.getState().getHydrateNode('root');
      expect(node).to.exist;
      expect(node!._vnode).to.deep.equal({
        Text: { text: { literalString: 'Hello, A2UI!' }, usageHint: 'h4' },
      });
    });

    it('未注册的组件类型应在 errorMap 中记录 RENDERER_NOT_FOUND 错误', () => {
      initStore();
      loadJsonlIntoStore(RAW_MOCK);

      const store = getStore();
      const state = store.getState();

      // errorMap 应包含 Text 组件未注册的错误
      const errors = Object.values(state.errorMap);
      expect(errors).to.have.lengthOf(1);

      const [error] = errors;
      expect(error.type).to.equal('RENDERER_NOT_FOUND');
      expect(error.surfaceId).to.equal('main_surface');
      expect(error.componentId).to.equal('root');
      expect(error.content).to.include('Text');
      expect(error.content).to.include('main_surface');
      expect(error.content).to.include('root');
    });
  });

  // ------------------------------------------------------------------
  // 2. 带 renderMap：调用渲染函数生成 _vnode
  // ------------------------------------------------------------------

  describe('2. 带 renderMap：renderMap 有对应类型时调用渲染函数', () => {
    it('_vnode 应为渲染函数返回的 VNode', () => {
      const renderMap: RenderMap = {
        Text: (props) => ({ __rendered: true, type: 'Text', props }),
      };

      initStore(renderMap);
      loadJsonlIntoStore(RAW_MOCK);

      const store = getStore();
      const node = store.getState().getHydrateNode('root');
      expect(node).to.exist;

      const vnode = node!._vnode as any;
      expect(vnode.__rendered).to.be.true;
      expect(vnode.type).to.equal('Text');
      expect(vnode.props.text.literalString).to.equal('Hello, A2UI!');
    });

    it('渲染函数接收正确的 props', () => {
      let capturedProps: any = null;

      const renderMap: RenderMap = {
        Text: (props) => {
          capturedProps = props;
          return 'RENDERED';
        },
      };

      initStore(renderMap);
      loadJsonlIntoStore(RAW_MOCK);

      expect(capturedProps).to.deep.equal({
        text: { literalString: 'Hello, A2UI!' },
        usageHint: 'h4',
      });
    });
  });

  // ------------------------------------------------------------------
  // 3. renderMap 命中 / 未命中 混合场景
  // ------------------------------------------------------------------

  describe('3. renderMap 部分命中：未命中类型回退为原始数据 + 记录错误', () => {
    it('命中的 Text 渲染为 VNode，未命中的 UnknownType 保留原始 component', () => {
      // JSONLine 协议：每行必须是一个完整合法的 JSON 对象
      const rawMultiple = [
        '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"t1","component":{"Text":{"text":{"literalString":"Hi"}}}},{"id":"t2","component":{"UnknownType":{"foo":"bar"}}}]}}',
        '{"dataModelUpdate":{"surfaceId":"s1","contents":{}}}',
        '{"beginRendering":{"surfaceId":"s1","root":"t1"}}',
      ].join('\n');

      const renderMap: RenderMap = {
        Text: (props) => ({ __rendered: true, type: 'Text', props }),
        // 未注册 UnknownType
      };

      initStore(renderMap);
      loadJsonlIntoStore(rawMultiple);

      const store = getStore();

      // t1: Text → 命中 renderMap
      const t1 = store.getState().getHydrateNode('t1');
      expect((t1!._vnode as any).__rendered).to.be.true;

      // t2: UnknownType → 回退为原始 component 数据
      const t2 = store.getState().getHydrateNode('t2');
      expect(t2!._vnode).to.deep.equal({ UnknownType: { foo: 'bar' } });
    });

    it('未命中的组件类型应记录 RENDERER_NOT_FOUND 错误', () => {
      const rawMultiple = [
        '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"t1","component":{"Text":{"text":{"literalString":"Hi"}}}},{"id":"t2","component":{"UnknownType":{"foo":"bar"}}}]}}',
        '{"dataModelUpdate":{"surfaceId":"s1","contents":{}}}',
        '{"beginRendering":{"surfaceId":"s1","root":"t1"}}',
      ].join('\n');

      const renderMap: RenderMap = {
        Text: (props) => ({ __rendered: true, type: 'Text', props }),
      };

      initStore(renderMap);
      loadJsonlIntoStore(rawMultiple);

      const store = getStore();
      const state = store.getState();

      const errors = Object.values(state.errorMap);
      // 只有 UnknownType 未注册，Text 已注册不产生错误
      expect(errors).to.have.lengthOf(1);

      const [error] = errors;
      expect(error.type).to.equal('RENDERER_NOT_FOUND');
      expect(error.surfaceId).to.equal('s1');
      expect(error.componentId).to.equal('t2');
      expect(error.content).to.include('UnknownType');
    });
  });

  // ------------------------------------------------------------------
  // 4. 完整集成：renderMap → store 数据结构
  // ------------------------------------------------------------------

  describe('4. 完整集成：Surface + HydrateNode + renderMap', () => {
    it('surfaceMap 含 rootNode 指针 + hydrateNodeMap 含渲染后 _vnode', () => {
      const renderMap: RenderMap = {
        Text: (props) => ({ __rendered: true, type: 'Text', props }),
      };

      initStore(renderMap);
      loadJsonlIntoStore(RAW_MOCK);

      const store = getStore();
      const state = store.getState();

      // Surface
      const surface = state.getSurface('main_surface');
      expect(surface).to.exist;
      expect(surface!.beginRender).to.be.true;
      // rootNode 指针指向 hydrateNodeMap 中的实例
      expect(surface!.rootNode).to.exist;
      expect(surface!.rootNode!.componentId).to.equal('root');

      // HydrateNode._vnode 已被渲染
      const rootNode = state.getHydrateNode('root');
      expect((rootNode!._vnode as any).__rendered).to.be.true;
    });
  });

  // ------------------------------------------------------------------
  // 5. errorMap 验证：组件类型未注册的错误记录
  // ------------------------------------------------------------------

  describe('5. errorMap 验证', () => {
    it('所有组件类型均已注册时不应产生错误', () => {
      const renderMap: RenderMap = {
        Text: (props) => ({ __rendered: true, type: 'Text', props }),
      };

      initStore(renderMap);
      loadJsonlIntoStore(RAW_MOCK);

      const store = getStore();
      const state = store.getState();

      // RAW_MOCK 只包含 Text 组件，已注册
      expect(Object.keys(state.errorMap)).to.have.lengthOf(0);
    });

    it('多个未注册组件类型应分别产生独立错误', () => {
      const rawMultiple = [
        '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"c1","component":{"TypeA":{"x":1}}},{"id":"c2","component":{"TypeB":{"y":2}}}]}}',
        '{"dataModelUpdate":{"surfaceId":"s1","contents":{}}}',
        '{"beginRendering":{"surfaceId":"s1","root":"c1"}}',
      ].join('\n');

      initStore();  // 空 renderMap
      loadJsonlIntoStore(rawMultiple);

      const store = getStore();
      const state = store.getState();

      const errors = Object.values(state.errorMap);
      expect(errors).to.have.lengthOf(2);

      // 错误 ID 应唯一
      const errorIds = errors.map((e) => e.id);
      expect(new Set(errorIds).size).to.equal(2);

      // TypeA 错误
      const typeAError = errors.find((e) => e.componentId === 'c1');
      expect(typeAError).to.exist;
      expect(typeAError!.type).to.equal('RENDERER_NOT_FOUND');
      expect(typeAError!.surfaceId).to.equal('s1');
      expect(typeAError!.content).to.include('TypeA');

      // TypeB 错误
      const typeBError = errors.find((e) => e.componentId === 'c2');
      expect(typeBError).to.exist;
      expect(typeBError!.type).to.equal('RENDERER_NOT_FOUND');
      expect(typeBError!.surfaceId).to.equal('s1');
      expect(typeBError!.content).to.include('TypeB');
    });

    it('不同 surface 的未注册错误应关联正确的 surfaceId', () => {
      const rawMultiple = [
        '{"surfaceUpdate":{"surfaceId":"surface_a","components":[{"id":"a1","component":{"Comp1":{"x":1}}}]}}',
        '{"surfaceUpdate":{"surfaceId":"surface_b","components":[{"id":"b1","component":{"Comp2":{"y":2}}}]}}',
        '{"dataModelUpdate":{"surfaceId":"surface_a","contents":{}}}',
        '{"dataModelUpdate":{"surfaceId":"surface_b","contents":{}}}',
        '{"beginRendering":{"surfaceId":"surface_a","root":"a1"}}',
        '{"beginRendering":{"surfaceId":"surface_b","root":"b1"}}',
      ].join('\n');

      initStore();
      loadJsonlIntoStore(rawMultiple);

      const store = getStore();
      const state = store.getState();

      const errors = Object.values(state.errorMap);
      expect(errors).to.have.lengthOf(2);

      const errorA = errors.find((e) => e.surfaceId === 'surface_a');
      expect(errorA).to.exist;
      expect(errorA!.componentId).to.equal('a1');
      expect(errorA!.content).to.include('Comp1');

      const errorB = errors.find((e) => e.surfaceId === 'surface_b');
      expect(errorB).to.exist;
      expect(errorB!.componentId).to.equal('b1');
      expect(errorB!.content).to.include('Comp2');
    });
  });
});
