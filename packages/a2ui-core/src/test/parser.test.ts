/**
 * parser 单元测试（放在 src/test，下游运行更集中）
 *
 * 说明：此测试断言解析函数 `parseMessages` 的期望输出结构。
 * 实现代码（parser）尚未添加；测试首先作为规范与回归约定存在。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { parseMessages, parseJsonl } from '../parser/index.js';

describe('parser - simple-text mock (src/test)', () => {
  let messages: any[];

  before(() => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const file = path.resolve(__dirname, '..', '..', 'mock', 'simple-text.jsonl');
    const raw = fs.readFileSync(file, 'utf-8');
    messages = parseJsonl(raw);
  });

  it('should load mock and contain messages', () => {
    expect(messages).to.be.an('array');
    expect(messages.length).to.be.greaterThan(0);
  });

  it('parseMessages should produce surfaces, hydrateNodeMap, and message type buckets', () => {
    const result = parseMessages(messages as any[]);

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
