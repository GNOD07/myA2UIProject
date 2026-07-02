# CLAUDE.md

为 Claude Code 提供项目上下文和开发指引。

## 语言和沟通

- 永远使用简体中文进行思考和对话。
- 所有的解释、文档说明、错误分析都必须用中文输出。
- 代码注释优先使用中文，变量和函数名保持英文即可。
- 除非我明确要求，否则绝对不能切换到英文。

## 项目概述

A2UI 是基于 monorepo 的 AI 驱动 UI 生成平台。用户通过自然语言与 AI Agent 交互来生成、预览和迭代 UI 界面。

## 目录结构

```
packages/
  a2ui-core/          # 核心引擎：parser、vnode、treeBuilder、store、buffer
    src/parser/       # A2UI 协议解析
    src/treeBuilder/  # 渲染树构建
    src/store/        # zustand 状态管理
    src/buffer/       # 流式缓冲与自动补全
    src/test/         # 单元测试
    mock/             # 测试 mock 数据（JSON / JSONL）
  a2ui-react/         # React 渲染引擎：renderMap、FadeIn、hooks
web/
  a2ui-playground/    # 演练场：mock 选择、渲染预览、store 调试面板
server/
  a2ui-playground-server/  # 后端服务：OpenAI 集成、协议生成、缓存
```

## 常用命令

### 开发

| 命令                  | 说明         |
| --------------------- | ------------ |
| `pnpm dev:playground` | 启动演练场   |
| `pnpm dev:server`     | 启动后端服务 |

### 构建

| 命令                    | 说明             |
| ----------------------- | ---------------- |
| `pnpm build:core`       | 构建 a2ui-core   |
| `pnpm build:react`      | 构建 a2ui-react  |
| `pnpm build:packages`   | 构建所有 package |
| `pnpm build:playground` | 构建演练场       |
| `pnpm build`            | 全量构建         |

### 测试

| 命令                                                                                                        | 说明                    |
| ----------------------------------------------------------------------------------------------------------- | ----------------------- |
| `pnpm build:core && pnpm build:react && npx mocha --require tsx "packages/a2ui-core/src/test/**/*.test.ts"` | 运行 a2ui-core 单元测试 |

### 维护

| 命令         | 说明                          |
| ------------ | ----------------------------- |
| `pnpm clean` | 清理所有 node_modules 和 dist |

## 技术栈

- TypeScript 全栈
- pnpm workspaces（monorepo 管理）
- Vite（演练场构建）
- Koa（后端服务）
- React 18 + zustand（前端渲染 + 状态管理）
- Mocha + Chai（单元测试）
- tsx（TypeScript 直接运行）

## 环境要求

- Node.js >= 18.0
- pnpm >= 8.0

## 项目规则

所有开发规则存放在 `.claude/rules/` 目录，Claude Code 在处理对应场景时自动加载：

| 规则文件                                                   | 适用场景                                      |
| ---------------------------------------------------------- | --------------------------------------------- |
| [a2ui-core-testing.md](.claude/rules/a2ui-core-testing.md) | 修改 `packages/a2ui-core/src/` 时运行单元测试 |
