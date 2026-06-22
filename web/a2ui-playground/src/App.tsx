import { useEffect } from "react";
import { init, loadJsonlIntoStore, simpleTextMock } from "@a2ui/core";
import { useStore } from "@a2ui/react";

export function App() {
  // 初始化 store 并导入 mock 数据
  useEffect(() => {
    init();
    loadJsonlIntoStore(simpleTextMock);
  }, []);

  // 获取 store 状态
  const surfaceMap = useStore((state) => state.surfaceMap);
  const hydrateNodeMap = useStore((state) => state.hydrateNodeMap);
  const errorMap = useStore((state) => state.errorMap);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <h1>A2UI Playground</h1>

      <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        <div>
          <h2>Surface Map</h2>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', maxHeight: '400px', overflow: 'auto' }}>
            {JSON.stringify(surfaceMap, null, 2)}
          </pre>
        </div>

        <div>
          <h2>Hydrate Node Map</h2>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', maxHeight: '400px', overflow: 'auto' }}>
            {JSON.stringify(hydrateNodeMap, null, 2)}
          </pre>
        </div>

        <div>
          <h2>Error Map</h2>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', maxHeight: '400px', overflow: 'auto' }}>
            {JSON.stringify(errorMap, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e6f7ff', borderRadius: '4px' }}>
        <h3>Store Initialization Status</h3>
        <p>The store has been initialized successfully. Any changes to the store state will automatically update this view.</p>
        <p>Try adding a surface in your application code to see the store update in real-time!</p>
      </div>
    </div>
  );
}
