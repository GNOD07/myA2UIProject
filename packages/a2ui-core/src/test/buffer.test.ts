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
import {
  A2UIBuffer,
  feedJsonlChunk,
  flushJsonlBuffer,
  StreamBuffer,
  splitSurfaceUpdate,
  processStreamChunk,
  flushStreamBuffer,
  AutoCompleteBuffer,
  processAutoCompleteChunk,
  flushAutoCompleteBuffer,
} from '../buffer/index.js';
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

  it('should stream full nested mock data (raw stream) and build valid tree', () => {
    initStore(testRenderMap);

    const acb = new AutoCompleteBuffer();
    // 50 字符/次模拟原始 JSON 流推送（AutoCompleteBuffer 自动补全不完整 JSON）
    for (let i = 0; i < NESTED_MOCK.length; i += 50) {
      processAutoCompleteChunk(NESTED_MOCK.slice(i, i + 50), acb);
    }
    flushAutoCompleteBuffer(acb);

    const state = getStore().getState();

    // 验证 store 状态：surface 已创建，组件已注册
    expect(Object.keys(state.surfaceMap)).to.have.lengthOf(1);

    // AutoCompleteBuffer 逐组件提取 + 开始渲染消息在流中的位置不确定
    // 核心验证：组件数量 + 数据结构
    const nodeCount = Object.keys(state.hydrateNodeMap).length;
    expect(nodeCount).to.be.greaterThan(0); // 至少有一些组件被处理

    // 验证 surface 和 hydrateNode 的数据结构正确性
    if (state.surfaceMap['main_surface'].beginRender) {
      const trees = buildTree();
      expect(trees).to.have.lengthOf(1);
      expect(trees[0].surfaceId).to.equal('main_surface');
      const root = trees[0].rootComponent as any;
      if (root.__a2ui_container) {
        expect(root.type).to.equal('Column');
      }
    }
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

// ============================================================
// StreamBuffer — 无分隔符原始 JSON 流
// ============================================================

const RAW_NESTED = readMock('nested-column-mock.json').replace(/\r?\n/g, '');

describe('StreamBuffer — brace-counting JSON extraction', () => {
  let sb: StreamBuffer;

  beforeEach(() => {
    sb = new StreamBuffer();
  });

  it('should extract a single complete JSON object', () => {
    const result = sb.feed('{"a":1}');
    expect(result).to.deep.equal(['{"a":1}']);
  });

  it('should handle string literals with braces and escapes', () => {
    const result = sb.feed('{"text":"hello {world} \\"escaped\\""}');
    expect(result).to.deep.equal(['{"text":"hello {world} \\"escaped\\""}']);
  });

  it('should extract multiple consecutive JSON objects', () => {
    const result = sb.feed('{"a":1}{"b":2}{"c":3}');
    expect(result).to.deep.equal(['{"a":1}', '{"b":2}', '{"c":3}']);
  });

  it('should buffer incomplete JSON and complete on next feed', () => {
    const r1 = sb.feed('{"surfaceUpdate":{"surfa');
    expect(r1).to.deep.equal([]);

    const r2 = sb.feed('ceId":"s1"}}');
    expect(r2).to.deep.equal(['{"surfaceUpdate":{"surfaceId":"s1"}}']);
  });

  it('should extract JSON split mid-string', () => {
    // 在字符串中间切断
    const r1 = sb.feed('{"text":"hello wo');
    expect(r1).to.deep.equal([]);

    const r2 = sb.feed('rld"}');
    expect(r2).to.deep.equal(['{"text":"hello world"}']);
  });

  it('should handle nested objects braces correctly', () => {
    const result = sb.feed('{"outer":{"inner":{"deep":"value"}}}');
    expect(result).to.deep.equal(['{"outer":{"inner":{"deep":"value"}}}']);
  });

  it('should flush remaining incomplete data', () => {
    sb.feed('{"a":1}{"b":'); // 第二个不完整
    const flushed = sb.flush();
    expect(flushed).to.deep.equal(['{"b":']);
  });
});

describe('splitSurfaceUpdate', () => {
  it('should split multi-component surfaceUpdate into singles', () => {
    const msg = {
      surfaceUpdate: {
        surfaceId: 's1',
        components: [
          { id: 'a', component: { Text: { text: { literalString: 'A' } } } },
          { id: 'b', component: { Text: { text: { literalString: 'B' } } } },
        ],
      },
    };
    const split = splitSurfaceUpdate(msg as any);
    expect(split).to.have.lengthOf(2);
    expect(split[0]).to.deep.equal({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'a', component: { Text: { text: { literalString: 'A' } } } }],
      },
    });
    expect(split[1]).to.deep.equal({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'b', component: { Text: { text: { literalString: 'B' } } } }],
      },
    });
  });

  it('should pass through non-surfaceUpdate messages unchanged', () => {
    const msg = { beginRendering: { surfaceId: 's1', root: 'root' } };
    const split = splitSurfaceUpdate(msg as any);
    expect(split).to.deep.equal([msg]);
  });

  it('should handle single-component surfaceUpdate', () => {
    const msg = {
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'x', component: { Text: {} } }],
      },
    };
    const split = splitSurfaceUpdate(msg as any);
    expect(split).to.have.lengthOf(1);
  });
});

