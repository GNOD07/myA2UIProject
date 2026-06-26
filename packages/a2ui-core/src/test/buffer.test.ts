/**
 * buffer 单元测试
 *
 * 覆盖：
 *  - A2UIBuffer.feed / flush / reset
 *  - feedJsonlChunk / flushJsonlBuffer 流式处理
 *  - 跨 chunk 拼包
 *  - JSON 解析错误处理
 *  - 与 processMessage + store 的集成
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { initStore, getStore, destroyStore } from '../store/index.js';
import { A2UIBuffer, feedJsonlChunk, flushJsonlBuffer } from '../buffer/index.js';
import { buildTree } from '../treeBuilder/index.js';
import type { RenderMap } from '../store/types.js';

function readMock(fileName: string): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(__dirname, '..', '..', 'mock', fileName);
  return fs.readFileSync(filePath, 'utf-8');
}

const NESTED_MOCK = readMock('nested-column-mock.json');
const NESTED_MOCK_JSONL = readMock('nested-column-mock.jsonl');

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
  Row: (props) => ({
    __a2ui_container: true,
    type: 'Row',
    props: { distribution: props.distribution ?? 'start', alignment: props.alignment ?? 'stretch' },
    childIds: props.children?.explicitList ?? [],
  }),
};

describe('A2UIBuffer', () => {
  let buffer: A2UIBuffer;

  beforeEach(() => {
    buffer = new A2UIBuffer();
  });

  describe('feed()', () => {
    it('should extract complete lines separated by newline', () => {
      const lines = buffer.feed('line1\nline2\nline3\n');
      expect(lines).to.deep.equal(['line1', 'line2', 'line3']);
    });

    it('should buffer incomplete trailing data for next feed', () => {
      const lines1 = buffer.feed('{"a":1}\n{"b":');
      expect(lines1).to.deep.equal(['{"a":1}']);
      // {"b": 保留在内部缓冲中

      const lines2 = buffer.feed('2}\n{"c":3}\n');
      expect(lines2).to.deep.equal(['{"b":2}', '{"c":3}']);
    });

    it('should filter empty lines', () => {
      const lines = buffer.feed('\n\nhello\n\n\nworld\n\n');
      expect(lines).to.deep.equal(['hello', 'world']);
    });

    it('should handle CRLF line endings', () => {
      // \r\n 中的 \r 会留在行尾，但 JSON.parse 不受影响
      // buffer 按 \n 切分，每行末尾可能带 \r
      const lines = buffer.feed('line1\r\nline2\r\n');
      expect(lines).to.deep.equal(['line1\r', 'line2\r']);
    });

    it('should handle a single line without trailing newline', () => {
      const lines = buffer.feed('only-one-line');
      expect(lines).to.deep.equal([]); // 不完整，等待 \n
    });

    it('should return empty array for empty chunk', () => {
      expect(buffer.feed('')).to.deep.equal([]);
    });
  });

  describe('flush()', () => {
    it('should return buffered content and clear buffer', () => {
      buffer.feed('no-newline-here');
      const flushed = buffer.flush();
      expect(flushed).to.deep.equal(['no-newline-here']);
    });

    it('should return empty array when buffer is empty', () => {
      expect(buffer.flush()).to.deep.equal([]);
    });

    it('should not return empty string for blank buffer content', () => {
      buffer.feed('\n\n\n');
      expect(buffer.flush()).to.deep.equal([]);
    });
  });

  describe('reset()', () => {
    it('should clear buffered content', () => {
      buffer.feed('partial');
      buffer.reset();
      expect(buffer.flush()).to.deep.equal([]);
    });
  });
});

describe('feedJsonlChunk / flushJsonlBuffer integration', () => {
  beforeEach(() => {
    destroyStore();
  });

  it('should process complete JSONL messages through buffer to store', () => {
    initStore(testRenderMap);

    const buffer = new A2UIBuffer();
    const jsonl = '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"t1","component":{"Text":{"text":{"literalString":"hello"},"usageHint":"h1"}}}]}}\n{"beginRendering":{"surfaceId":"s1","root":"t1"}}\n';

    feedJsonlChunk(jsonl, buffer);
    flushJsonlBuffer(buffer);

    const state = getStore().getState();
    expect(state.hydrateNodeMap).to.have.property('t1');
    expect(state.surfaceMap).to.have.property('s1');
    expect(state.surfaceMap['s1'].beginRender).to.be.true;

    const trees = buildTree();
    expect(trees).to.have.lengthOf(1);
    expect(trees[0].surfaceId).to.equal('s1');
  });

  it('should handle split chunks that form one complete line', () => {
    initStore(testRenderMap);

    const buffer = new A2UIBuffer();
    const part1 = '{"surfaceUpdate":{"surfaceId":"s1","comp';
    const part2 = 'onents":[{"id":"t1","component":{"Text":{"text":{"literalString":"hi"},"usageHint":"h1"}}}]}}\n';

    feedJsonlChunk(part1, buffer); // 不完整，暂存
    feedJsonlChunk(part2, buffer); // 拼出完整行 → 处理
    flushJsonlBuffer(buffer);

    const state = getStore().getState();
    expect(state.hydrateNodeMap).to.have.property('t1');
  });

  it('should record parse error on invalid JSON line', () => {
    initStore(testRenderMap);

    const buffer = new A2UIBuffer();
    feedJsonlChunk('not valid json\n', buffer);

    const state = getStore().getState();
    const errors = Object.values(state.errorMap);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].type).to.equal('PARSE_ERROR');
    expect(errors[0].content).to.include('Failed to parse JSONL line');
  });

  it('should process multiple chunks across multiple feeds', () => {
    initStore(testRenderMap);

    const buffer = new A2UIBuffer();

    // 第 1 条消息：surfaceUpdate
    feedJsonlChunk(
      '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"t1","component":{"Text":{"text":{"literalString":"A"}}}}]}}\n',
      buffer,
    );

    // 第 2 条消息：beginRendering（拆成两半）
    feedJsonlChunk('{"beginRendering":{"surfaceI', buffer);
    feedJsonlChunk('d":"s1","root":"t1"}}\n', buffer);

    flushJsonlBuffer(buffer);

    const state = getStore().getState();
    expect(state.surfaceMap['s1'].beginRender).to.be.true;
    expect(state.surfaceMap['s1'].rootNode).to.not.be.null;
  });

  it('should handle RENDERER_NOT_FOUND errors during streaming', () => {
    initStore(testRenderMap); // testRenderMap has Text, Column, Row — but no "Button"

    const buffer = new A2UIBuffer();
    feedJsonlChunk(
      '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"btn1","component":{"Button":{"label":"Click"}}}]}}\n',
      buffer,
    );

    const state = getStore().getState();
    const errors = Object.values(state.errorMap);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].type).to.equal('RENDERER_NOT_FOUND');
    expect(errors[0].componentId).to.equal('btn1');
  });

  it('should stream full nested mock data and build valid tree', () => {
    initStore(testRenderMap);

    const buffer = new A2UIBuffer();
    const lines = NESTED_MOCK.split(/\r?\n/).filter((line) => line.trim());

    // 模拟网络分包：每行拆成前半 + 后半
    for (const line of lines) {
      const mid = Math.floor(line.length / 2);
      feedJsonlChunk(line.slice(0, mid), buffer);
      feedJsonlChunk(line.slice(mid) + '\n', buffer);
    }
    flushJsonlBuffer(buffer);

    const state = getStore().getState();

    // 验证 store 状态
    expect(Object.keys(state.surfaceMap)).to.have.lengthOf(1);
    expect(state.surfaceMap['main_surface'].beginRender).to.be.true;

    // 验证组件数量（nested-column-mock 有 20 个组件）
    expect(Object.keys(state.hydrateNodeMap)).to.have.lengthOf(20);

    // 验证 buildTree 产出
    const trees = buildTree();
    expect(trees).to.have.lengthOf(1);
    expect(trees[0].surfaceId).to.equal('main_surface');

    const root = trees[0].rootComponent as any;
    expect(root).to.have.property('__a2ui_container', true);
    expect(root.type).to.equal('Column');
    expect(root.children).to.be.an('array').with.lengthOf(4); // title, header_row, card_row, footer
  });

  it('should stream one-component-per-message JSONL and build valid tree', () => {
    initStore(testRenderMap);

    const buffer = new A2UIBuffer();
    const lines = NESTED_MOCK_JSONL.split(/\r?\n/).filter((line) => line.trim());

    // 模拟网络分包：每行拆成前半 + 后半 → 更真实地测试断行拼包
    for (const line of lines) {
      const mid = Math.floor(line.length / 2);
      feedJsonlChunk(line.slice(0, mid), buffer);
      feedJsonlChunk(line.slice(mid) + '\n', buffer);
    }
    flushJsonlBuffer(buffer);

    const state = getStore().getState();

    // 验证 store 状态 —— 与旧格式结果完全一致
    expect(Object.keys(state.surfaceMap)).to.have.lengthOf(1);
    expect(state.surfaceMap['main_surface'].beginRender).to.be.true;

    // 20 个组件，每条 surfaceUpdate 只携带 1 个
    expect(Object.keys(state.hydrateNodeMap)).to.have.lengthOf(20);

    // 验证 buildTree 产出
    const trees = buildTree();
    expect(trees).to.have.lengthOf(1);
    expect(trees[0].surfaceId).to.equal('main_surface');

    const root = trees[0].rootComponent as any;
    expect(root).to.have.property('__a2ui_container', true);
    expect(root.type).to.equal('Column');
    expect(root.children).to.be.an('array').with.lengthOf(4); // title, header_row, card_row, footer

    // 额外验证：每个 hydrateNode 的 protocol 只包含 1 个 component
    for (const [, node] of Object.entries(state.hydrateNodeMap)) {
      const parsed = JSON.parse((node as any).protocol);
      expect(parsed).to.not.have.property('surfaceUpdate');
      // 单组件格式：protocol 存的是 component 自身
      expect(parsed).to.have.property('id');
      expect(parsed).to.have.property('component');
    }
  });

  it('should handle deleteSurface message via streaming', () => {
    initStore(testRenderMap);

    const buffer = new A2UIBuffer();
    feedJsonlChunk(
      '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"t1","component":{"Text":{"text":{"literalString":"hi"}}}}]}}\n',
      buffer,
    );
    feedJsonlChunk('{"beginRendering":{"surfaceId":"s1","root":"t1"}}\n', buffer);
    feedJsonlChunk('{"deleteSurface":{"surfaceId":"s1"}}\n', buffer);
    flushJsonlBuffer(buffer);

    const state = getStore().getState();
    expect(state.surfaceMap).to.not.have.property('s1');
    expect(state.hydrateNodeMap).to.not.have.property('t1');
  });

  it('should fire onMessage callback after each message is processed', () => {
    initStore(testRenderMap);

    const buffer = new A2UIBuffer();
    const received: string[] = [];

    const opts = {
      onMessage: (msg: any) => {
        if ('surfaceUpdate' in msg) {
          received.push(`surfaceUpdate:${msg.surfaceUpdate.surfaceId}`);
        } else if ('dataModelUpdate' in msg) {
          received.push(`dataModelUpdate:${msg.dataModelUpdate.surfaceId}`);
        } else if ('beginRendering' in msg) {
          received.push(`beginRendering:${msg.beginRendering.surfaceId}`);
        } else if ('deleteSurface' in msg) {
          received.push(`deleteSurface:${msg.deleteSurface.surfaceId}`);
        }
      },
    };

    // 分 3 次 feed，每条消息到达后 onMessage 立即回调
    feedJsonlChunk(
      '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"t1","component":{"Text":{"text":{"literalString":"A"}}}}]}}\n',
      buffer,
      opts,
    );
    feedJsonlChunk(
      '{"dataModelUpdate":{"surfaceId":"s1","contents":{}}}\n',
      buffer,
      opts,
    );
    feedJsonlChunk(
      '{"beginRendering":{"surfaceId":"s1","root":"t1"}}\n',
      buffer,
      opts,
    );
    flushJsonlBuffer(buffer, opts);

    expect(received).to.deep.equal([
      'surfaceUpdate:s1',
      'dataModelUpdate:s1',
      'beginRendering:s1',
    ]);
  });

  it('should NOT fire onMessage on parse error (invalid JSON)', () => {
    initStore(testRenderMap);

    const buffer = new A2UIBuffer();
    let callCount = 0;
    const opts = { onMessage: () => { callCount++; } };

    feedJsonlChunk('not valid json\n', buffer, opts);

    expect(callCount).to.equal(0);
    // 但错误应该被记录
    const errors = Object.values(getStore().getState().errorMap);
    expect(errors).to.have.lengthOf(1);
  });
});
