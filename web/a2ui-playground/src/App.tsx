import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Modal, Card, Select, Space, Switch } from "antd";
import {
  init,
  destroyStore,
  getStore,
  StreamProcessor,
  loadJsonlIntoStore,
} from "@a2ui/core";
import simpleTextMock from "../../../packages/a2ui-core/mock/simple-text.json?raw";
import columnMock from "../../../packages/a2ui-core/mock/column-mock.json?raw";
import nestedColumnMock from "../../../packages/a2ui-core/mock/nested-column-mock.json?raw";
import buttonMock from "../../../packages/a2ui-core/mock/button-mock.json?raw";
import imageMock from "../../../packages/a2ui-core/mock/image-mock.json?raw";
import iconMock from "../../../packages/a2ui-core/mock/icon-mock.json?raw";
import videoMock from "../../../packages/a2ui-core/mock/video-mock.json?raw";
import cardMock from "../../../packages/a2ui-core/mock/card-mock.json?raw";
import dataBindingMock from "../../../packages/a2ui-core/mock/data-binding-mock.json?raw";
import listMock from "../../../packages/a2ui-core/mock/list-mock.json?raw";
import cartListMock from "../../../packages/a2ui-core/mock/cart-list-mock.json?raw";
import localUpdateMock from "../../../packages/a2ui-core/mock/local-update-mock.json?raw";
import openLinkMock from "../../../packages/a2ui-core/mock/open-link-mock.json?raw";
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
  "local-update": {
    label: "Local Update — Button 更新 Text",
    data: localUpdateMock,
  },
  "open-link": {
    label: "Open Link — Button 打开外部网页",
    data: openLinkMock,
  },
};