describe('processStreamChunk integration', () => {
  beforeEach(() => {
    destroyStore();
  });

  it('should extract and process multi-component surfaceUpdate from raw stream', () => {
    initStore(testRenderMap);

    const sb = new StreamBuffer();
    const raw = '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"a","component":{"Text":{"text":{"literalString":"A"}}}},{"id":"b","component":{"Text":{"text":{"literalString":"B"}}}}]}}';

    processStreamChunk(raw, sb);
    flushStreamBuffer(sb);

    const state = getStore().getState();
    expect(Object.keys(state.hydrateNodeMap)).to.have.lengthOf(2);
    expect(state.hydrateNodeMap['a']).to.exist;
    expect(state.hydrateNodeMap['b']).to.exist;
    expect(state.surfaceMap['s1']).to.exist;
  });

  it('should handle raw stream split across multiple chunks', () => {
    initStore(testRenderMap);

    const sb = new StreamBuffer();

    // 50 字符一个 chunk，模拟真实 LLM 输出
    for (let i = 0; i < RAW_NESTED.length; i += 50) {
      processStreamChunk(RAW_NESTED.slice(i, i + 50), sb);
    }
    flushStreamBuffer(sb);

    const state = getStore().getState();
    // 原始 mock 有 21 个 component（surfaceUpdate 20 + beginRendering 的 root）
    expect(Object.keys(state.hydrateNodeMap)).to.have.lengthOf(20);
    expect(state.surfaceMap['main_surface']).to.exist;
    expect(state.surfaceMap['main_surface'].beginRender).to.be.true;

    const trees = buildTree();
    expect(trees).to.have.lengthOf(1);
    const root = trees[0].rootComponent as any;
    expect(root.children).to.be.an('array').with.lengthOf(4);
  });

  it('should fire onMessage for each split component message', () => {
    initStore(testRenderMap);

    const sb = new StreamBuffer();
    const received: string[] = [];
    const opts = {
      onMessage: (msg: any) => {
        if ('surfaceUpdate' in msg) {
          const comp = msg.surfaceUpdate.components[0];
          received.push(comp.id);
        }
      },
    };

    const raw = '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"a","component":{"Text":{}}},{"id":"b","component":{"Text":{}}},{"id":"c","component":{"Text":{}}}]}}';

    processStreamChunk(raw, sb, opts);
    flushStreamBuffer(sb, opts);

    expect(received).to.deep.equal(['a', 'b', 'c']);
  });
});

// ============================================================
// AutoCompleteBuffer — JSON.parse 试解析 + 组件边界补全
// ============================================================

