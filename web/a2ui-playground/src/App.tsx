import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Modal, Card, Select, Space, Switch } from "antd";
import {
  init,
  destroyStore,
  StreamProcessor,
} from "@a2ui/core";
import simpleTextMock from "../../../packages/a2ui-core/mock/simple-text.json?raw";
import columnMock from "../../../packages/a2ui-core/mock/column-mock.json?raw";
import nestedColumnMock from "../../../packages/a2ui-core/mock/nested-column-mock.json?raw";
import nestedColumnJsonlMock from "../../../packages/a2ui-core/mock/nested-column-mock.jsonl?raw";
import buttonMock from "../../../packages/a2ui-core/mock/button-mock.json?raw";
import imageMock from "../../../packages/a2ui-core/mock/image-mock.json?raw";
import iconMock from "../../../packages/a2ui-core/mock/icon-mock.json?raw";
import videoMock from "../../../packages/a2ui-core/mock/video-mock.json?raw";
import cardMock from "../../../packages/a2ui-core/mock/card-mock.json?raw";
import dataBindingMock from "../../../packages/a2ui-core/mock/data-binding-mock.json?raw";
import listMock from "../../../packages/a2ui-core/mock/list-mock.json?raw";
import cartListMock from "../../../packages/a2ui-core/mock/cart-list-mock.json?raw";
import { useStore, defaultRenderMap, A2UIRenderer } from "@a2ui/react";
import type { SurfaceTree } from "@a2ui/core";

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
  "button-demo": {
    label: "Button Demo — primary / default / action",
    data: buttonMock,
  },
  "image-demo": {
    label: "Image Demo — icon / avatar / feature / header",
    data: imageMock,
  },
  "icon-demo": {
    label: "Icon Demo — 12 种 Material 图标",
    data: iconMock,
  },
  "video-demo": {
    label: "Video Demo — 视频播放器",
    data: videoMock,
  },
  "card-demo": {
    label: "Card Demo — 卡片容器 + 嵌套内容",
    data: cardMock,
  },
  "data-binding": {
    label: "Data Binding — 数据绑定 / path / 简写 / 模板列表",
    data: dataBindingMock,
  },
  "list-demo": {
    label: "List Demo — List 组件 / template 动态列表",
    data: listMock,
  },
  "cart-list-demo": {
    label: "Cart List Demo — 购物车列表预览",
    data: cartListMock,
  },
};

export function App() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [trees, setTrees] = useState<SurfaceTree[]>([]);
  const [selectedMock, setSelectedMock] = useState<string>("cart-list-demo");
  const [streamMode, setStreamMode] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState<string | null>(null);

  /** 用于取消正在进行的流式模拟 */
  const abortRef = useRef(false);

  /** 批量加载：Stream OFF，完整数据直接喂入 */
  const loadMockDataBatch = useCallback((mockKey: string) => {
    abortRef.current = true;
    destroyStore();
    init(defaultRenderMap, (trees) => setTrees(trees));

    const rawData = MOCK_REGISTRY[mockKey].data;
    const sp = new StreamProcessor();
    sp.feed(rawData);
    sp.flush();

    setSelectedMock(mockKey);
    setStreaming(false);
    setStreamProgress(null);
  }, []);

  /** 流式加载：Stream ON，模拟逐 chunk 推送 */
  const loadMockDataStream = useCallback(async (mockKey: string) => {
    abortRef.current = false;
    destroyStore();

    const rawData = MOCK_REGISTRY[mockKey].data;
    // 估算组件数：统计 "id":" 出现次数 / 2（消息体 + 引用各出现一次）
    const idMatches = rawData.match(/"id"\s*:\s*"/g) || [];
    const estimatedTotal = Math.max(1, Math.ceil(idMatches.length / 2));

    let processedCount = 0;
    init(defaultRenderMap, (trees) => {
      processedCount++;
      setTrees(trees);
      setStreamProgress(estimatedTotal ? `${processedCount}/${estimatedTotal}` : `${processedCount}`);
    });

    setSelectedMock(mockKey);
    setStreaming(true);
    setTrees([]);

    const sp = new StreamProcessor();
    const CHUNK_SIZE = 40;   // 每次推送 ~40 字符，模拟 LLM token 输出
    const CHUNK_DELAY = 10;  // 每块间隔 ~10ms

    let offset = 0;
    while (offset < rawData.length && !abortRef.current) {
      const chunk = rawData.slice(offset, offset + CHUNK_SIZE);
      sp.feed(chunk);
      offset += CHUNK_SIZE;
      await new Promise((r) => setTimeout(r, CHUNK_DELAY));
    }

    sp.flush();
    setStreaming(false);
    setStreamProgress(null);
  }, []);

  /** Stream 开关控制 */
  const loadMockData = useCallback(
    (mockKey: string) => {
      streamMode ? loadMockDataStream(mockKey) : loadMockDataBatch(mockKey);
    },
    [streamMode, loadMockDataBatch, loadMockDataStream],
  );

  // 初始化加载默认 mock
  useEffect(() => {
    loadMockData(selectedMock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store 数据订阅（调试面板用）
  const surfaceMap = useStore((state) => state.surfaceMap);
  const hydrateNodeMap = useStore((state) => state.hydrateNodeMap);
  const errorMap = useStore((state) => state.errorMap);
  const dataModelMap = useStore((state) => state.dataModelMap);
  const renderMapKeys = useStore((state) => Object.keys(state.renderMap));

  const storeSnapshot = {
    surfaceMap,
    hydrateNodeMap,
    dataModelMap,
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
              <A2UIRenderer vnode={tree.rootComponent} />
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
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "组件总数", value: Object.keys(hydrateNodeMap).length, color: "#1677ff" },
            { label: "Surface", value: Object.keys(surfaceMap).length, color: "#52c41a" },
            { label: "数据模型", value: Object.keys(dataModelMap).length, color: "#fa8c16" },
            { label: "已注册渲染器", value: renderMapKeys.length, color: "#722ed1" },
            { label: "错误", value: Object.keys(errorMap).length, color: "#ff4d4f" },
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
