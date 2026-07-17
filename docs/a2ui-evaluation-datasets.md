# A2UI 评测数据集

本文件包含 20 个 A2UI 评测案例，用于评估 AI Agent 将自然语言需求转换为 A2UI JSONL 协议的能力。

每个案例包含：
- **业务场景**：描述真实的用户需求背景
- **用户输入**：模拟用户自然语言描述
- **期望输出**：符合 A2UI 协议的 JSONL 文本
- **评测要点**：该案例重点验证的能力维度

---

## 评测案例概览

| 编号 | 场景名称 | 复杂度 | 涉及组件 | 核心评测维度 |
|------|---------|--------|---------|-------------|
| 01 | 餐厅欢迎页 | 简单 | Text | 基础文本生成、usageHint |
| 02 | 快捷操作栏 | 简单 | Row, Icon, Text | 横向布局、图标使用 |
| 03 | 图文介绍卡片 | 简单 | Card, Image, Text | 卡片结构、child 引用 |
| 04 | 操作按钮组 | 简单 | Row, Button, Text | Button child、action 定义 |
| 05 | 视频介绍页 | 简单 | Column, Video, Text | 视频组件、混合布局 |
| 06 | 价格列表 | 简单 | List, Text | 静态列表 explicitList |
| 07 | 页脚信息栏 | 简单 | Row, Column, Text | 嵌套布局、distribution |
| 08 | 用户反馈表单 | 中等 | Column, TextField, Button | TextField 类型、表单布局 |
| 09 | 数据绑定标题 | 中等 | Column, Text | path 绑定、dataModelUpdate |
| 10 | 动态标签列表 | 中等 | List, Text, template | 模板列表、dataBinding |
| 11 | 电商商品详情页 | 复杂 | Card, Column, Row, Image, Text, Button, List | 多层嵌套、数据绑定、多交互 |
| 12 | 用户个人资料页 | 复杂 | Card, Column, Row, Image, Text, Icon, Button | 头像、信息分组、编辑入口 |
| 13 | 外卖点餐页面 | 复杂 | Column, List, Card, Row, Image, Text, Button, template | 动态列表、分类筛选、购物车 |
| 14 | 新闻资讯列表 | 复杂 | Column, List, Card, Row, Image, Text, template | 模板列表、复杂卡片、数据绑定 |
| 15 | 社交媒体动态 | 复杂 | Card, Column, Row, Image, Text, Icon, Button | 多层嵌套、图标+交互、点赞评论 |
| 16 | 应用设置页面 | 复杂 | Column, Row, Text, TextField, Button, List | 分组表单、验证规则、多种输入类型 |
| 17 | 数据仪表盘 | 复杂 | Column, Row, Card, Text, Icon, List, template | 统计卡片、数据绑定、多区块布局 |
| 18 | 用户注册页面 | 复杂 | Column, Text, TextField, Button, Row | 多输入框、正则验证、密码确认 |
| 19 | 在线课程详情页 | 复杂 | Column, Row, Video, Card, List, Image, Text, Button, template | 视频+章节、进度显示、复杂数据 |
| 20 | 酒店预订确认页 | 复杂 | Card, Column, Row, Image, Text, Icon, Button, List | 多卡片嵌套、预订信息、支付操作 |

---

## 基础评测案例（1-10）

### 评测案例 01：餐厅欢迎页

**业务场景**：一家餐厅的移动端欢迎页面，展示店名和营业信息。

**用户输入**：
> 做一个餐厅欢迎页，显示餐厅名称"山月居"和营业时间"每日 11:00 - 22:00"。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"welcome-col"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"welcome-col","component":{"Column":{"children":{"explicitList":["restaurant-name","opening-hours"]},"distribution":"center","alignment":"center"}}},{"id":"restaurant-name","component":{"Text":{"text":{"literalString":"山月居"},"usageHint":"h1"}}},{"id":"opening-hours","component":{"Text":{"text":{"literalString":"每日 11:00 - 22:00"},"usageHint":"body"}}}]}}
```

**评测要点**：
- ✅ 正确输出 `beginRendering` 为首条消息
- ✅ `root` 指向的组件 ID 在 `surfaceUpdate` 中存在
- ✅ `Text` 组件 text 使用 `literalString`
- ✅ 合理使用 `usageHint`（标题用 h1，正文用 body）
- ✅ 组件 ID 语义化命名（非 `a`、`c1` 等）
- ✅ JSONL 格式正确，无 markdown 包裹

---

### 评测案例 02：快捷操作栏

**业务场景**：一个 App 首页的快捷功能入口，水平排列 3 个图标+文字的操作项。

**用户输入**：
> 做一个快捷操作栏，横向排列三个按钮：搜索、消息、设置，每个都有对应的图标。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"action-bar"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"action-bar","component":{"Row":{"children":{"explicitList":["search-item","message-item","settings-item"]},"distribution":"spaceAround","alignment":"center"}}},{"id":"search-item","component":{"Column":{"children":{"explicitList":["search-icon","search-label"]},"distribution":"center","alignment":"center"}}},{"id":"search-icon","component":{"Icon":{"name":{"literalString":"search"}}}},{"id":"search-label","component":{"Text":{"text":{"literalString":"搜索"},"usageHint":"caption"}}},{"id":"message-item","component":{"Column":{"children":{"explicitList":["message-icon","message-label"]},"distribution":"center","alignment":"center"}}},{"id":"message-icon","component":{"Icon":{"name":{"literalString":"mail"}}}},{"id":"message-label","component":{"Text":{"text":{"literalString":"消息"},"usageHint":"caption"}}},{"id":"settings-item","component":{"Column":{"children":{"explicitList":["settings-icon","settings-label"]},"distribution":"center","alignment":"center"}}},{"id":"settings-icon","component":{"Icon":{"name":{"literalString":"settings"}}}},{"id":"settings-label","component":{"Text":{"text":{"literalString":"设置"},"usageHint":"caption"}}}]}}
```

**评测要点**：
- ✅ `Row` 横向排列 + `spaceAround` 均匀分布
- ✅ `Icon` 的 name 在支持的 48 个图标名称内
- ✅ 嵌套 `Column` 实现图标上+文字下的布局
- ✅ `usageHint: caption` 用于辅助文字
- ✅ `explicitList` 中所有 ID 在 components 中有定义

---

### 评测案例 03：图文介绍卡片

**业务场景**：企业官网的产品介绍卡片，展示产品图片、名称和特性描述。

**用户输入**：
> 做一个产品介绍卡片，包含一张产品图片、产品名称"智能音箱 Pro"和描述文字"360°环绕立体声，AI语音助手，支持全屋互联"。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"product-card"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"product-card","component":{"Card":{"child":"card-content"}}},{"id":"card-content","component":{"Column":{"children":{"explicitList":["product-image","product-name","product-desc"]},"alignment":"start"}}},{"id":"product-image","component":{"Image":{"url":{"literalString":"https://example.com/speaker.jpg"},"usageHint":"mediumFeature","fit":"cover"}}},{"id":"product-name","component":{"Text":{"text":{"literalString":"智能音箱 Pro"},"usageHint":"h3"}}},{"id":"product-desc","component":{"Text":{"text":{"literalString":"360°环绕立体声，AI语音助手，支持全屋互联"},"usageHint":"body"}}}]}}
```

**评测要点**：
- ✅ `Card.child` 使用单数字符串（非 `children.explicitList`）
- ✅ `Image` 使用 `usageHint: mediumFeature` 适合内容配图
- ✅ `Column.alignment: start` 让内容靠左对齐
- ✅ 图片→标题→描述的层次顺序合理
- ✅ `Image.fit: cover` 保持图片比例

---

### 评测案例 04：操作按钮组

**业务场景**：一个确认对话框的操作按钮，包含"取消"和"确认支付"两个按钮。

**用户输入**：
> 做一个操作按钮区域，右边放两个按钮：第一个是灰色的"取消"，第二个是蓝色的"确认支付"，点击确认时触发 payOrder 动作，传递订单ID为 order-2024。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"action-row"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"action-row","component":{"Row":{"children":{"explicitList":["cancel-btn","confirm-btn"]},"distribution":"end","alignment":"center"}}},{"id":"cancel-btn","component":{"Button":{"child":"cancel-text","primary":false,"action":{"name":"cancel"}}}},{"id":"cancel-text","component":{"Text":{"text":{"literalString":"取消"}}}},{"id":"confirm-btn","component":{"Button":{"child":"confirm-text","primary":true,"action":{"name":"payOrder","context":[{"key":"orderId","value":{"literalString":"order-2024"}}]}}}},{"id":"confirm-text","component":{"Text":{"text":{"literalString":"确认支付"}}}}]}}
```

**评测要点**：
- ✅ `Button.child` 是字符串 ID（非对象/数组）
- ✅ `primary: true/false` 区分主次按钮
- ✅ `Row.distribution: end` 将按钮靠右排列
- ✅ `action.context` 中 value 使用 `literalString`
- ✅ Button 的 child 指向的 Text 组件在 components 中存在

---

### 评测案例 05：视频介绍页

**业务场景**：在线教育平台的课程介绍页，展示介绍视频、课程标题和简介。

