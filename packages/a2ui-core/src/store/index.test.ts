/**
 * @file initStore 单元测试
 */
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { initStore, getStore, destroyStore, resetStore } from './index.js';
import type { A2UIStore } from './types.js';

describe('initStore', () => {
  // 每个测试前清理 store，保证测试独立性
  beforeEach(() => {
    destroyStore();
  });

  it('应该创建并返回 store 实例', () => {
    const store = initStore();
    expect(store).to.exist;
    expect(typeof store.getState).to.equal('function');
    expect(typeof store.setState).to.equal('function');
  });

  it('应该返回单例实例（多次调用返回同一实例）', () => {
    const store1 = initStore();
    const store2 = initStore();
    expect(store1).to.equal(store2);
  });

  it('初始化后应该具有默认的初始状态', () => {
    const store = initStore();
    const state = store.getState();

    expect(state.surfaceMap).to.deep.equal({});
    expect(state.hydrateNodeMap).to.deep.equal({});
    expect(state.errorMap).to.deep.equal({});
  });

  it('初始化成功后应该可以正常使用 store 方法', () => {
    const store = initStore();

    // 测试添加 Surface
    const surface = {
      surfaceId: 'test-surface-1',
      beginRender: false,
      rootNode: null,
    };
    store.getState().addSurface(surface);

    const retrieved = store.getState().getSurface('test-surface-1');
    expect(retrieved).to.exist;
    expect(retrieved?.surfaceId).to.equal('test-surface-1');
  });

  it('应该可以通过 getStore 获取同一个实例', () => {
    const initStoreResult = initStore();
    const getStoreResult = getStore();
    expect(initStoreResult).to.equal(getStoreResult);
  });

  it('destroyStore 后应该可以重新创建新实例', () => {
    const store1 = initStore();
    destroyStore();
    const store2 = initStore();
    expect(store1).to.not.equal(store2);
  });

  it('resetStore 应该清空状态但不销毁实例', () => {
    const store = initStore();

    // 添加一些数据
    store.getState().addSurface({
      surfaceId: 'test-surface',
      beginRender: false,
      rootNode: null,
    });

    // 重置
    resetStore();

    const state = store.getState();
    expect(state.surfaceMap).to.deep.equal({});
    expect(state.hydrateNodeMap).to.deep.equal({});
    expect(state.errorMap).to.deep.equal({});
  });
});