export function App() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [protocolDialogOpen, setProtocolDialogOpen] = useState(false);
  const [trees, setTrees] = useState<SurfaceTree[]>([]);
  const [selectedMock, setSelectedMock] = useState<string>("cart-list-demo");
  const [streamMode, setStreamMode] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState<string | null>(null);

  /** 服务端请求状态 */
  const [serverLoading, setServerLoading] = useState(false);
  const [serverScenario, setServerScenario] = useState("cart");
  const [serverPrompt, setServerPrompt] = useState("做一个购物车页面");

  /** 用于取消正在进行的流式模拟 */
  const abortRef = useRef(false);

  /**
   * 用户动作处理回调。
   * 根据 action.name 决定是本地更新数据模型还是发送到服务端。
   * 当前演示最简单的"本地更新"场景：按钮点击 → 更新 Text 文案。
   */
  const handleUserAction = useCallback(
    (action: import("@a2ui/core").UserActionPayload) => {
      const store = getStore();
      if (action.name === "updateMessage") {
        // 本地数据更新：将 context 中的 newValue 写入 dataModel
        const newValue = action.context?.newValue ?? "Updated!";
        store.getState().setDataModelAt(action.surfaceId, "/message", newValue);
      } else if (action.name === "openLink") {
        // 打开外部链接：从 context 中取 url，新标签页打开
        const url = action.context?.url;
        if (url && typeof url === "string") {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }
      // 未来扩展：其他 action.name → fetch/websocket 发送 userAction 到服务端
    },
    [],
  );

  /** 批量加载：Stream OFF，完整数据直接喂入（按行解析 JSONL） */
  const loadMockDataBatch = useCallback((mockKey: string) => {
    abortRef.current = true;
    destroyStore();
    init(defaultRenderMap, (trees) => setTrees(trees), handleUserAction);

    const rawData = MOCK_REGISTRY[mockKey].data;
    // 使用按行解析，避免 AutoCompleteBuffer 一次性喂入多行时的提取遗漏
    loadJsonlIntoStore(rawData);

    setSelectedMock(mockKey);
    setStreaming(false);
    setStreamProgress(null);
  }, [handleUserAction]);

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
    }, handleUserAction);

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

  /** 从服务端加载 A2UI 协议（AG-UI 标准 SSE 流式） */
  const loadFromServer = useCallback(async () => {
    setServerLoading(true);
    setStreaming(true);
    setStreamProgress("⏳ 正在请求服务端...");
    abortRef.current = true;
    destroyStore();
    init(defaultRenderMap, (trees) => setTrees(trees), handleUserAction);
    setTrees([]);

    const sp = new StreamProcessor();
    let messageCount = 0;

    try {
      const res = await fetch("/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: serverPrompt }],
          forwardedProps: { scenario: serverScenario },
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        let errMsg: string;
        if (contentType.includes("json")) {
          const err = await res.json();
          errMsg = err.error ?? err.message ?? `HTTP ${res.status}`;
        } else {
          const text = await res.text().catch(() => res.statusText);
          errMsg = text.slice(0, 200) || `HTTP ${res.status}`;
        }
        throw new Error(errMsg);
      }

      // AG-UI SSE 流式解析
      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // 按 SSE 换行切分
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 最后一段不完整，保留

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6); // 去掉 "data: " 前缀
          try {
            const event = JSON.parse(jsonStr);

            // 更新进度
            if (event.type === "RUN_STARTED") {
              setStreamProgress("⏳ Agent 开始生成...");
            } else if (event.type === "RUN_FINISHED") {
              setStreamProgress(`✅ 完成，${messageCount} 条消息`);
            }

            // 提取 A2UI CUSTOM 事件
            if (event.type === "CUSTOM" && event.name === "a2ui" && event.value) {
              if (event.value._done) continue;
              sp.feed(JSON.stringify(event.value) + "\n");
              messageCount++;
              setStreamProgress(`⏳ 已接收 ${messageCount} 条消息...`);
            }
          } catch {
            // 非 JSON 行忽略
          }
        }
      }

      // SSE 流结束，冲刷缓冲区并立即刷新组件树
      sp.flush();

      console.log(`[loadFromServer] 成功加载 ${messageCount} 条 A2UI 消息 (scenario=${serverScenario})`);
    } catch (err) {
      console.error("[loadFromServer] 失败:", err);
      setStreamProgress(`❌ ${err instanceof Error ? err.message : "请求失败"}`);
    } finally {
      setStreaming(false);
      setServerLoading(false);
    }
  }, [serverPrompt, serverScenario, handleUserAction]);

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
              color: serverLoading ? "#fa8c16" : "#1677ff",
              fontWeight: 600,
              minWidth: 60,
            }}
          >
            {serverLoading ? "服务端请求" : "流式推送中"} {streamProgress}
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
        <Button size="large" onClick={() => setProtocolDialogOpen(true)}>
          查看 A2UI 协议
        </Button>

        {/* 分隔 */}
        <span style={{ color: "#d9d9d9", fontSize: 20, margin: "0 4px" }}>|</span>

        {/* 服务端测试 */}
        <Select
          value={serverScenario}
          onChange={setServerScenario}
          size="large"
          style={{ minWidth: 160 }}
          options={[
            { value: "cart", label: "购物车" },
            { value: "simple", label: "简单文本" },
            { value: "data-binding", label: "数据绑定" },
            { value: "list", label: "List 列表" },
            { value: "button", label: "Button" },
            { value: "image", label: "Image" },
            { value: "icon", label: "Icon" },
            { value: "video", label: "Video" },
            { value: "card", label: "Card" },
            { value: "column", label: "Column" },
            { value: "open-link", label: "Open Link" },
            { value: "local-update", label: "Local Update" },
          ]}
        />
        <Button
          type="primary"
          size="large"
          loading={serverLoading}
          onClick={loadFromServer}
          style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
        >
          {serverLoading ? "请求中..." : "测试服务"}
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
                  color: serverLoading ? "#fa8c16" : "#1677ff",
                }}
              >
                {serverLoading
                  ? streamProgress
                  : `⏳ 增量构建中… ${streamProgress}`}
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

      {/* A2UI 协议 JSON 弹窗 */}
      <Modal
        title={`A2UI 协议 — ${MOCK_REGISTRY[selectedMock]?.label ?? selectedMock}`}
        open={protocolDialogOpen}
        onCancel={() => setProtocolDialogOpen(false)}
        footer={[
          <Button key="close" onClick={() => setProtocolDialogOpen(false)}>
            关闭
          </Button>,
        ]}
        width={900}
      >
        <pre
          style={{
            backgroundColor: "#1e1e1e",
            color: "#d4d4d4",
            padding: "16px",
            borderRadius: "4px",
            maxHeight: "70vh",
            overflow: "auto",
            fontSize: "13px",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {MOCK_REGISTRY[selectedMock]?.data ?? "暂无协议数据"}
        </pre>
      </Modal>
    </div>
  );
}
