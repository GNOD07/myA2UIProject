import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Button, Typography, Card, message, Switch, Modal } from 'antd';
import { SendOutlined, CameraOutlined, CloseOutlined } from '@ant-design/icons';
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
  sessionId?: string;
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

  // 模型对话测试模式
  const [chatMode, setChatMode] = useState<boolean>(false);

  // A2UI 渲染相关状态
  const [trees, setTrees] = useState<SurfaceTree[]>([]);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [streamProgress, setStreamProgress] = useState<string | null>(null);
  const abortRef = useRef(false);
  const streamingMsgIdRef = useRef<string | null>(null); // 跟踪正在流式输出的消息 ID
  const isFirstTurnRef = useRef<boolean>(true); // 追踪是否为首轮对话（首轮需要重置 store）
  const sessionIdRef = useRef<string>(''); // 服务端会话 ID，用于维护多轮对话历史
  const fileInputRef = useRef<HTMLInputElement>(null); // 隐藏的图片上传 input

  // 图片数据（base64 data URL），用户粘贴或上传后设置
  const [imageData, setImageData] = useState<string | null>(null);

  // 原始 JSONL 数据（用于弹窗展示）
  const [rawJsonl, setRawJsonl] = useState<string>('');
  const [jsonModalVisible, setJsonModalVisible] = useState<boolean>(false);

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
   * 从服务器获取流式响应（支持多轮对话）
   */
  const fetchFromServerWithSSE = async (prompt: string) => {
    abortRef.current = false;

    // 仅首轮重置 store，后续轮次保留现有状态以支持增量更新
    if (isFirstTurnRef.current) {
      destroyStore();
      init(defaultRenderMap, (trees) => setTrees(trees), handleUserAction);
      setTrees([]);
      setRawJsonl('');
      sessionIdRef.current = ''; // 新会话，重置 sessionId
    }

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
        body: JSON.stringify({
          prompt,
          sessionId: sessionIdRef.current || undefined,
          imageData: imageData || undefined,
        }),
      });

      // 发送后清空图片
      if (imageData) setImageData(null);

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
              // 存储服务端返回的 sessionId，后续请求带上以维护对话历史
              if (event.sessionId) {
                sessionIdRef.current = event.sessionId;
              }
            } else if (event.type === 'ERROR') {
              throw new Error(event.content || '服务器错误');
            }

            // 处理 CHUNK 事件：原始 JSON 碎片，直接喂给 StreamProcessor
            if (event.type === 'CHUNK' && event.content) {
              setRawJsonl(prev => prev + event.content);
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

  /**
   * 纯模型对话：调用 /api/chat 流式返回模型回复，通过 onChunk 回调实时更新 UI
   */
  const fetchChatFromServer = async (
    history: Message[],
    onChunk: (partialContent: string) => void,
  ) => {
    abortRef.current = false;
    setStreaming(true);
    setStreamProgress('💬 模型思考中...');

    // 构建消息历史
    const chatMessages = [
      { role: 'system', content: '你是一个有帮助的AI助手。请用中文回答用户的问题。' },
      ...history.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
    ];

    let replyContent = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ messages: chatMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (abortRef.current) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') {
            setStreamProgress('✅ 回复完成');
            setTimeout(() => {
              setStreaming(false);
              setStreamProgress(null);
            }, 500);
            break;
          }

          try {
            const event: SSEEvent = JSON.parse(jsonStr);

            if (event.type === 'CHAT_STARTED') {
              setStreamProgress('💬 模型生成中...');
            } else if (event.type === 'CHAT_CHUNK' && event.content) {
              replyContent += event.content;
              onChunk(replyContent); // 实时回调，更新 UI
              setStreamProgress(`💬 模型生成中... ${replyContent.length} 字符`);
            } else if (event.type === 'CHAT_FINISHED') {
              setStreamProgress(`✅ 回复完成，共 ${replyContent.length} 字符`);
            } else if (event.type === 'CHAT_ERROR') {
              throw new Error(event.content || '模型调用错误');
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected token u in JSON at position 0') {
              console.error('解析聊天事件失败:', e);
              if (e.message.includes('模型调用错误')) throw e;
            }
          }
        }
      }

      console.log(`[Chat] 模型回复完成，共 ${replyContent.length} 字符`);
      return replyContent;
    } catch (error) {
      console.error('[Chat] 请求失败:', error);
      setStreamProgress('❌ 模型调用失败');
      throw error;
    } finally {
      if (!abortRef.current) {
        setStreaming(false);
        setStreamProgress(null);
      }
    }
  };

  /**
   * 本地 Mock 流式模拟：通过 SSE 逐条接收 mock 消息，模拟真实流式传输
   */
  const loadLocalMock = async (mockName: string) => {
    abortRef.current = false;

    // 重置 A2UI 存储
    destroyStore();
    init(defaultRenderMap, (trees) => setTrees(trees), handleUserAction);
    setTrees([]);
    setRawJsonl('');
    // 加载 Mock 后重置首轮标记，后续发送消息时从全新状态开始
    isFirstTurnRef.current = true;
    setStreaming(true);
    setStreamProgress(`⏳ 请求 Mock: ${mockName}...`);

    const sp = new StreamProcessor();
    let chunkCount = 0;

    try {
      const response = await fetch(`/api/mock/${mockName}`);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      // 以 SSE 方式逐条读取
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (abortRef.current) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6); // 去掉 "data: " 前缀
          if (jsonStr === '[DONE]') {
            setStreamProgress(`✅ 完成，共 ${chunkCount} 条消息`);
            setTimeout(() => {
              setStreaming(false);
              setStreamProgress(null);
            }, 500);
            break;
          }

          try {
            const event: SSEEvent = JSON.parse(jsonStr);

            if (event.type === 'RUN_STARTED') {
              setStreamProgress(`⏳ ${event.content}`);
            } else if (event.type === 'RUN_FINISHED') {
              setStreamProgress(`✅ ${event.content}`);
            } else if (event.type === 'ERROR') {
              throw new Error(event.content || '服务器错误');
            } else if (event.type === 'CHUNK' && event.content) {
              // 记录原始 JSONL（用于弹窗展示）
              setRawJsonl((prev) => prev + event.content);
              // 喂入 StreamProcessor，增量渲染
              sp.feed(event.content);
              chunkCount++;
              setStreamProgress(`⏳ 流式接收中... 第 ${chunkCount} 条消息`);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected token u in JSON at position 0') {
              console.error('解析 SSE 事件失败:', e);
              if (e.message.includes('服务器错误')) throw e;
            }
          }
        }
      }

      // 冲刷缓冲区
      sp.flush();

      console.log(`[LocalMock] 成功加载 ${mockName}，共 ${chunkCount} 条消息`);
    } catch (error: any) {
      console.error('[LocalMock] 加载失败:', error);
      message.error(`加载 Mock 失败: ${error.message}`);
      setStreamProgress('❌ 加载失败');
      setTimeout(() => {
        setStreaming(false);
        setStreamProgress(null);
      }, 1500);
    } finally {
      if (!abortRef.current) {
        // 延迟清理，让用户看到完成状态
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
      if (chatMode) {
        // 纯模型对话模式：先插入占位消息，再通过 onChunk 流式更新
        const streamingId = (Date.now() + 1).toString();
        streamingMsgIdRef.current = streamingId;

        const placeholderMsg: Message = {
          id: streamingId,
          role: 'ai',
          content: '💬 思考中...',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, placeholderMsg]);

        await fetchChatFromServer(
          [...messages, newUserMessage],
          (partialContent: string) => {
            // 实时更新占位消息的内容
            setMessages(prev =>
              prev.map(m =>
                m.id === streamingId ? { ...m, content: partialContent } : m
              )
            );
          }
        );

        streamingMsgIdRef.current = null;
      } else {
        // A2UI 界面生成模式（服务端维护对话历史，前端只管传 sessionId）
        const isFirst = isFirstTurnRef.current;
        await fetchFromServerWithSSE(inputValue);
        if (isFirst) isFirstTurnRef.current = false;

        const aiReply: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: isFirst
            ? `已根据您的请求："${inputValue}" 生成相应的 UI 界面。`
            : `已根据您的微调请求更新了界面。`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiReply]);
      }
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

  /** File → base64 data URL */
  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

  /** 粘贴图片（Ctrl+V）→ 设置 imageData */
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) setImageData(await fileToDataUrl(file));
        return;
      }
    }
  };

  /** 文件选择 → 设置 imageData */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageData(await fileToDataUrl(file));
    // 重置以便重复选同一文件
    e.target.value = '';
  };

  /** 重置 UI：清空 store、对话状态和 sessionId，准备全新 UI 生成 */
  const handleResetUI = () => {
    isFirstTurnRef.current = true;
    sessionIdRef.current = '';
    destroyStore();
    init(defaultRenderMap, (trees) => setTrees(trees), handleUserAction);
    setTrees([]);
    setRawJsonl('');
    message.success('UI 已重置，可以开始新的界面生成');
  };

  /** 预览区点击：从事件目标向上查找带 componentId 的 DOM 元素，自动填入输入框 */
  const handlePreviewClick = (e: React.MouseEvent) => {
    let el = e.target as HTMLElement | null;
    const container = e.currentTarget as HTMLElement;
    while (el && el !== container) {
      const compId = el.id;
      if (compId && hydrateNodeMap[compId]) {
        setInputValue(prev => {
          const ref = `@${compId} `;
          return prev ? prev + ref : ref;
        });
        message.info(`已引用组件: ${compId}`);
        return;
      }
      el = el.parentElement;
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>A2UI 对话助手</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 12, color: chatMode ? '#1677ff' : '#8c8c8c' }}>
              {chatMode ? '💬 对话测试' : '🎨 UI生成'}
            </Text>
            <Switch
              checked={chatMode}
              onChange={(checked) => {
                setChatMode(checked);
                if (checked) {
                  message.info('已开启模型对话测试模式，发送消息将直接与模型对话');
                } else {
                  message.info('已切换回 UI 生成模式');
                }
              }}
              checkedChildren="对话"
              unCheckedChildren="UI"
            />
          </div>
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
          {/* 图片预览 */}
          {imageData && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
              <img src={imageData} alt="预览"
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #d9d9d9' }} />
              <Button type="text" size="small" danger icon={<CloseOutlined />}
                onClick={() => setImageData(null)}
                style={{ position: 'absolute', top: -10, right: -10, background: '#fff', borderRadius: '50%' }} />
            </div>
          )}

          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={handleKeyDown}
            onPaste={handlePaste}
            placeholder="输入界面需求，可粘贴截图..."
            autoSize={{ minRows: 2, maxRows: 6 }}
            style={{ marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendMessage}
              loading={loading}
              disabled={!inputValue.trim() || loading}
              style={{ flex: 1 }}
            >
              发送
            </Button>
            <Button
              icon={<CameraOutlined />}
              onClick={() => fileInputRef.current?.click()}
              title="上传图片"
            />
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
          </div>

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                {rawJsonl && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setJsonModalVisible(true)}
                  >
                    查看 A2UI JSON
                  </Button>
                )}
                <Button
                  type="default"
                  size="small"
                  loading={streaming}
                  onClick={() => loadLocalMock('agent-back')}
                  style={{ marginLeft: 8 }}
                >
                  📋 加载 Dashboard Mock
                </Button>
                <Button
                  type="text"
                  size="small"
                  onClick={handleResetUI}
                  disabled={trees.length === 0}
                  style={{ marginLeft: 8 }}
                >
                  🔄 新对话
                </Button>
              </div>
            }
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
          >
            <div
              onClick={handlePreviewClick}
              title="点击组件可快速引用其 ID 到输入框"
              style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
              backgroundColor: '#ffffff',
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              cursor: 'pointer',
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

      {/* JSON 查看弹窗 */}
      <Modal
        title="A2UI JSON 数据"
        open={jsonModalVisible}
        onCancel={() => setJsonModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setJsonModalVisible(false)}>关闭</Button>,
        ]}
        width={800}
      >
        <pre style={{
          maxHeight: '60vh',
          overflow: 'auto',
          backgroundColor: '#f5f5f5',
          padding: 16,
          borderRadius: 4,
          fontSize: 13,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {(() => {
            try {
              // 尝试格式化 JSONL（每行独立格式化）
              return rawJsonl
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                  try {
                    return JSON.stringify(JSON.parse(line), null, 2);
                  } catch {
                    return line;
                  }
                })
                .join('\n');
            } catch {
              return rawJsonl;
            }
          })()}
        </pre>
      </Modal>
    </Layout>
  );
};

export default Playground;