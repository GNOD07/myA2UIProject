import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { Button, Modal, Card, Select, Space, Switch } from "antd";
import {
  init,
  destroyStore,
  A2UIBuffer,
  feedJsonlChunk,
  flushJsonlBuffer,
  StreamProcessor,
} from "@a2ui/core";
import simpleTextMock from "../../../packages/a2ui-core/mock/simple-text.json?raw";
import columnMock from "../../../packages/a2ui-core/mock/column-mock.json?raw";
import nestedColumnMock from "../../../packages/a2ui-core/mock/nested-column-mock.json?raw";
import nestedColumnJsonlMock from "../../../packages/a2ui-core/mock/nested-column-mock.jsonl?raw";
import { useStore, defaultRenderMap, FadeIn } from "@a2ui/react";
import type { SurfaceTree, VNode } from "@a2ui/core";

/** 去掉换行的原始 JSON 流（模拟 LLM 逐 token 输出，无 \n 分隔） */
const RAW_NESTED_STREAM = nestedColumnMock.replace(/\r?\n/g, '');

/** Mock 数据注册表 */
const MOCK_REGISTRY: Record<string, { label: string; data: string }> = {
  "simple-text": { label: "Simple Text — 单 Text 组件", data: simpleTextMock },
  column: { label: "Column — 1 Column + 3 Text", data: columnMock },
  "nested-column": {
    label: "Nested Column — 4 层嵌套",
    data: nestedColumnMock,
  },
  "nested-column-jsonl": {
    label: "Nested Column JSONL — 单组件/消息流式",
    data: nestedColumnJsonlMock,
  },
  "nested-raw-stream": {
    label: "Nested Raw Stream — 50ms/50char 原始流",
    data: RAW_NESTED_STREAM,
  },
};

/**
 * 将 _vnode 安全渲染为 React 节点
 *
 * _vnode 有两种形态：
 * 1. ReactElement — renderMap 已渲染的结果，直接使用
 * 2. 原始 component 对象 { Type: props } — 用 renderMap 动态渲染或 JSON 展示
 */
/** CSS justify-content 映射（distribution → flex） */
const DISTRIBUTION_CSS: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  spaceBetween: "space-between",
  spaceAround: "space-around",
  spaceEvenly: "space-evenly",
};

/** CSS align-items 映射（alignment → flex） */
const ALIGNMENT_CSS: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

function VNodeRenderer({ vnode }: { vnode: VNode }) {
  const renderMap = useStore((s) => s.renderMap);

  return useMemo(() => {
    if (vnode === null || vnode === undefined) return null;
    if (typeof vnode === "string" || typeof vnode === "number") return vnode as React.ReactNode;

    // === 容器组件（treeBuilder 已解析 children） ===
    if (
      typeof vnode === "object" &&
      "__a2ui_container" in (vnode as Record<string, unknown>)
    ) {
      const container = vnode as Record<string, any>;
      const { type, props } = container;
      const children: unknown[] = container.children ?? [];

      if (type === "Column") {
        return (
          <FadeIn componentId={container.componentId}>
            <div
              id={container.componentId ?? undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent:
                  DISTRIBUTION_CSS[props.distribution] ?? "flex-start",
                alignItems: ALIGNMENT_CSS[props.alignment] ?? "stretch",
                gap: 8,
                padding: 8,
                border: "1px dashed #d9d9d9",
                borderRadius: 8,
              }}
            >
              {children.map((child, i) => (
                <VNodeRenderer key={i} vnode={child} />
              ))}
            </div>
          </FadeIn>
        );
      }

      if (type === "Row") {
        return (
          <FadeIn componentId={container.componentId}>
            <div
              id={container.componentId ?? undefined}
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent:
                  DISTRIBUTION_CSS[props.distribution] ?? "flex-start",
                alignItems: ALIGNMENT_CSS[props.alignment] ?? "stretch",
                gap: 8,
                padding: 8,
                border: "1px dashed #bae7ff",
                borderRadius: 8,
                flexWrap: "wrap",
              }}
            >
              {children.map((child, i) => (
                <VNodeRenderer key={i} vnode={child} />
              ))}
            </div>
          </FadeIn>
        );
      }

      // 未知容器类型：展示 JSON
      return (
        <pre style={{ fontSize: 12, color: "#999" }}>
          {JSON.stringify(vnode, null, 2)}
        </pre>
      );
    }

    // ReactElement 检测：$$typeof 是 React 元素的标志位
    if (typeof vnode === "object" && "$$typeof" in vnode) {
      const compId = (vnode as any)?.props?.id as string | undefined;
      const element = vnode as unknown as React.ReactNode;
      return compId ? <FadeIn componentId={compId}>{element}</FadeIn> : element;
    }

    // 原始 component 格式 { Type: props } → 用 renderMap 动态渲染
    if (typeof vnode === "object" && vnode !== null) {
      const keys = Object.keys(vnode);
      if (keys.length === 1) {
        const compType = keys[0];
        const compProps = (vnode as Record<string, any>)[compType];
        const renderFn = renderMap[compType];
        if (renderFn) {
          return renderFn(compProps) as React.ReactNode;
        }
      }
    }

    // 兜底：JSON 展示
    return (
      <pre style={{ fontSize: 12, color: "#999" }}>
        {JSON.stringify(vnode, null, 2)}
      </pre>
    );
  }, [vnode, renderMap]);
}

