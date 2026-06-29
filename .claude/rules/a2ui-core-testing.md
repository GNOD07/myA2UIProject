# a2ui-core 单元测试规则

## 触发条件

当修改 `packages/a2ui-core/src/` 目录下的任何源代码时，此规则生效。

## 要求

1. **必须构建**：改动完成后先执行 `pnpm build:core && pnpm build:react` 确保编译通过
2. **必须运行测试**：执行完整单元测试套件，所有测试通过才算改动完成
3. **失败必须修复**：测试不通过时必须在提交前修复，不允许提交破坏性代码
4. **新功能补测试**：新增功能必须同步补充对应的单元测试用例

## 测试命令

```bash
pnpm build:core && pnpm build:react && npx mocha --require tsx "packages/a2ui-core/src/test/**/*.test.ts"
```

## 测试文件位置

- 测试文件位于 `packages/a2ui-core/src/test/` 目录
- 测试框架：Mocha + Chai
- 运行时：tsx（TypeScript 直接执行）

## 当前测试覆盖范围

| 测试套件 | 文件 | 说明 |
|---------|------|------|
| A2UIBuffer | `buffer.test.ts` | 行缓冲、流缓冲、自动补全缓冲区 |
| parser | `parser.test.ts` | 协议解析、JSONL 加载、renderMap 集成 |

## 违规后果

未通过测试的代码不得合并到主分支，CI 流水线会拦截。