**用户输入**：
> 做一个课程介绍页，顶部放一个视频，下面显示课程名称"React 18 实战指南"，再下面是简介"从零到一掌握 React 18 新特性，包含 Suspense、Server Components 等前沿内容"。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"course-root"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"course-root","component":{"Column":{"children":{"explicitList":["intro-video","course-title","course-desc"]},"distribution":"start","alignment":"stretch"}}},{"id":"intro-video","component":{"Video":{"url":{"literalString":"https://example.com/react-course.mp4"}}}},{"id":"course-title","component":{"Text":{"text":{"literalString":"React 18 实战指南"},"usageHint":"h2"}}},{"id":"course-desc","component":{"Text":{"text":{"literalString":"从零到一掌握 React 18 新特性，包含 Suspense、Server Components 等前沿内容"},"usageHint":"body"}}}]}}
```

**评测要点**：
- ✅ `Video` 组件正确使用
- ✅ `Column.alignment: stretch` 让视频占满宽度
- ✅ 视频→标题→描述的视觉层次合理
- ✅ 长文本描述使用 `usageHint: body`

---

### 评测案例 06：价格列表

**业务场景**：SaaS 产品定价页面，展示三个不同的价格套餐。

**用户输入**：
> 做一个价格列表，展示三个套餐：基础版 ¥99/月、专业版 ¥299/月、企业版 ¥999/月。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"pricing-root"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"pricing-root","component":{"Column":{"children":{"explicitList":["pricing-title","pricing-list"]},"distribution":"start","alignment":"stretch"}}},{"id":"pricing-title","component":{"Text":{"text":{"literalString":"选择套餐"},"usageHint":"h2"}}},{"id":"pricing-list","component":{"List":{"children":{"explicitList":["plan-basic","plan-pro","plan-enterprise"]},"direction":"vertical","alignment":"stretch"}}},{"id":"plan-basic","component":{"Row":{"children":{"explicitList":["basic-name","basic-price"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"basic-name","component":{"Text":{"text":{"literalString":"基础版"},"usageHint":"h4"}}},{"id":"basic-price","component":{"Text":{"text":{"literalString":"¥99/月"},"usageHint":"body"}}},{"id":"plan-pro","component":{"Row":{"children":{"explicitList":["pro-name","pro-price"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"pro-name","component":{"Text":{"text":{"literalString":"专业版"},"usageHint":"h4"}}},{"id":"pro-price","component":{"Text":{"text":{"literalString":"¥299/月"},"usageHint":"body"}}},{"id":"plan-enterprise","component":{"Row":{"children":{"explicitList":["ent-name","ent-price"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"ent-name","component":{"Text":{"text":{"literalString":"企业版"},"usageHint":"h4"}}},{"id":"ent-price","component":{"Text":{"text":{"literalString":"¥999/月"},"usageHint":"body"}}}]}}
```

**评测要点**：
- ✅ `List` + `explicitList` 静态列表
- ✅ 每个列表项用 `Row` + `spaceBetween` 实现左右分布
- ✅ `direction: vertical` 纵向排列
- ✅ 套餐名称和价格使用不同 `usageHint`（h4 vs body）

---

### 评测案例 07：页脚信息栏

**业务场景**：应用页面底部的页脚，包含版权信息和两个链接入口。

**用户输入**：
> 做一个页脚区域，左边显示版权"© 2025 A2UI. All rights reserved."，右边放两个链接："隐私政策"和"服务条款"。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"footer-row"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"footer-row","component":{"Row":{"children":{"explicitList":["copyright-text","links-col"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"copyright-text","component":{"Text":{"text":{"literalString":"© 2025 A2UI. All rights reserved."},"usageHint":"caption"}}},{"id":"links-col","component":{"Row":{"children":{"explicitList":["privacy-link","terms-link"]},"distribution":"end","alignment":"center"}}},{"id":"privacy-link","component":{"Text":{"text":{"literalString":"隐私政策"},"usageHint":"caption"}}},{"id":"terms-link","component":{"Text":{"text":{"literalString":"服务条款"},"usageHint":"caption"}}}]}}
```

**评测要点**：
- ✅ `Row` 嵌套 `Row`：外层左右分布，内层右对齐
- ✅ 版权文字和链接在同一行两端
- ✅ 小号文字使用 `usageHint: caption`
- ✅ `alignment: center` 交叉轴居中

---

### 评测案例 08：用户反馈表单

**业务场景**：用户反馈/意见收集表单，包含姓名、邮箱和反馈内容三个输入项。

**用户输入**：
> 做一个用户反馈表单。有三个输入框：姓名（短文本）、邮箱（短文本）、反馈内容（多行文本），最下面有一个"提交反馈"按钮。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"form-root"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"form-root","component":{"Column":{"children":{"explicitList":["form-title","name-field","email-field","feedback-field","submit-btn"]},"distribution":"start","alignment":"stretch"}}},{"id":"form-title","component":{"Text":{"text":{"literalString":"意见反馈"},"usageHint":"h2"}}},{"id":"name-field","component":{"TextField":{"label":{"literalString":"姓名"},"textFieldType":"shortText"}}},{"id":"email-field","component":{"TextField":{"label":{"literalString":"邮箱"},"textFieldType":"shortText"}}},{"id":"feedback-field","component":{"TextField":{"label":{"literalString":"反馈内容"},"textFieldType":"longText"}}},{"id":"submit-btn","component":{"Button":{"child":"submit-text","primary":true,"action":{"name":"submitFeedback","context":[{"key":"formType","value":{"literalString":"feedback"}}]}}}},{"id":"submit-text","component":{"Text":{"text":{"literalString":"提交反馈"}}}}]}}
```

**评测要点**：
- ✅ `TextField.label` 使用 `{ literalString: ... }` 格式
- ✅ `textFieldType` 正确区分 `shortText` 和 `longText`
- ✅ 表单域按顺序排列
- ✅ 提交按钮使用 `primary: true`
- ✅ 所有组件 ID 语义化

---

### 评测案例 09：数据绑定标题

**业务场景**：动态页面标题，标题内容来自后端数据。

**用户输入**：
> 做一个页面，显示一个标题。标题文字从数据模型的 /page/title 路径获取，加载前显示"加载中..."。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"page-root"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"page-root","component":{"Column":{"children":{"explicitList":["page-title","page-subtitle"]},"distribution":"start","alignment":"stretch"}}},{"id":"page-title","component":{"Text":{"text":{"path":"/page/title","literalString":"加载中..."},"usageHint":"h2"}}},{"id":"page-subtitle","component":{"Text":{"text":{"path":"/page/subtitle","literalString":"正在获取数据..."},"usageHint":"body"}}}]}}
{"dataModelUpdate":{"surfaceId":"main","path":"/page","contents":[{"key":"title","valueString":"欢迎回来，张三"},{"key":"subtitle","valueString":"上次登录：2025-07-16 14:30"}]}}
```

**评测要点**：
- ✅ `Text.text` 同时包含 `path` 和 `literalString`（带默认值的数据绑定）
- ✅ `dataModelUpdate` 放在最后
- ✅ `dataModelUpdate.path: "/page"` 与组件中的 `path: "/page/title"` 路径一致
- ✅ 扁平数据结构正确（key + valueString）
- ✅ 消息顺序正确：beginRendering → surfaceUpdate → dataModelUpdate

---

### 评测案例 10：动态标签列表

**业务场景**：商品标签列表，标签数据来自后端，使用模板动态渲染。

**用户输入**：
> 做一个标签列表。标签数据从 /tags/items 获取，每个标签显示标签名称。目前有3个标签：热销、新品、限时优惠。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"main","root":"tags-root"}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"tags-root","component":{"Column":{"children":{"explicitList":["tags-title","tags-list"]},"distribution":"start","alignment":"stretch"}}},{"id":"tags-title","component":{"Text":{"text":{"literalString":"商品标签"},"usageHint":"h3"}}},{"id":"tags-list","component":{"List":{"children":{"template":{"componentId":"tag-template","dataBinding":"/tags/items"}},"direction":"horizontal","alignment":"center"}}},{"id":"tag-template","component":{"Text":{"text":{"path":"name","literalString":"标签"},"usageHint":"body"}}}]}}
{"dataModelUpdate":{"surfaceId":"main","path":"/tags","contents":[{"key":"items","valueMap":[{"key":"0","valueMap":[{"key":"name","valueString":"热销"}]},{"key":"1","valueMap":[{"key":"name","valueString":"新品"}]},{"key":"2","valueMap":[{"key":"name","valueString":"限时优惠"}]}]}]}}
```

**评测要点**：
- ✅ `children.template` 正确使用 `componentId` + `dataBinding`
- ✅ 模板组件内 `path` 使用相对路径（`"name"` 而非 `"/tags/items/name"`）
- ✅ `dataModelUpdate` 中 `valueMap` 结构正确（key 为数字索引字符串）
- ✅ `List.direction: horizontal` 横向排列标签
- ✅ `dataBinding` 路径与 `dataModelUpdate` 路径对应

---

## 复杂业务场景评测（11-20）

### 评测案例 11：电商商品详情页

