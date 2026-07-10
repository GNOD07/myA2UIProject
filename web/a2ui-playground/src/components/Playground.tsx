import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Button, Typography, Card, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import {
  init,
  destroyStore,
  StreamProcessor,
} from '@a2ui/core';
import { useStore, defaultRenderMap, A2UIRenderer } from '@a2ui/react';
import type { SurfaceTree } from '@a2ui/core';

const { Header, Content, Footer, Sider } = Layout;
const { TextArea } = Input;
const { Title, Text } = Typography;

// 定义对话消息的类型
interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// SSE 事件类型
interface SSEEvent {
  type: string;
  name?: string;
  value?: any;
  content?: string;
}

const Playground: React.FC = () => {
  // 状态管理
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      content: '你好！我是 A2UI AI 助手，可以帮你生成 UI 界面。请告诉我你想要什么样的界面（例如：创建一个登录页面、设计一个商品卡片等）。',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // A2UI 渲染相关状态
  const [trees, setTrees] = useState<SurfaceTree[]>([]);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [streamProgress, setStreamProgress] = useState<string | null>(null);
  const abortRef = useRef(false);

  // 初始化 A2UI
  useEffect(() => {
    init(defaultRenderMap, (trees) => setTrees(trees), handleUserAction);

    // 组件卸载时清理
    return () => {
      destroyStore();
    };
  }, []);

  // 处理用户操作的回调
  const handleUserAction = (action: import('@a2ui/core').UserActionPayload) => {
    if (action.name === 'updateMessage') {
      console.log('收到用户操作:', action);
    } else if (action.name === 'openLink') {
      const url = action.context?.url;
      if (url && typeof url === 'string') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  /**
   * 从服务器获取流式响应
   */
  const fetchFromServerWithSSE = async (prompt: string) => {
    abortRef.current = false;

    // 重置 A2UI 存储
    destroyStore();
    init(defaultRenderMap, (trees) => setTrees(trees), handleUserAction);
    setTrees([]);
    setStreaming(true);
    setStreamProgress('⏳ 请求服务器中...');

    const sp = new StreamProcessor();
    let chunkCount = 0;

    try {
      const response = await fetch('/api/generate-ui', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      // 读取 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (abortRef.current) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一行未完成的部分

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6); // 去掉 "data: " 前缀
          if (jsonStr === '[DONE]') {
            setStreamProgress('✅ 完成');
            setTimeout(() => {
              setStreaming(false);
              setStreamProgress(null);
            }, 500);
            break;
          }

          try {
            const event: SSEEvent = JSON.parse(jsonStr);

            // 更新进度
            if (event.type === 'RUN_STARTED') {
              setStreamProgress('⏳ Agent 开始生成...');
            } else if (event.type === 'RUN_FINISHED') {
              setStreamProgress(`✅ 完成，共接收 ${chunkCount} 个碎片`);
            } else if (event.type === 'ERROR') {
              throw new Error(event.content || '服务器错误');
            }

            // 处理 CHUNK 事件：原始 JSON 碎片，直接喂给 StreamProcessor
            if (event.type === 'CHUNK' && event.content) {
              sp.feed(event.content);
              chunkCount++;
              setStreamProgress(`⏳ 流式传输中... ${chunkCount} 个碎片`);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected token u in JSON at position 0') {
              console.error('解析事件失败:', e);
            }
          }
        }
      }

      // 冲刷缓冲区
      sp.flush();

      console.log(`[Playground] 成功加载，共接收 ${chunkCount} 个碎片`);
    } catch (error) {
      console.error('[Playground] 请求失败:', error);
      setStreamProgress(`❌ 请求失败`);
      throw error;
    } finally {
      if (!abortRef.current) {
        setStreaming(false);
        setStreamProgress(null);
      }
    }
  };

  // 发送消息处理函数
  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    // 添加用户消息
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      // 调用服务器 SSE 接口
      await fetchFromServerWithSSE(inputValue);

      // 添加 AI 回复
      const aiReply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `已根据您的请求："${inputValue}" 生成相应的 UI 界面，请在右侧预览区域查看效果。`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiReply]);
    } catch (error) {
      console.error('生成失败:', error);
      message.error('请求服务器失败，请检查后端服务是否运行');

      // 添加错误消息
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: '抱歉，生成界面时出现错误。请确保后端服务正在运行，然后重试。',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setInputValue('');
    }
  };

  // 处理回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Store 数据订阅（用于调试面板）
  const surfaceMap = useStore((state) => state.surfaceMap);
  const hydrateNodeMap = useStore((state) => state.hydrateNodeMap);
  const errorMap = useStore((state) => state.errorMap);
  const dataModelMap = useStore((state) => state.dataModelMap);
  const renderMapKeys = useStore((state) => Object.keys(state.renderMap));

  return (
    <Layout style={{ height: '100vh' }}>
      {/* 左侧对话区域 */}
      <Sider width="30%" style={{
        background: '#fff',
        borderRight: '1px solid #e8e8e8',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Header style={{
          padding: '16px',
          background: '#fafafa',
          borderBottom: '1px solid #e8e8e8',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          A2UI 对话助手
        </Header>

        <Content style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {messages.map((item) => (
              <div
                key={item.id}
                style={{
                  textAlign: item.role === 'user' ? 'right' : 'left',
                  marginBottom: '16px'
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    maxWidth: '80%',
                    backgroundColor: item.role === 'user' ? '#e6f7ff' : '#f0f0f0',
                    border: item.role === 'user' ? '1px solid #91d5ff' : '1px solid #d9d9d9',
                  }}
                >
                  <Text strong style={{
                    display: 'block',
                    marginBottom: '4px',
                    color: item.role === 'user' ? '#1890ff' : '#535353'
                  }}>
                    {item.role === 'user' ? '用户' : 'A2UI'}
                  </Text>
                  <Text>{item.content}</Text>
                  <div style={{
                    fontSize: '12px',
                    color: '#8c8c8c',
                    marginTop: '4px',
                    textAlign: 'right'
                  }}>
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Content>

        <Footer style={{
          padding: '16px',
          background: '#fff',
          borderTop: '1px solid #e8e8e8',
        }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={handleKeyDown}
            placeholder="输入你的界面需求..."
            autoSize={{ minRows: 2, maxRows: 6 }}
            style={{ marginBottom: '8px' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={loading}
            disabled={!inputValue.trim() || loading}
            block
          >
            发送
          </Button>

          {streaming && streamProgress && (
            <div style={{
              marginTop: '8px',
              padding: '4px 8px',
              backgroundColor: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#1890ff',
              textAlign: 'center'
            }}>
              {streamProgress}
            </div>
          )}
        </Footer>
      </Sider>

      {/* 右侧预览区域 */}
      <Layout style={{ background: '#fff' }}>
        <Content style={{
          padding: '24px',
          margin: '16px',
          background: '#fafafa',
          border: '2px dashed #d9d9d9',
          borderRadius: '8px',
          minHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Card
            title={
              <span>
                A2UI 实时渲染预览区
                {streaming && streamProgress && (
                  <span
                    style={{
                      marginLeft: 12,
                      fontSize: 13,
                      fontWeight: 400,
                      color: '#1677ff',
                    }}
                  >
                    {streamProgress}
                  </span>
                )}
              </span>
            }
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
          >
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
              backgroundColor: '#ffffff',
              border: '1px solid #f0f0f0',
              borderRadius: '4px'
            }}>
              {trees.length === 0 ? (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  color: '#bfbfbf'
                }}>
                  <Title level={3} style={{ color: '#bfbfbf' }}>
                    A2UI 实时渲染预览区
                  </Title>
                  <Text type="secondary">
                    生成的 UI 界面将在此处实时展示
                  </Text>
                  <div style={{ marginTop: '16px', padding: '12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' }}>
                    <Text>提示：在左侧输入框描述你的界面需求，右侧将实时渲染结果</Text>
                  </div>
                </div>
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
            </div>

            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#f9f9f9',
              border: '1px solid #eee',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <Text type="secondary">
                当前状态：{trees.length} 个 Surface |
                {Object.keys(hydrateNodeMap).length} 个组件 |
                渲染器：{renderMapKeys.join(', ')}
              </Text>
            </div>
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Playground;