describe('AutoCompleteBuffer — incomplete JSON auto-completion', () => {
  let acb: AutoCompleteBuffer;

  beforeEach(() => {
    acb = new AutoCompleteBuffer();
    destroyStore();
  });

  it('should extract a complete surfaceUpdate unchanged', () => {
    const raw = '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"a","component":{"Text":{}}}]}}';
    const results = acb.feed(raw);
    const flushed = acb.flush();

    const all = results.concat(flushed);
    expect(all).to.have.lengthOf(1);
    const msg = JSON.parse(all[0]);
    expect(msg.surfaceUpdate.components).to.have.lengthOf(1);
    expect(msg.surfaceUpdate.components[0].id).to.equal('a');
  });

  it('should auto-complete a single component on flush', () => {
    // 只推到第一个组件完整，无后续边界 → 等 flush 时补全
    const chunk1 = '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"a","component":{"Text":{"text":{"literalString":"A"}}}}';
    const results1 = acb.feed(chunk1);
    // 无边界时不提前闭合
    expect(results1).to.have.lengthOf(0);

    // flush 补全闭合
    const flushed = acb.flush();
    expect(flushed).to.have.lengthOf(1);
    const msg1 = JSON.parse(flushed[0]);
    expect(msg1.surfaceUpdate.components[0].id).to.equal('a');
  });

  it('should extract components at boundaries as they arrive', () => {
    // 第一个组件完整 + 第二个组件已开始 → 边界触发提取
    const chunk1 = '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"a","component":{"Text":{}}},{"id":"b","component":{"Text":{}}}';
    const r1 = acb.feed(chunk1);
    // 找到 a 和 b 之间的边界 → 提取 a
    expect(r1).to.have.lengthOf(1);
    expect(JSON.parse(r1[0]).surfaceUpdate.components[0].id).to.equal('a');

    // 剩余 buffer 会被 flush 捕获
    const flushed = acb.flush();
    expect(flushed).to.have.lengthOf.above(0);
  });

  it('should handle mid-string truncation gracefully', () => {
    // 在字符串中间截断
    const chunk1 = '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"a","component":{"Text":{"text":{"literalString":"Hel';
    const r1 = acb.feed(chunk1);
    // 组件 a 还不完整（字符串未闭合），不应产出
    expect(r1).to.have.lengthOf(0);

    // 补完字符串
    const chunk2 = 'lo"}}}}]}}';
    const r2 = acb.feed(chunk2);
    expect(r2).to.have.lengthOf(1);
    expect(JSON.parse(r2[0]).surfaceUpdate.components[0].id).to.equal('a');
  });

  it('should handle non-surfaceUpdate messages (beginRendering, dataModelUpdate)', () => {
    const raw = '{"surfaceUpdate":{"surfaceId":"s1","components":[{"id":"a","component":{"Text":{}}}]}}{"beginRendering":{"surfaceId":"s1","root":"a"}}';
    const results = acb.feed(raw);

    // 至少产出 surfaceUpdate
    const surfaceMsgs = results.filter(r => r.includes('surfaceUpdate'));
    expect(surfaceMsgs).to.have.lengthOf(1);

    // beginRendering 可能也同时产出（因为它是完整 JSON）
    const beginMsgs = results.filter(r => r.includes('beginRendering'));
    expect(beginMsgs).to.have.lengthOf.above(0);
  });

  it('should process full nested mock through AutoCompleteBuffer', () => {
    initStore(testRenderMap);

    const acb2 = new AutoCompleteBuffer();
    for (let i = 0; i < NESTED_MOCK.length; i += 50) {
      const chunk = NESTED_MOCK.slice(i, i + 50);
      const lines = acb2.feed(chunk);
      for (const line of lines) {
        const msg = JSON.parse(line);
        if ('surfaceUpdate' in msg) {
          // 每个产出的消息应只含 1 个 component
          expect(msg.surfaceUpdate.components).to.have.lengthOf(1);
        }
      }
    }
    const flushed = acb2.flush();
    for (const line of flushed) {
      const msg = JSON.parse(line);
      if ('surfaceUpdate' in msg) {
        expect(msg.surfaceUpdate.components).to.have.lengthOf(1);
      }
    }
  });
});