export function App() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [trees, setTrees] = useState<SurfaceTree[]>([]);
  const [selectedMock, setSelectedMock] = useState<string>("nested-column");
  const [streamMode, setStreamMode] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState<string | null>(null);

  /** 用于取消正在进行的流式模拟 */
  const abortRef = useRef(false);

  /** 同步批量加载：init 注入 onTreeChange，SDK 自动通知 */
  const loadMockDataBatch = useCallback((mockKey: string) => {
    abortRef.current = true;

    destroyStore();
    // SDK 驱动：onTreeChange 在每条消息处理完后自动调用
    init(defaultRenderMap, (trees) => setTrees(trees));

    const rawData = MOCK_REGISTRY[mockKey].data;
    const buffer = new A2UIBuffer();

    const lines = rawData.split(/\r?\n/).filter((line) => line.trim());
    for (const line of lines) {
      const mid = Math.floor(line.length / 2);
      feedJsonlChunk(line.slice(0, mid), buffer);
      feedJsonlChunk(line.slice(mid) + "\n", buffer);
    }
    flushJsonlBuffer(buffer);

    setSelectedMock(mockKey);
    setStreaming(false);
    setStreamProgress(null);
  }, []);

  /**
   * 流式加载（JSONL 模式）：逐行模拟 LLM 流式推送 JSONL。
   */
  const loadMockDataStream = useCallback(async (mockKey: string) => {
    abortRef.current = false;
    destroyStore();

    const rawData = MOCK_REGISTRY[mockKey].data;
    const buffer = new A2UIBuffer();
    const lines = rawData.split(/\r?\n/).filter((line) => line.trim());

    let processedCount = 0;
    init(defaultRenderMap, (trees) => {
      processedCount++;
      flushSync(() => { setTrees(trees); setStreamProgress(`${processedCount}/${lines.length}`); });
    });

    setSelectedMock(mockKey);
    setStreaming(true);
    setTrees([]);

    for (let i = 0; i < lines.length; i++) {
      if (abortRef.current) {
        flushJsonlBuffer(buffer);
        setStreaming(false);
        setStreamProgress(null);
        return;
      }
      const line = lines[i];
      const mid = Math.floor(line.length / 2);
      feedJsonlChunk(line.slice(0, mid), buffer);
      feedJsonlChunk(line.slice(mid) + "\n", buffer);
      await new Promise((r) => setTimeout(r, 300));
    }
    flushJsonlBuffer(buffer);
    setStreaming(false);
    setStreamProgress(null);
  }, []);

  /**
   * 原始 JSON Stream 加载：模拟 LLM 逐 token 输出原始 JSON（无 \n）。
   * 50ms 推送 50 字符 → StreamBuffer 括号计数提取完整 JSON →
   * splitSurfaceUpdate 拆单组件 → processMessage。
   */
  const loadMockDataRawStream = useCallback(async (mockKey: string) => {
    abortRef.current = false;
    destroyStore();

    const rawData = MOCK_REGISTRY[mockKey].data;
    const estimatedMessages = 22;
    let processedCount = 0;

    init(defaultRenderMap, (trees) => {
      processedCount++;
      flushSync(() => { setTrees(trees); setStreamProgress(`${processedCount}/${estimatedMessages}`); });
    });

    setSelectedMock(mockKey);
    setStreaming(true);
    setTrees([]);

    // StreamProcessor 内部集成 AutoCompleteBuffer + processMessage
    const sp = new StreamProcessor();

    const CHUNK_SIZE = 50;
    const INTERVAL_MS = 50;
    let ptr = 0;
    while (ptr < rawData.length) {
      if (abortRef.current) {
        sp.flush();
        setStreaming(false);
        setStreamProgress(null);
        return;
      }
      const chunk = rawData.slice(ptr, ptr + CHUNK_SIZE);
      ptr += CHUNK_SIZE;
      sp.feed(chunk);
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }

    sp.flush();
    setStreaming(false);
    setStreamProgress(null);
  }, []);

  /** 根据 streamMode 和 mock 类型选择加载方式 */
  const loadMockData = useCallback(
    (mockKey: string) => {
      if (streamMode) {
        if (mockKey === 'nested-raw-stream') {
          loadMockDataRawStream(mockKey);
        } else {
          loadMockDataStream(mockKey);
        }
      } else {
        loadMockDataBatch(mockKey);
      }
    },
    [streamMode, loadMockDataBatch, loadMockDataStream, loadMockDataRawStream],
  );

  // 初始化加载默认 mock
  useEffect(() => {
    loadMockData(selectedMock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store 数据订阅
  const surfaceMap = useStore((state) => state.surfaceMap);
  const hydrateNodeMap = useStore((state) => state.hydrateNodeMap);
  const errorMap = useStore((state) => state.errorMap);
  const renderMapKeys = useStore((state) => Object.keys(state.renderMap));

  const storeSnapshot = {
    surfaceMap,
    hydrateNodeMap,
    errorMap,
    renderMap: renderMapKeys,
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px" }}>
      <h1>A2UI Playground</h1>

      <p style={{ marginTop: "20px", color: "#666" }}>
        Store 已初始化，renderMap 已注入（{renderMapKeys.join(", ")}），
        mock 数据已加载。
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 16, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <Select
          value={selectedMock}
          onChange={loadMockData}
          size="large"
          style={{ minWidth: 280 }}
          disabled={streaming}
          options={Object.entries(MOCK_REGISTRY).map(([key, item]) => ({
            value: key,
            label: item.label,
          }))}
        />
        <Space>
          <span style={{ fontSize: 13, color: "#666", userSelect: "none" }}>Stream</span>
          <Switch
            checked={streamMode}
            onChange={(checked) => {
              setStreamMode(checked);
              if (checked) {
                loadMockData(selectedMock);
              } else {
                abortRef.current = true;
                loadMockDataBatch(selectedMock);
              }
            }}
          />
        </Space>
        {streaming && streamProgress && (
          <span
            style={{
              fontSize: 13,
              color: "#1677ff",
              fontWeight: 600,
              minWidth: 60,
            }}
          >
            流式推送中 {streamProgress}
          </span>
        )}
        <Button type="primary" size="large" onClick={() => setDialogOpen(true)}>
          查看 Store
        </Button>
        <Button
          type="primary"
          danger
          size="large"
          onClick={() => setErrorDialogOpen(true)}
        >
          查看错误 ({Object.keys(errorMap).length})
        </Button>
      </div>

      {/* 渲染预览区域 */}
      <Card
        title={
          <span>
            渲染预览
            {streaming && streamProgress && (
              <span
                style={{
                  marginLeft: 12,
                  fontSize: 13,
                  fontWeight: 400,
                  color: "#1677ff",
                }}
              >
                ⏳ 增量构建中… {streamProgress}
              </span>
            )}
          </span>
        }
        style={{ marginTop: 20 }}
      >
        {trees.length === 0 ? (
          <p style={{ color: "#999" }}>
            {streaming ? "等待第一条 surfaceUpdate…" : "暂无活跃 Surface"}
          </p>
        ) : (
          trees.map((tree) => (
            <div
              key={tree.surfaceId}
              style={{
                border: "1px dashed #d9d9d9",
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
                Surface: {tree.surfaceId}
              </div>
              <VNodeRenderer vnode={tree.rootComponent} />
            </div>
          ))
        )}
      </Card>

      <Modal
        title="A2UI Store"
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDialogOpen(false)}>
            关闭
          </Button>,
        ]}
        width={900}
      >
        {/* 顶部统计摘要 */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {[
            {
              label: "组件总数",
              value: Object.keys(hydrateNodeMap).length,
              color: "#1677ff",
            },
            {
              label: "Surface",
              value: Object.keys(surfaceMap).length,
              color: "#52c41a",
            },
            {
              label: "已注册渲染器",
              value: renderMapKeys.length,
              color: "#722ed1",
            },
            {
              label: "错误",
              value: Object.keys(errorMap).length,
              color: "#ff4d4f",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                flex: "1 1 auto",
                minWidth: 100,
                textAlign: "center",
                padding: "10px 12px",
                borderRadius: 6,
                backgroundColor: `${item.color}10`,
                border: `1px solid ${item.color}30`,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>
                {item.value}
              </div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        <pre
          style={{
            backgroundColor: "#f5f5f5",
            padding: "16px",
            borderRadius: "4px",
            maxHeight: "500px",
            overflow: "auto",
            fontSize: "13px",
          }}
        >
          {JSON.stringify(storeSnapshot, null, 2)}
        </pre>
      </Modal>

      {/* 错误信息弹窗 */}
      <Modal
        title={`错误信息 (${Object.keys(errorMap).length})`}
        open={errorDialogOpen}
        onCancel={() => setErrorDialogOpen(false)}
        footer={[
          <Button key="close" onClick={() => setErrorDialogOpen(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {Object.keys(errorMap).length === 0 ? (
          <p style={{ color: "#52c41a", fontSize: 14 }}>暂无错误 ✓</p>
        ) : (
          Object.values(errorMap).map((error) => (
            <div
              key={error.id}
              style={{
                border: "1px solid #ff4d4f",
                borderRadius: 6,
                padding: 12,
                marginBottom: 12,
                backgroundColor: "#fff2f0",
              }}
            >
              <div style={{ marginBottom: 6, fontSize: 13 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 4,
                    backgroundColor: "#ff4d4f",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    marginRight: 8,
                  }}
                >
                  {error.type}
                </span>
                <strong>ID:</strong> {error.id}
              </div>
              <div style={{ fontSize: 13, color: "#333", marginBottom: 4 }}>
                {error.content}
              </div>
              <div style={{ fontSize: 12, color: "#999" }}>
                surfaceId: {error.surfaceId ?? "-"} | componentId:{" "}
                {error.componentId ?? "-"}
              </div>
            </div>
          ))
        )}
      </Modal>
    </div>
  );
}