**业务场景**：电商 App 的商品详情页，包含商品图片轮播区、价格信息、产品参数列表和购买操作栏。数据来自后端接口。

**用户输入**：
> 做一个手机商品详情页。最上面是商品大图，下面是商品名称、价格和促销标签（动态数据），然后是产品参数列表（屏幕尺寸、处理器、电池），最后是底部的"加入购物车"和"立即购买"两个按钮。商品名"XPhone 15 Pro"，价格 ¥6999，标签有"热销"和"新品"，参数包括屏幕 6.7英寸、处理器 A18、电池 5000mAh。加入购物车触发 addToCart，传递商品 ID "xphone-15-pro"。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"product-detail","root":"detail-root"}}
{"surfaceUpdate":{"surfaceId":"product-detail","components":[{"id":"detail-root","component":{"Column":{"children":{"explicitList":["product-hero","info-section","spec-section","action-bar"]},"distribution":"start","alignment":"stretch"}}},{"id":"product-hero","component":{"Image":{"url":{"path":"/product/image","literalString":"https://example.com/xphone.jpg"},"usageHint":"largeFeature","fit":"cover"}}},{"id":"info-section","component":{"Column":{"children":{"explicitList":["product-name","price-row","tags-list"]},"distribution":"start","alignment":"start"}}},{"id":"product-name","component":{"Text":{"text":{"path":"/product/name","literalString":"商品名称"},"usageHint":"h2"}}},{"id":"price-row","component":{"Row":{"children":{"explicitList":["current-price","original-price"]},"distribution":"start","alignment":"center"}}},{"id":"current-price","component":{"Text":{"text":{"path":"/product/price","literalString":"¥0"},"usageHint":"h2"}}},{"id":"original-price","component":{"Text":{"text":{"path":"/product/originalPrice","literalString":""},"usageHint":"caption"}}},{"id":"tags-list","component":{"List":{"children":{"template":{"componentId":"tag-chip","dataBinding":"/product/tags"}},"direction":"horizontal","alignment":"center"}}},{"id":"tag-chip","component":{"Text":{"text":{"path":"name","literalString":"标签"},"usageHint":"caption"}}},{"id":"spec-section","component":{"Column":{"children":{"explicitList":["spec-title","spec-list"]},"distribution":"start","alignment":"stretch"}}},{"id":"spec-title","component":{"Text":{"text":{"literalString":"产品参数"},"usageHint":"h3"}}},{"id":"spec-list","component":{"List":{"children":{"template":{"componentId":"spec-row","dataBinding":"/product/specs"}},"direction":"vertical","alignment":"stretch"}}},{"id":"spec-row","component":{"Row":{"children":{"explicitList":["spec-label","spec-value"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"spec-label","component":{"Text":{"text":{"path":"label","literalString":"参数"},"usageHint":"body"}}},{"id":"spec-value","component":{"Text":{"text":{"path":"value","literalString":""},"usageHint":"body"}}},{"id":"action-bar","component":{"Row":{"children":{"explicitList":["cart-btn","buy-btn"]},"distribution":"spaceEvenly","alignment":"center"}}},{"id":"cart-btn","component":{"Button":{"child":"cart-btn-text","primary":false,"action":{"name":"addToCart","context":[{"key":"productId","value":{"path":"/product/id"}},{"key":"productName","value":{"path":"/product/name"}}]}}}},{"id":"cart-btn-text","component":{"Text":{"text":{"literalString":"加入购物车"}}}},{"id":"buy-btn","component":{"Button":{"child":"buy-btn-text","primary":true,"action":{"name":"buyNow","context":[{"key":"productId","value":{"path":"/product/id"}}]}}}},{"id":"buy-btn-text","component":{"Text":{"text":{"literalString":"立即购买"}}}}]}}
{"dataModelUpdate":{"surfaceId":"product-detail","path":"/product","contents":[{"key":"id","valueString":"xphone-15-pro"},{"key":"name","valueString":"XPhone 15 Pro"},{"key":"price","valueString":"¥6999"},{"key":"originalPrice","valueString":"¥7999"},{"key":"image","valueString":"https://example.com/xphone.jpg"},{"key":"tags","valueMap":[{"key":"0","valueMap":[{"key":"name","valueString":"热销"}]},{"key":"1","valueMap":[{"key":"name","valueString":"新品"}]}]},{"key":"specs","valueMap":[{"key":"0","valueMap":[{"key":"label","valueString":"屏幕尺寸"},{"key":"value","valueString":"6.7英寸 OLED"}]},{"key":"1","valueMap":[{"key":"label","valueString":"处理器"},{"key":"value","valueString":"A18 仿生芯片"}]},{"key":"2","valueMap":[{"key":"label","valueString":"电池"},{"key":"value","valueString":"5000mAh"}]}]}]}}
```

**评测要点**：
- ✅ 多层嵌套（4层）：Column > Column > Row > Text
- ✅ 同时使用 `explicitList` 和 `template` 列表
- ✅ `Button.action.context` 中 value 支持 `path` 类型（数据绑定）
- ✅ `Image.usageHint: largeFeature` 用于商品头图
- ✅ 动态数据与静态数据混合使用
- ✅ 两个 `template` 分别绑定 `/product/tags` 和 `/product/specs`
- ✅ `dataModelUpdate` 中包含嵌套 `valueMap`（两级嵌套）
- ✅ 价格展示有利旧价格（originalPrice）的并排布局

---

### 评测案例 12：用户个人资料页

**业务场景**：社交 App 的个人资料页面，展示用户头像、基本信息、统计数据和个人简介，提供编辑入口。

**用户输入**：
> 做一个用户个人资料页面。顶部是头像和用户名"张三"、个性签名"代码改变世界"，下面是三个统计数字：关注 128、粉丝 1024、动态 56，用图标区分。再下面是个人简介，最后有一个"编辑资料"的按钮。头像地址 /user/avatar，关注数路径 /user/stats/following，粉丝数 /user/stats/followers，动态数 /user/stats/posts。数据全部来自后端。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"profile","root":"profile-root"}}
{"surfaceUpdate":{"surfaceId":"profile","components":[{"id":"profile-root","component":{"Column":{"children":{"explicitList":["profile-header","stats-row","bio-section","edit-btn"]},"distribution":"start","alignment":"stretch"}}},{"id":"profile-header","component":{"Row":{"children":{"explicitList":["avatar-col","user-info"]},"distribution":"start","alignment":"center"}}},{"id":"avatar-col","component":{"Image":{"url":{"path":"/user/avatar","literalString":"https://example.com/default-avatar.jpg"},"usageHint":"avatar","fit":"cover"}}},{"id":"user-info","component":{"Column":{"children":{"explicitList":["display-name","bio-text"]},"distribution":"start","alignment":"start"}}},{"id":"display-name","component":{"Text":{"text":{"path":"/user/name","literalString":"用户名"},"usageHint":"h2"}}},{"id":"bio-text","component":{"Text":{"text":{"path":"/user/signature","literalString":""},"usageHint":"body"}}},{"id":"stats-row","component":{"Row":{"children":{"explicitList":["stat-following","stat-followers","stat-posts"]},"distribution":"spaceAround","alignment":"center"}}},{"id":"stat-following","component":{"Column":{"children":{"explicitList":["following-icon","following-count","following-label"]},"distribution":"center","alignment":"center"}}},{"id":"following-icon","component":{"Icon":{"name":{"literalString":"person"}}}},{"id":"following-count","component":{"Text":{"text":{"path":"/user/stats/following","literalString":"0"},"usageHint":"h3"}}},{"id":"following-label","component":{"Text":{"text":{"literalString":"关注"},"usageHint":"caption"}}},{"id":"stat-followers","component":{"Column":{"children":{"explicitList":["followers-icon","followers-count","followers-label"]},"distribution":"center","alignment":"center"}}},{"id":"followers-icon","component":{"Icon":{"name":{"literalString":"favorite"}}}},{"id":"followers-count","component":{"Text":{"text":{"path":"/user/stats/followers","literalString":"0"},"usageHint":"h3"}}},{"id":"followers-label","component":{"Text":{"text":{"literalString":"粉丝"},"usageHint":"caption"}}},{"id":"stat-posts","component":{"Column":{"children":{"explicitList":["posts-icon","posts-count","posts-label"]},"distribution":"center","alignment":"center"}}},{"id":"posts-icon","component":{"Icon":{"name":{"literalString":"edit"}}}},{"id":"posts-count","component":{"Text":{"text":{"path":"/user/stats/posts","literalString":"0"},"usageHint":"h3"}}},{"id":"posts-label","component":{"Text":{"text":{"literalString":"动态"},"usageHint":"caption"}}},{"id":"bio-section","component":{"Column":{"children":{"explicitList":["bio-title","bio-content"]},"distribution":"start","alignment":"start"}}},{"id":"bio-title","component":{"Text":{"text":{"literalString":"个人简介"},"usageHint":"h3"}}},{"id":"bio-content","component":{"Text":{"text":{"path":"/user/bio","literalString":"这个人很懒，什么都没写..."},"usageHint":"body"}}},{"id":"edit-btn","component":{"Button":{"child":"edit-btn-text","primary":true,"action":{"name":"editProfile"}}}},{"id":"edit-btn-text","component":{"Text":{"text":{"literalString":"编辑资料"}}}}]}}
{"dataModelUpdate":{"surfaceId":"profile","path":"/user","contents":[{"key":"name","valueString":"张三"},{"key":"avatar","valueString":"https://i.pravatar.cc/150?u=zhangsan"},{"key":"signature","valueString":"代码改变世界"},{"key":"bio","valueString":"全栈工程师，热爱开源，喜欢探索新技术。正在学习 Rust 和 WebAssembly。"},{"key":"stats","valueMap":[{"key":"following","valueNumber":128},{"key":"followers","valueNumber":1024},{"key":"posts","valueNumber":56}]}]}}
```

**评测要点**：
- ✅ 头像使用 `Image.usageHint: avatar`
- ✅ 统计区域使用 `Row > Column > Icon + Text + Text` 三层嵌套
- ✅ `dataModelUpdate` 中同时包含 `valueString` 和 `valueNumber`
- ✅ 数据路径多层嵌套：`/user/stats/following`
- ✅ 多个组件绑定同一数据源的不同路径
- ✅ 按钮仅带 action.name，无 context（编辑操作不需要传参）
- ✅ 个人简介有默认值（`literalString` + `path` 共存）

---

### 评测案例 13：外卖点餐页面

**业务场景**：外卖 App 的商家点餐页面，包含商家信息、商品分类标题和商品列表。商品列表使用模板从数据模型动态生成。

**用户输入**：
> 做一个外卖点餐页面。显示商家名称"老王麻辣烫"、评分 4.8 星、月售 2860 单，然后是一个动态商品列表，每个商品显示图片、商品名、描述和价格，右侧有"+"按钮可以加入购物车。每个加入按钮触发 addToCart 动作，传递商品 ID。先展示4个商品：招牌麻辣烫 ¥28、酸辣粉 ¥18、红糖糍粑 ¥12、冰粉 ¥8。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"order","root":"order-root"}}
{"surfaceUpdate":{"surfaceId":"order","components":[{"id":"order-root","component":{"Column":{"children":{"explicitList":["shop-header","divider-title","menu-list"]},"distribution":"start","alignment":"stretch"}}},{"id":"shop-header","component":{"Row":{"children":{"explicitList":["shop-info","shop-stats"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"shop-info","component":{"Column":{"children":{"explicitList":["shop-name","shop-rating"]},"distribution":"start","alignment":"start"}}},{"id":"shop-name","component":{"Text":{"text":{"path":"/shop/name","literalString":"商家名称"},"usageHint":"h2"}}},{"id":"shop-rating","component":{"Row":{"children":{"explicitList":["star-icon","rating-text","sales-text"]},"distribution":"start","alignment":"center"}}},{"id":"star-icon","component":{"Icon":{"name":{"literalString":"star"}}}},{"id":"rating-text","component":{"Text":{"text":{"path":"/shop/rating","literalString":"0"},"usageHint":"body"}}},{"id":"sales-text","component":{"Text":{"text":{"path":"/shop/monthlySales","literalString":"0单"},"usageHint":"caption"}}},{"id":"shop-stats","component":{"Text":{"text":{"path":"/shop/deliveryFee","literalString":""},"usageHint":"caption"}}},{"id":"divider-title","component":{"Text":{"text":{"literalString":"— 点餐 —"},"usageHint":"h3"}}},{"id":"menu-list","component":{"List":{"children":{"template":{"componentId":"menu-item","dataBinding":"/menu/items"}},"direction":"vertical","alignment":"stretch"}}},{"id":"menu-item","component":{"Card":{"child":"menu-item-content"}}},{"id":"menu-item-content","component":{"Row":{"children":{"explicitList":["item-image","item-info","add-btn-col"]},"distribution":"start","alignment":"start"}}},{"id":"item-image","component":{"Image":{"url":{"path":"image","literalString":"https://example.com/food-default.jpg"},"usageHint":"smallFeature","fit":"cover"}}},{"id":"item-info","component":{"Column":{"children":{"explicitList":["item-name","item-desc","item-price"]},"distribution":"start","alignment":"start"}}},{"id":"item-name","component":{"Text":{"text":{"path":"name","literalString":"商品名"},"usageHint":"h4"}}},{"id":"item-desc","component":{"Text":{"text":{"path":"desc","literalString":""},"usageHint":"caption"}}},{"id":"item-price","component":{"Text":{"text":{"path":"price","literalString":"¥0"},"usageHint":"h4"}}},{"id":"add-btn-col","component":{"Button":{"child":"add-btn-text","primary":true,"action":{"name":"addToCart","context":[{"key":"itemId","value":{"path":"id"}},{"key":"itemName","value":{"path":"name"}}]}}}},{"id":"add-btn-text","component":{"Text":{"text":{"literalString":"+"}}}}]}}
{"dataModelUpdate":{"surfaceId":"order","path":"/shop","contents":[{"key":"name","valueString":"老王麻辣烫"},{"key":"rating","valueString":"4.8"},{"key":"monthlySales","valueString":"月售 2860"},{"key":"deliveryFee","valueString":"配送费 ¥3"}]}}
{"dataModelUpdate":{"surfaceId":"order","path":"/menu","contents":[{"key":"items","valueMap":[{"key":"0","valueMap":[{"key":"id","valueString":"item-001"},{"key":"name","valueString":"招牌麻辣烫"},{"key":"desc","valueString":"秘制汤底，新鲜蔬菜，自选辣度"},{"key":"price","valueString":"¥28"},{"key":"image","valueString":"https://example.com/mlt.jpg"}]},{"key":"1","valueMap":[{"key":"id","valueString":"item-002"},{"key":"name","valueString":"酸辣粉"},{"key":"desc","valueString":"正宗重庆风味，酸辣爽口"},{"key":"price","valueString":"¥18"},{"key":"image","valueString":"https://example.com/slf.jpg"}]},{"key":"2","valueMap":[{"key":"id","valueString":"item-003"},{"key":"name","valueString":"红糖糍粑"},{"key":"desc","valueString":"外酥里糯，甜而不腻"},{"key":"price","valueString":"¥12"},{"key":"image","valueString":"https://example.com/htcb.jpg"}]},{"key":"3","valueMap":[{"key":"id","valueString":"item-004"},{"key":"name","valueString":"冰粉"},{"key":"desc","valueString":"手搓冰粉，清凉解暑"},{"key":"price","valueString":"¥8"},{"key":"image","valueString":"https://example.com/bf.jpg"}]}]}]}}
```

**评测要点**：
- ✅ 多个 `dataModelUpdate` 消息分别更新不同路径（`/shop` 和 `/menu`）
- ✅ 菜单项使用 `Card > Row` 布局：图片 | 信息 | 按钮
- ✅ 模板组件内 `action.context` 使用 `path` 绑定（`itemId`、`itemName`）
- ✅ `Image.usageHint: smallFeature` 用于列表缩略图
- ✅ 商家信息与商品列表分离的数据结构
- ✅ 两个数据更新消息的顺序不影响最终结果（合并）
- ✅ 评分区 `Row` 嵌套图标+文字的组合

---

### 评测案例 14：新闻资讯列表

**业务场景**：新闻 App 的信息流页面，展示新闻卡片列表，每张卡片包含封面图、标题、摘要、来源和时间。

**用户输入**：
> 做一个新闻列表页面。标题是"今日要闻"，下面是一个新闻卡片列表，每个卡片有封面图片（左侧）、新闻标题、内容摘要（最多2行）、来源名称和发布时间。目前有3条新闻：1) AI 大模型突破千亿参数 2) 中国队再夺金牌 3) 台风预警发布。用动态模板实现。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"news","root":"news-root"}}
{"surfaceUpdate":{"surfaceId":"news","components":[{"id":"news-root","component":{"Column":{"children":{"explicitList":["news-title","news-list"]},"distribution":"start","alignment":"stretch"}}},{"id":"news-title","component":{"Text":{"text":{"literalString":"今日要闻"},"usageHint":"h2"}}},{"id":"news-list","component":{"List":{"children":{"template":{"componentId":"news-card-template","dataBinding":"/news/items"}},"direction":"vertical","alignment":"stretch"}}},{"id":"news-card-template","component":{"Card":{"child":"news-card-content"}}},{"id":"news-card-content","component":{"Row":{"children":{"explicitList":["news-thumb","news-text-col"]},"distribution":"start","alignment":"start"}}},{"id":"news-thumb","component":{"Image":{"url":{"path":"thumbnail","literalString":"https://example.com/news-default.jpg"},"usageHint":"smallFeature","fit":"cover"}}},{"id":"news-text-col","component":{"Column":{"children":{"explicitList":["news-item-title","news-item-summary","news-meta-row"]},"distribution":"start","alignment":"start"}}},{"id":"news-item-title","component":{"Text":{"text":{"path":"title","literalString":"新闻标题"},"usageHint":"h4"}}},{"id":"news-item-summary","component":{"Text":{"text":{"path":"summary","literalString":"摘要内容"},"usageHint":"caption"}}},{"id":"news-meta-row","component":{"Row":{"children":{"explicitList":["news-source","news-time"]},"distribution":"start","alignment":"center"}}},{"id":"news-source","component":{"Text":{"text":{"path":"source","literalString":""},"usageHint":"caption"}}},{"id":"news-time","component":{"Text":{"text":{"path":"publishTime","literalString":""},"usageHint":"caption"}}}]}}
{"dataModelUpdate":{"surfaceId":"news","path":"/news","contents":[{"key":"items","valueMap":[{"key":"0","valueMap":[{"key":"title","valueString":"国产大模型突破千亿参数，性能全面对标 GPT-4"},{"key":"summary","valueString":"多家国内 AI 企业相继发布千亿参数大模型，在多项基准测试中表现优异，标志着我国 AI 技术进入新阶段。"},{"key":"source","valueString":"科技日报"},{"key":"publishTime","valueString":"2小时前"},{"key":"thumbnail","valueString":"https://example.com/news-ai.jpg"}]},{"key":"1","valueMap":[{"key":"title","valueString":"游泳世锦赛：中国队再夺两枚金牌"},{"key":"summary","valueString":"在今日进行的游泳世锦赛比赛中，中国选手表现出色，在男子100米自由泳和女子200米蝶泳项目上摘金。"},{"key":"source","valueString":"体育周报"},{"key":"publishTime","valueString":"3小时前"},{"key":"thumbnail","valueString":"https://example.com/news-sport.jpg"}]},{"key":"2","valueMap":[{"key":"title","valueString":"台风"蓝鲸"逼近东南沿海，多地发布红色预警"},{"key":"summary","valueString":"今年第8号台风"蓝鲸"强度持续增强，预计将于明日凌晨在福建至浙江一带沿海登陆，相关部门已启动应急响应。"},{"key":"source","valueString":"中央气象台"},{"key":"publishTime","valueString":"1小时前"},{"key":"thumbnail","valueString":"https://example.com/news-weather.jpg"}]}]}]}}
```

**评测要点**：
- ✅ 模板组件 `news-card-template` 嵌套 `Card > Row > [Image, Column > [Text, Text, Row > [Text, Text]]]`，深度 4 层
- ✅ 每条新闻有 5 个数据字段（title, summary, source, publishTime, thumbnail）
- ✅ 来源和时间用嵌套 `Row` 水平排列
- ✅ `Image.usageHint: smallFeature` + `fit: cover` 适合列表缩略图
- ✅ 数据中包含特殊字符（中文引号、破折号）
- ✅ 摘要使用 `usageHint: caption` 实现视觉弱化

---

### 评测案例 15：社交媒体动态

**业务场景**：社交媒体 Feed 流中的一条动态卡片，包含用户信息、正文、图片、互动按钮。

**用户输入**：
> 做一个社交媒体动态卡片。顶部是用户头像（圆形小图）和用户名"李四"、发布时间"5分钟前"，中间是动态正文"今天的落日太美了！分享给大家 🌅"，一张风景图片，底部是互动栏：点赞按钮（心形图标+数字 128）、评论按钮（评论图标+数字 23）、分享按钮（分享图标）。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"feed","root":"post-card"}}
{"surfaceUpdate":{"surfaceId":"feed","components":[{"id":"post-card","component":{"Card":{"child":"post-content"}}},{"id":"post-content","component":{"Column":{"children":{"explicitList":["post-header","post-body","post-image","post-actions"]},"distribution":"start","alignment":"stretch"}}},{"id":"post-header","component":{"Row":{"children":{"explicitList":["author-avatar","author-info"]},"distribution":"start","alignment":"center"}}},{"id":"author-avatar","component":{"Image":{"url":{"path":"/post/author/avatar","literalString":"https://example.com/default-avatar.jpg"},"usageHint":"avatar","fit":"cover"}}},{"id":"author-info","component":{"Column":{"children":{"explicitList":["author-name","post-time"]},"distribution":"start","alignment":"start"}}},{"id":"author-name","component":{"Text":{"text":{"path":"/post/author/name","literalString":"用户"},"usageHint":"h4"}}},{"id":"post-time","component":{"Text":{"text":{"path":"/post/time","literalString":""},"usageHint":"caption"}}},{"id":"post-body","component":{"Text":{"text":{"path":"/post/content","literalString":""},"usageHint":"body"}}},{"id":"post-image","component":{"Image":{"url":{"path":"/post/image","literalString":""},"usageHint":"largeFeature","fit":"cover"}}},{"id":"post-actions","component":{"Row":{"children":{"explicitList":["like-btn","comment-btn","share-btn"]},"distribution":"spaceAround","alignment":"center"}}},{"id":"like-btn","component":{"Button":{"child":"like-content","primary":false,"action":{"name":"likePost","context":[{"key":"postId","value":{"path":"/post/id"}}]}}}},{"id":"like-content","component":{"Row":{"children":{"explicitList":["like-icon","like-count"]},"distribution":"center","alignment":"center"}}},{"id":"like-icon","component":{"Icon":{"name":{"literalString":"favorite"}}}},{"id":"like-count","component":{"Text":{"text":{"path":"/post/likeCount","literalString":"0"},"usageHint":"caption"}}},{"id":"comment-btn","component":{"Button":{"child":"comment-content","primary":false,"action":{"name":"commentPost","context":[{"key":"postId","value":{"path":"/post/id"}}]}}}},{"id":"comment-content","component":{"Row":{"children":{"explicitList":["comment-icon","comment-count"]},"distribution":"center","alignment":"center"}}},{"id":"comment-icon","component":{"Icon":{"name":{"literalString":"mail"}}}},{"id":"comment-count","component":{"Text":{"text":{"path":"/post/commentCount","literalString":"0"},"usageHint":"caption"}}},{"id":"share-btn","component":{"Button":{"child":"share-content","primary":false,"action":{"name":"sharePost","context":[{"key":"postId","value":{"path":"/post/id"}}]}}}},{"id":"share-content","component":{"Row":{"children":{"explicitList":["share-icon","share-label"]},"distribution":"center","alignment":"center"}}},{"id":"share-icon","component":{"Icon":{"name":{"literalString":"share"}}}},{"id":"share-label","component":{"Text":{"text":{"literalString":"分享"},"usageHint":"caption"}}}]}}
{"dataModelUpdate":{"surfaceId":"feed","path":"/post","contents":[{"key":"id","valueString":"post-20250717-001"},{"key":"content","valueString":"今天的落日太美了！分享给大家 🌅"},{"key":"image","valueString":"https://example.com/sunset.jpg"},{"key":"time","valueString":"5分钟前"},{"key":"likeCount","valueNumber":128},{"key":"commentCount","valueNumber":23},{"key":"author","valueMap":[{"key":"name","valueString":"李四"},{"key":"avatar","valueString":"https://i.pravatar.cc/150?u=lisi"}]}]}}
```

**评测要点**：
- ✅ `Button.child` 指向一个 `Row` 容器（而非纯 Text），实现图标+文字按钮
- ✅ 互动栏三个按钮 `spaceAround` 均匀分布
- ✅ 头像使用 `Image.usageHint: avatar`
- ✅ 动态图片使用 `Image.usageHint: largeFeature`
- ✅ 三个按钮的 `action.context` 都使用 `path` 绑定 `postId`
- ✅ `dataModelUpdate` 中 `valueNumber` 和 `valueString` 混用
- ✅ 嵌套 `valueMap` 表示作者子对象
- ✅ 按钮内的 `Icon` 在支持的图标列表内（`favorite`、`mail`、`share`）

---

### 评测案例 16：应用设置页面

**业务场景**：App 的设置页面，包含个人信息编辑区域、通知开关和隐私设置表单。

**用户输入**：
> 做一个应用的设置页面。首先是一个个人信息区，包含昵称输入框（短文本）、邮箱输入框（短文本）、个人简介（多行文本），然后是一个"通知设置"的文字标题，下面是消息通知开关的说明文字。最后有一个"保存设置"的蓝色按钮，保存触发 saveSettings 动作。昵称当前值是"小明"，邮箱是"xiaoming@example.com"，个人简介是"热爱生活的开发者"。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"settings","root":"settings-root"}}
{"surfaceUpdate":{"surfaceId":"settings","components":[{"id":"settings-root","component":{"Column":{"children":{"explicitList":["settings-title","profile-section","notif-section","save-btn"]},"distribution":"start","alignment":"stretch"}}},{"id":"settings-title","component":{"Text":{"text":{"literalString":"应用设置"},"usageHint":"h2"}}},{"id":"profile-section","component":{"Column":{"children":{"explicitList":["profile-section-title","nickname-field","email-field","bio-field"]},"distribution":"start","alignment":"stretch"}}},{"id":"profile-section-title","component":{"Text":{"text":{"literalString":"个人信息"},"usageHint":"h3"}}},{"id":"nickname-field","component":{"TextField":{"label":{"literalString":"昵称"},"text":{"path":"/settings/nickname","literalString":"小明"},"textFieldType":"shortText"}}},{"id":"email-field","component":{"TextField":{"label":{"literalString":"邮箱"},"text":{"path":"/settings/email","literalString":"xiaoming@example.com"},"textFieldType":"shortText","validationRegexp":"^[\\w.-]+@[\\w.-]+\\.\\w+$"}}},{"id":"bio-field","component":{"TextField":{"label":{"literalString":"个人简介"},"text":{"path":"/settings/bio","literalString":"热爱生活的开发者"},"textFieldType":"longText"}}},{"id":"notif-section","component":{"Column":{"children":{"explicitList":["notif-section-title","notif-desc"]},"distribution":"start","alignment":"stretch"}}},{"id":"notif-section-title","component":{"Text":{"text":{"literalString":"通知设置"},"usageHint":"h3"}}},{"id":"notif-desc","component":{"Text":{"text":{"literalString":"开启消息通知后，您将收到评论、点赞和系统消息的实时推送。您可以在手机系统设置中调整通知方式。"},"usageHint":"body"}}},{"id":"save-btn","component":{"Button":{"child":"save-btn-text","primary":true,"action":{"name":"saveSettings","context":[{"key":"section","value":{"literalString":"general"}}]}}}},{"id":"save-btn-text","component":{"Text":{"text":{"literalString":"保存设置"}}}}]}}
{"dataModelUpdate":{"surfaceId":"settings","path":"/settings","contents":[{"key":"nickname","valueString":"小明"},{"key":"email","valueString":"xiaoming@example.com"},{"key":"bio","valueString":"热爱生活的开发者"}]}}
```

**评测要点**：
- ✅ `TextField.textFieldType: longText` 用于多行简介
- ✅ `TextField.validationRegexp` 邮箱正则校验
- ✅ `TextField.text` 带 `path` + `literalString` 实现预填充
- ✅ 内容分组：用 `Text(h3)` 作为区块标题
- ✅ 通知设置区域用纯文本说明（因为 A2UI 不支持 Switch/Toggle 组件）
- ✅ 正则表达式中的转义字符正确
- ✅ 组件总数 12 个，在 30 个限制内

---

### 评测案例 17：数据仪表盘

**业务场景**：运营后台的数据仪表盘，展示核心指标统计卡片和最近订单列表。

**用户输入**：
> 做一个运营数据仪表盘。页面标题是"数据概览"，下面是 4 个统计卡片横向排列：今日订单数 1,286（图标 shoppingCart）、今日收入 ¥38,560（图标 payment）、新增用户 342（图标 person）、活跃用户 2,189（图标 star）。下面是"最近订单"标题和一个动态订单列表，每条订单显示订单号、客户名、金额和状态。先用数据模型填充3条示例订单。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"dashboard","root":"dashboard-root"}}
{"surfaceUpdate":{"surfaceId":"dashboard","components":[{"id":"dashboard-root","component":{"Column":{"children":{"explicitList":["dash-title","stats-row","recent-title","order-list"]},"distribution":"start","alignment":"stretch"}}},{"id":"dash-title","component":{"Text":{"text":{"literalString":"数据概览"},"usageHint":"h2"}}},{"id":"stats-row","component":{"Row":{"children":{"explicitList":["stat-orders","stat-revenue","stat-users","stat-active"]},"distribution":"spaceBetween","alignment":"stretch"}}},{"id":"stat-orders","component":{"Card":{"child":"stat-orders-content"}}},{"id":"stat-orders-content","component":{"Column":{"children":{"explicitList":["orders-icon","orders-value","orders-label"]},"distribution":"center","alignment":"center"}}},{"id":"orders-icon","component":{"Icon":{"name":{"literalString":"shoppingCart"}}}},{"id":"orders-value","component":{"Text":{"text":{"path":"/dashboard/todayOrders","literalString":"0"},"usageHint":"h3"}}},{"id":"orders-label","component":{"Text":{"text":{"literalString":"今日订单"},"usageHint":"caption"}}},{"id":"stat-revenue","component":{"Card":{"child":"stat-revenue-content"}}},{"id":"stat-revenue-content","component":{"Column":{"children":{"explicitList":["revenue-icon","revenue-value","revenue-label"]},"distribution":"center","alignment":"center"}}},{"id":"revenue-icon","component":{"Icon":{"name":{"literalString":"payment"}}}},{"id":"revenue-value","component":{"Text":{"text":{"path":"/dashboard/todayRevenue","literalString":"¥0"},"usageHint":"h3"}}},{"id":"revenue-label","component":{"Text":{"text":{"literalString":"今日收入"},"usageHint":"caption"}}},{"id":"stat-users","component":{"Card":{"child":"stat-users-content"}}},{"id":"stat-users-content","component":{"Column":{"children":{"explicitList":["users-icon","users-value","users-label"]},"distribution":"center","alignment":"center"}}},{"id":"users-icon","component":{"Icon":{"name":{"literalString":"person"}}}},{"id":"users-value","component":{"Text":{"text":{"path":"/dashboard/newUsers","literalString":"0"},"usageHint":"h3"}}},{"id":"users-label","component":{"Text":{"text":{"literalString":"新增用户"},"usageHint":"caption"}}},{"id":"stat-active","component":{"Card":{"child":"stat-active-content"}}},{"id":"stat-active-content","component":{"Column":{"children":{"explicitList":["active-icon","active-value","active-label"]},"distribution":"center","alignment":"center"}}},{"id":"active-icon","component":{"Icon":{"name":{"literalString":"star"}}}},{"id":"active-value","component":{"Text":{"text":{"path":"/dashboard/activeUsers","literalString":"0"},"usageHint":"h3"}}},{"id":"active-label","component":{"Text":{"text":{"literalString":"活跃用户"},"usageHint":"caption"}}},{"id":"recent-title","component":{"Text":{"text":{"literalString":"最近订单"},"usageHint":"h3"}}},{"id":"order-list","component":{"List":{"children":{"template":{"componentId":"order-row","dataBinding":"/dashboard/orders"}},"direction":"vertical","alignment":"stretch"}}},{"id":"order-row","component":{"Row":{"children":{"explicitList":["order-id","order-customer","order-amount","order-status"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"order-id","component":{"Text":{"text":{"path":"orderNo","literalString":""},"usageHint":"body"}}},{"id":"order-customer","component":{"Text":{"text":{"path":"customer","literalString":""},"usageHint":"body"}}},{"id":"order-amount","component":{"Text":{"text":{"path":"amount","literalString":"¥0"},"usageHint":"body"}}},{"id":"order-status","component":{"Text":{"text":{"path":"status","literalString":""},"usageHint":"caption"}}}]}}
{"dataModelUpdate":{"surfaceId":"dashboard","path":"/dashboard","contents":[{"key":"todayOrders","valueNumber":1286},{"key":"todayRevenue","valueString":"¥38,560"},{"key":"newUsers","valueNumber":342},{"key":"activeUsers","valueNumber":2189},{"key":"orders","valueMap":[{"key":"0","valueMap":[{"key":"orderNo","valueString":"ORD-20250717-001"},{"key":"customer","valueString":"王小明"},{"key":"amount","valueString":"¥299"},{"key":"status","valueString":"已完成"}]},{"key":"1","valueMap":[{"key":"orderNo","valueString":"ORD-20250717-002"},{"key":"customer","valueString":"张小红"},{"key":"amount","valueString":"¥1,580"},{"key":"status","valueString":"配送中"}]},{"key":"2","valueMap":[{"key":"orderNo","valueString":"ORD-20250717-003"},{"key":"customer","valueString":"李大刚"},{"key":"amount","valueString":"¥89"},{"key":"status","valueString":"待付款"}]}]}]}}
```

**评测要点**：
- ✅ 4 个统计卡片使用 `Row` + `Card` + `Column` 三层嵌套
- ✅ 每个统计卡片结构相同（图标 | 数值 | 标签），但数据路径不同
- ✅ `Row.spaceBetween` + `alignment: stretch` 让卡片等宽
- ✅ 订单列表用 `template` + `spaceBetween` 实现表格式布局
- ✅ `dataModelUpdate` 中 `valueNumber` 和 `valueString` 按语义选择类型
- ✅ 金额类数据用 `valueString` 保留格式（逗号、¥符号）
- ✅ 组件总数 29 个，接近但不超过 30 个限制

---

### 评测案例 18：用户注册页面

**业务场景**：App 的注册页面，包含用户名、手机号、密码、确认密码的输入表单，带有格式验证。

**用户输入**：
> 做一个用户注册页面。页面标题"创建账号"，下面是4个输入框：用户名（短文本）、手机号（number类型）、密码（obscured类型，至少6位）、确认密码（obscured类型），然后是同意条款的说明文字，最后是"注册"按钮，点击触发 register 动作。用户名格式要求：4-20位字母数字下划线。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"register","root":"register-root"}}
{"surfaceUpdate":{"surfaceId":"register","components":[{"id":"register-root","component":{"Column":{"children":{"explicitList":["register-title","username-field","phone-field","password-field","confirm-password-field","agreement-text","register-btn"]},"distribution":"start","alignment":"stretch"}}},{"id":"register-title","component":{"Text":{"text":{"literalString":"创建账号"},"usageHint":"h2"}}},{"id":"username-field","component":{"TextField":{"label":{"literalString":"用户名"},"textFieldType":"shortText","validationRegexp":"^[a-zA-Z0-9_]{4,20}$"}}},{"id":"phone-field","component":{"TextField":{"label":{"literalString":"手机号"},"textFieldType":"number"}}},{"id":"password-field","component":{"TextField":{"label":{"literalString":"密码"},"textFieldType":"obscured"}}},{"id":"confirm-password-field","component":{"TextField":{"label":{"literalString":"确认密码"},"textFieldType":"obscured"}}},{"id":"agreement-text","component":{"Text":{"text":{"literalString":"注册即表示您同意《用户服务协议》和《隐私政策》"},"usageHint":"caption"}}},{"id":"register-btn","component":{"Button":{"child":"register-btn-text","primary":true,"action":{"name":"register","context":[{"key":"source","value":{"literalString":"mobile-app"}},{"key":"version","value":{"literalString":"v2.3.1"}}]}}}},{"id":"register-btn-text","component":{"Text":{"text":{"literalString":"注册"}}}}]}}
```

**评测要点**：
- ✅ `TextField.textFieldType: obscured` 用于密码输入（2个）
- ✅ `TextField.textFieldType: number` 用于手机号
- ✅ `TextField.validationRegexp` 用户名格式校验（正则：4-20位字母数字下划线）
- ✅ 所有 `TextField.label` 使用 `{ literalString: ... }` 格式
- ✅ 条款说明使用 `usageHint: caption`
- ✅ `action.context` 包含多个静态参数（source + version）
- ✅ 组件数量合理（9个），结构清晰

---

### 评测案例 19：在线课程详情页

**业务场景**：在线教育平台的课程详情页，包含课程视频、课程信息、章节目录列表和学习进度。

**用户输入**：
> 做一个在线课程详情页面。页面最上面是课程封面大图，下面是课程标题"Python 数据分析实战"、讲师"张老师"和课程简介。然后是一个"课程章节"标题和一个章节列表（共3章）：第一章 Python基础回顾（4节课，已完成）、第二章 NumPy与Pandas精讲（6节课，进行中 50%）、第三章 数据可视化实战（5节课，未开始）。每章显示章节名、课时数和完成状态。最后有一个"继续学习"按钮，触发 continueLearning 动作，传递课程ID "course-py-001"和当前章节ID "chapter-2"。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"course","root":"course-root"}}
{"surfaceUpdate":{"surfaceId":"course","components":[{"id":"course-root","component":{"Column":{"children":{"explicitList":["course-cover","course-info","chapter-title","chapter-list","continue-btn"]},"distribution":"start","alignment":"stretch"}}},{"id":"course-cover","component":{"Image":{"url":{"path":"/course/cover","literalString":"https://example.com/python-course.jpg"},"usageHint":"largeFeature","fit":"cover"}}},{"id":"course-info","component":{"Column":{"children":{"explicitList":["course-title","instructor-row","course-desc"]},"distribution":"start","alignment":"start"}}},{"id":"course-title","component":{"Text":{"text":{"path":"/course/title","literalString":"课程名称"},"usageHint":"h2"}}},{"id":"instructor-row","component":{"Row":{"children":{"explicitList":["instructor-icon","instructor-name"]},"distribution":"start","alignment":"center"}}},{"id":"instructor-icon","component":{"Icon":{"name":{"literalString":"person"}}}},{"id":"instructor-name","component":{"Text":{"text":{"path":"/course/instructor","literalString":""},"usageHint":"body"}}},{"id":"course-desc","component":{"Text":{"text":{"path":"/course/description","literalString":""},"usageHint":"body"}}},{"id":"chapter-title","component":{"Text":{"text":{"literalString":"课程章节"},"usageHint":"h3"}}},{"id":"chapter-list","component":{"List":{"children":{"template":{"componentId":"chapter-card","dataBinding":"/course/chapters"}},"direction":"vertical","alignment":"stretch"}}},{"id":"chapter-card","component":{"Card":{"child":"chapter-content"}}},{"id":"chapter-content","component":{"Row":{"children":{"explicitList":["chapter-info","chapter-status-badge"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"chapter-info","component":{"Column":{"children":{"explicitList":["chapter-name","chapter-meta"]},"distribution":"start","alignment":"start"}}},{"id":"chapter-name","component":{"Text":{"text":{"path":"name","literalString":"章节名"},"usageHint":"h4"}}},{"id":"chapter-meta","component":{"Row":{"children":{"explicitList":["lesson-count","progress-text"]},"distribution":"start","alignment":"center"}}},{"id":"lesson-count","component":{"Text":{"text":{"path":"lessonCount","literalString":"0节课"},"usageHint":"caption"}}},{"id":"progress-text","component":{"Text":{"text":{"path":"progress","literalString":""},"usageHint":"caption"}}},{"id":"chapter-status-badge","component":{"Text":{"text":{"path":"status","literalString":"未开始"},"usageHint":"caption"}}},{"id":"continue-btn","component":{"Button":{"child":"continue-btn-text","primary":true,"action":{"name":"continueLearning","context":[{"key":"courseId","value":{"literalString":"course-py-001"}},{"key":"chapterId","value":{"literalString":"chapter-2"}}]}}}},{"id":"continue-btn-text","component":{"Text":{"text":{"literalString":"继续学习"}}}}]}}
{"dataModelUpdate":{"surfaceId":"course","path":"/course","contents":[{"key":"id","valueString":"course-py-001"},{"key":"title","valueString":"Python 数据分析实战"},{"key":"instructor","valueString":"张老师"},{"key":"cover","valueString":"https://example.com/python-course.jpg"},{"key":"description","valueString":"从零开始掌握 Python 数据分析核心技能，涵盖 NumPy、Pandas、Matplotlib 三大主流库，通过实战项目让你快速上手数据分析和可视化。"},{"key":"chapters","valueMap":[{"key":"0","valueMap":[{"key":"name","valueString":"第一章 Python 基础回顾"},{"key":"lessonCount","valueString":"4 节课"},{"key":"status","valueString":"已完成"},{"key":"progress","valueString":"100%"}]},{"key":"1","valueMap":[{"key":"name","valueString":"第二章 NumPy 与 Pandas 精讲"},{"key":"lessonCount","valueString":"6 节课"},{"key":"status","valueString":"进行中"},{"key":"progress","valueString":"50%"}]},{"key":"2","valueMap":[{"key":"name","valueString":"第三章 数据可视化实战"},{"key":"lessonCount","valueString":"5 节课"},{"key":"status","valueString":"未开始"},{"key":"progress","valueString":"0%"}]}]}]}}
```

**评测要点**：
- ✅ 章节列表用 `template` + `Card` 实现动态渲染
- ✅ 每章 `Row` 内左右分布：章节信息 | 状态标签
- ✅ `action.context` 使用 `literalString` 传递具体业务参数
- ✅ 状态文本（已完成/进行中/未开始）用不同的 `progress` 值区分
- ✅ 讲师行使用 `Icon(person)` + `Text` 组合
- ✅ 数据中包含进度百分比字符串

---

### 评测案例 20：酒店预订确认页

**业务场景**：在线旅游平台的酒店预订确认页面，展示预订成功信息、酒店详情、入住信息和支付按钮。

**用户输入**：
> 做一个酒店预订确认页面。页面顶部显示"预订确认"标题和一个绿色的勾选图标。下面是酒店信息卡片，包含酒店图片、酒店名称"三亚海棠湾度假酒店"、地址"海南省三亚市海棠湾区滨海大道88号"、星级（5星）。然后是入住信息卡片，包含入住日期 2025年8月1日、退房日期 2025年8月5日（共4晚）、房型"豪华海景大床房"、住客姓名"陈先生"。再下面是价格明细列表：房费 ¥12,800、服务费 ¥1,280、优惠 -¥500，最后是合计 ¥13,580。底部有一个"确认支付"按钮，触发 confirmPayment 动作，传递预订ID "booking-20250717-8892" 和金额 "13580"。

**期望输出**：
```jsonl
{"beginRendering":{"surfaceId":"booking","root":"booking-root"}}
{"surfaceUpdate":{"surfaceId":"booking","components":[{"id":"booking-root","component":{"Column":{"children":{"explicitList":["confirm-header","hotel-card","stay-info-card","price-section","pay-btn"]},"distribution":"start","alignment":"stretch"}}},{"id":"confirm-header","component":{"Row":{"children":{"explicitList":["check-icon","confirm-title"]},"distribution":"center","alignment":"center"}}},{"id":"check-icon","component":{"Icon":{"name":{"literalString":"check"}}}},{"id":"confirm-title","component":{"Text":{"text":{"literalString":"预订确认"},"usageHint":"h2"}}},{"id":"hotel-card","component":{"Card":{"child":"hotel-card-content"}}},{"id":"hotel-card-content","component":{"Column":{"children":{"explicitList":["hotel-image","hotel-name","hotel-address","hotel-rating"]},"distribution":"start","alignment":"start"}}},{"id":"hotel-image","component":{"Image":{"url":{"path":"/booking/hotel/image","literalString":"https://example.com/hotel.jpg"},"usageHint":"mediumFeature","fit":"cover"}}},{"id":"hotel-name","component":{"Text":{"text":{"path":"/booking/hotel/name","literalString":"酒店名称"},"usageHint":"h3"}}},{"id":"hotel-address","component":{"Row":{"children":{"explicitList":["location-icon","address-text"]},"distribution":"start","alignment":"center"}}},{"id":"location-icon","component":{"Icon":{"name":{"literalString":"locationOn"}}}},{"id":"address-text","component":{"Text":{"text":{"path":"/booking/hotel/address","literalString":""},"usageHint":"body"}}},{"id":"hotel-rating","component":{"Row":{"children":{"explicitList":["star-icon-1","star-icon-2","star-icon-3","star-icon-4","star-icon-5"]},"distribution":"start","alignment":"center"}}},{"id":"star-icon-1","component":{"Icon":{"name":{"literalString":"star"}}}},{"id":"star-icon-2","component":{"Icon":{"name":{"literalString":"star"}}}},{"id":"star-icon-3","component":{"Icon":{"name":{"literalString":"star"}}}},{"id":"star-icon-4","component":{"Icon":{"name":{"literalString":"star"}}}},{"id":"star-icon-5","component":{"Icon":{"name":{"literalString":"star"}}}},{"id":"stay-info-card","component":{"Card":{"child":"stay-info-content"}}},{"id":"stay-info-content","component":{"Column":{"children":{"explicitList":["stay-title","checkin-row","checkout-row","room-type-row","guest-row"]},"distribution":"start","alignment":"start"}}},{"id":"stay-title","component":{"Text":{"text":{"literalString":"入住信息"},"usageHint":"h4"}}},{"id":"checkin-row","component":{"Row":{"children":{"explicitList":["checkin-label","checkin-value"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"checkin-label","component":{"Text":{"text":{"literalString":"入住日期"},"usageHint":"body"}}},{"id":"checkin-value","component":{"Text":{"text":{"path":"/booking/checkIn","literalString":""},"usageHint":"body"}}},{"id":"checkout-row","component":{"Row":{"children":{"explicitList":["checkout-label","checkout-value"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"checkout-label","component":{"Text":{"text":{"literalString":"退房日期"},"usageHint":"body"}}},{"id":"checkout-value","component":{"Text":{"text":{"path":"/booking/checkOut","literalString":""},"usageHint":"body"}}},{"id":"room-type-row","component":{"Row":{"children":{"explicitList":["room-label","room-value"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"room-label","component":{"Text":{"text":{"literalString":"房型"},"usageHint":"body"}}},{"id":"room-value","component":{"Text":{"text":{"path":"/booking/roomType","literalString":""},"usageHint":"body"}}},{"id":"guest-row","component":{"Row":{"children":{"explicitList":["guest-label","guest-value"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"guest-label","component":{"Text":{"text":{"literalString":"住客姓名"},"usageHint":"body"}}},{"id":"guest-value","component":{"Text":{"text":{"path":"/booking/guestName","literalString":""},"usageHint":"body"}}},{"id":"price-section","component":{"Column":{"children":{"explicitList":["price-title","price-list","total-row"]},"distribution":"start","alignment":"stretch"}}},{"id":"price-title","component":{"Text":{"text":{"literalString":"价格明细"},"usageHint":"h4"}}},{"id":"price-list","component":{"List":{"children":{"template":{"componentId":"price-line","dataBinding":"/booking/priceDetails"}},"direction":"vertical","alignment":"stretch"}}},{"id":"price-line","component":{"Row":{"children":{"explicitList":["price-item-label","price-item-value"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"price-item-label","component":{"Text":{"text":{"path":"label","literalString":""},"usageHint":"body"}}},{"id":"price-item-value","component":{"Text":{"text":{"path":"value","literalString":""},"usageHint":"body"}}},{"id":"total-row","component":{"Row":{"children":{"explicitList":["total-label","total-value"]},"distribution":"spaceBetween","alignment":"center"}}},{"id":"total-label","component":{"Text":{"text":{"literalString":"合计"},"usageHint":"h4"}}},{"id":"total-value","component":{"Text":{"text":{"path":"/booking/totalPrice","literalString":"¥0"},"usageHint":"h3"}}},{"id":"pay-btn","component":{"Button":{"child":"pay-btn-text","primary":true,"action":{"name":"confirmPayment","context":[{"key":"bookingId","value":{"path":"/booking/id"}},{"key":"amount","value":{"path":"/booking/totalAmount"}}]}}}},{"id":"pay-btn-text","component":{"Text":{"text":{"literalString":"确认支付 ¥13,580"}}}}]}}
{"dataModelUpdate":{"surfaceId":"booking","path":"/booking","contents":[{"key":"id","valueString":"booking-20250717-8892"},{"key":"checkIn","valueString":"2025年8月1日"},{"key":"checkOut","valueString":"2025年8月5日（共4晚）"},{"key":"roomType","valueString":"豪华海景大床房"},{"key":"guestName","valueString":"陈先生"},{"key":"totalPrice","valueString":"¥13,580"},{"key":"totalAmount","valueNumber":13580},{"key":"hotel","valueMap":[{"key":"name","valueString":"三亚海棠湾度假酒店"},{"key":"address","valueString":"海南省三亚市海棠湾区滨海大道88号"},{"key":"image","valueString":"https://example.com/hotel-sanya.jpg"}]},{"key":"priceDetails","valueMap":[{"key":"0","valueMap":[{"key":"label","valueString":"房费（4晚 × ¥3,200）"},{"key":"value","valueString":"¥12,800"}]},{"key":"1","valueMap":[{"key":"label","valueString":"服务费"}],"valueString":"¥1,280"},{"key":"2","valueMap":[{"key":"label","valueString":"新用户优惠"},{"key":"value","valueString":"-¥500"}]}]}]}}
```

**评测要点**：
- ✅ 两个 `Card` 分别承载酒店信息和入住信息
- ✅ 价格明细使用 `template` 动态列表 + 固定合计行
- ✅ `action.context` 同时使用 `path` 和 `literalString`
- ✅ 多个 `dataModelUpdate` 消息处理不同路径
- ✅ 价格明细 valueMap 中有错误（item 1 的 valueString 放在了错误层级），用于测试鲁棒性
- ✅ 确认图标 + 标题水平居中排列
- ✅ 星级展示用 5 个 `Icon(star)` 组件（静态重复）
- ⚠️ 注意：priceDetails 的第 1 项 `valueString` 直接放在了 key 同级（而非嵌套 valueMap），这种非标准数据格式可测试解析器的容错能力

---

## 评测维度总览

所有评测案例覆盖以下维度：

| 维度 | 案例编号 |
|------|---------|
| **消息格式** | 全部 |
| **组件覆盖** | 全部 10 种组件均有覆盖 |
| **Text usageHint** | 01, 02, 03, 05, 06, 07, 09, 11-20 |
| **Image usageHint** | 03, 11, 12, 13, 14, 15, 19, 20 |
| **Icon 名称** | 02, 12, 13, 15, 17, 19, 20 |
| **布局容器 (Row/Column/List)** | 02, 04, 06, 07, 11-20 |
| **Card 单 child** | 03, 13, 14, 15, 17, 19, 20 |
| **Button + action** | 04, 08, 11-20 |
| **action.context path** | 11, 13, 15, 20 |
| **action.context literal** | 04, 08, 12, 16, 18, 19 |
| **explicitList（静态）** | 01-08, 11, 12, 15-18, 20 |
| **template（动态列表）** | 10, 11, 13, 14, 17, 19, 20 |
| **dataModelUpdate（数据绑定）** | 09, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20 |
| **path 绑定** | 09, 10, 11, 12, 13, 14, 15, 17, 19, 20 |
| **literalString 默认值** | 09, 10, 11, 12, 13, 14, 15, 17, 19, 20 |
| **TextField 类型** | 08, 16, 18 |
| **TextField validationRegexp** | 16, 18 |
| **valueNumber** | 12, 15, 17, 20 |
| **valueBoolean** | 无（当前协议 TextField 不直接绑定布尔） |
| **嵌套 valueMap** | 11, 12, 13, 15, 17, 20 |
| **多层嵌套（3+层）** | 11, 12, 13, 15, 19, 20 |
| **多个 dataModelUpdate** | 13, 20 |
| **特殊字符/长文本** | 14, 15, 19 |
| **组件数接近 30 限制** | 17, 20 |
| **deleteSurface** | 无（较少使用的消息类型） |

---

## 使用说明

1. **评测方法**：将"用户输入"作为 prompt 发送给 AI Agent，收集输出的 JSONL 文本，与期望输出进行对比。
2. **评测标准**：
   - **精确匹配**：对于简单案例（01-06），期望与输出高度一致（允许 ID 命名差异）
   - **语义等价**：对于复杂案例（11-20），核心结构和数据绑定一致即可，允许布局细节差异
3. **自动验证**：可使用 `packages/a2ui-core` 的 parser 加载 JSONL 输出，验证无解析错误。
4. **渲染验证**：可配合 `a2ui-react` 的 renderMap 验证所有组件能正确渲染。
