import { useState, useEffect, useMemo } from "react";
import { Button, Modal, Card } from "antd";
import { init, loadJsonlIntoStore, buildTree, destroyStore } from "@a2ui/core";
import simpleTextMock from "../../../packages/a2ui-core/mock/simple-text.json?raw";
import { useStore, defaultRenderMap } from "@a2ui/react";
import type { SurfaceTree, VNode } from "@a2ui/core";

/**
 * 将 _vnode 安全渲染为 React 节点
 *
 * _vnode 有两种形态：
 * 1. ReactElement — renderMap 已渲染的结果，直接使用
 * 2. 原始 component 对象 { Type: props } — 用 renderMap 动态渲染或 JSON 展示
 */
function VNodeRenderer({ vnode }: { vnode: VNode }) {
  const renderMap = useStore((s) => s.renderMap);

  return useMemo(() => {
    if (vnode === null || vnode === undefined) return null;
    if (typeof vnode === "string" || typeof vnode === "number") return vnode as React.ReactNode;

    // ReactElement 检测：$$typeof 是 React 元素的标志位
    if (typeof vnode === "object" && "$$typeof" in vnode) {
      return vnode as unknown as React.ReactNode;
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

  // 按顺序：销毁旧实例 → init(renderMap) → load → buildTree
  useEffect(() => {
    destroyStore();
    init(defaultRenderMap);
    loadJsonlIntoStore(simpleTextMock);
    setTrees(buildTree());
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

      <div style={{ display: "flex", gap: 12, marginTop: 16, marginBottom: 24 }}>
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
      <Card title="渲染预览" style={{ marginTop: 20 }}>
        {trees.length === 0 ? (
          <p style={{ color: "#999" }}>暂无活跃 Surface</p>
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
