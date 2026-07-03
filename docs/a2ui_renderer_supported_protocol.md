# A2UI Renderer 当前支持的标准组件协议

本文档基于当前 React renderer 的实际实现（[packages/a2ui-react/src/components](../../packages/a2ui-react/src/components)）以及标准目录定义（[specification/v0_8/json/standard_catalog_definition.json](../json/standard_catalog_definition.json)），整理出当前 renderer 已支持的 A2UI 标准组件协议子集。

## 1. 支持范围总览

当前 renderer 已实现并可渲染以下组件：

- Text
- Image
- Icon
- Video
- Row
- Column
- List
- Button
- Card

当前未实现的标准组件：

- AudioPlayer
- Tabs
- Divider
- Modal
- CheckBox
- TextField
- DateTimeInput
- MultipleChoice
- Slider

## 2. 通用协议结构

当前 renderer 的运行时会把组件对象转换为 VNode，再由 renderer 进行分发。对外的标准协议形态可理解为：

```json
{
  "type": "Text",
  "props": {
    "text": {
      "literalString": "Hello"
    }
  }
}
```

其中：

- `type`：组件类型名
- `props`：组件的协议属性
- `componentId`：可选，运行时用于标识组件实例

## 3. 已支持组件协议

### 3.1 Text

用途：渲染纯文本内容。

```json
{
  "type": "Text",
  "props": {
    "text": {
      "literalString": "Hello A2UI"
    },
    "usageHint": "h1"
  }
}
```

支持字段：

- `text`（必填）
  - `literalString`：字符串字面量
  - `path`：绑定数据模型路径
- `usageHint`（可选）
  - `h1 | h2 | h3 | h4 | h5 | caption | body`

渲染行为：

- `h1` ~ `h5` 会按标题样式渲染
- `caption` 会显示为较小的灰色文本
- `body` 会按普通文本渲染

---

### 3.2 Image

用途：渲染图片。

```json
{
  "type": "Image",
  "props": {
    "url": {
      "literalString": "https://example.com/a.png"
    },
    "fit": "cover",
    "usageHint": "mediumFeature"
  }
}
```

支持字段：

- `url`（必填）
  - `literalString`
  - `path`
- `fit`（可选）
  - `contain | cover | fill | none | scale-down`
- `usageHint`（可选）
  - `icon | avatar | smallFeature | mediumFeature | largeFeature | header`

渲染行为：

- 通过 `<img>` 渲染
- `fit` 映射为 CSS 的 `object-fit`
- `usageHint` 会影响图片尺寸和圆角样式

---

### 3.3 Icon

用途：渲染图标。

```json
{
  "type": "Icon",
  "props": {
    "name": {
      "literalString": "search"
    }
  }
}
```

支持字段：

- `name`（必填）
  - `literalString`
  - `path`

当前实现支持的 `name.literalString` 值为标准协议中的枚举集合，包含：

- `accountCircle`
- `add`
- `arrowBack`
- `arrowForward`
- `attachFile`
- `calendarToday`
- `call`
- `camera`
- `check`
- `close`
- `delete`
- `download`
- `edit`
- `event`
- `error`
- `favorite`
- `favoriteOff`
- `folder`
- `help`
- `home`
- `info`
- `locationOn`
- `lock`
- `lockOpen`
- `mail`
- `menu`
- `moreVert`
- `moreHoriz`
- `notificationsOff`
- `notifications`
- `payment`
- `person`
- `phone`
- `photo`
- `print`
- `refresh`
- `search`
- `send`
- `settings`
- `share`
- `shoppingCart`
- `star`
- `starHalf`
- `starOff`
- `upload`
- `visibility`
- `visibilityOff`
- `warning`

---

### 3.4 Video

用途：渲染视频。

```json
{
  "type": "Video",
  "props": {
    "url": {
      "literalString": "https://example.com/video.mp4"
    }
  }
}
```

支持字段：

- `url`（必填）
  - `literalString`
  - `path`

渲染行为：

- 使用 `<video>` 标签渲染
- 默认打开控制栏

---

### 3.5 Row

用途：横向布局容器。

```json
{
  "type": "Row",
  "props": {
    "children": {
      "explicitList": ["childA", "childB"]
    },
    "distribution": "start",
    "alignment": "center"
  }
}
```

支持字段：

- `children`（必填）
  - `explicitList`：子组件 ID 数组
  - `template`：动态模板，当前实现通过 treeBuilder 解析后再渲染
- `distribution`（可选）
  - `start | center | end | spaceAround | spaceBetween | spaceEvenly`
- `alignment`（可选）
  - `start | center | end | stretch`

渲染行为：

- 使用 Flex 横向布局
- 支持子组件的递归渲染

---

### 3.6 Column

用途：纵向布局容器。

```json
{
  "type": "Column",
  "props": {
    "children": {
      "explicitList": ["childA", "childB"]
    },
    "distribution": "start",
    "alignment": "stretch"
  }
}
```

支持字段：

- `children`（必填）
  - `explicitList`
  - `template`
- `distribution`（可选）
  - `start | center | end | spaceAround | spaceBetween | spaceEvenly`
- `alignment`（可选）
  - `start | center | end | stretch`

渲染行为：

- 使用 Flex 纵向布局
- 支持子组件递归渲染

---

### 3.7 List

用途：列表布局容器。

```json
{
  "type": "List",
  "props": {
    "children": {
      "explicitList": ["item1", "item2"]
    },
    "direction": "vertical",
    "alignment": "start"
  }
}
```

支持字段：

- `children`（必填）
  - `explicitList`
  - `template`
- `direction`（可选）
  - `vertical | horizontal`
- `alignment`（可选）
  - `start | center | end | stretch`

渲染行为：

- 根据 `direction` 切换纵向或横向布局
- 子组件会依次渲染

---

### 3.8 Button

用途：按钮容器，通常包裹一个子组件。

```json
{
  "type": "Button",
  "props": {
    "child": "text-1",
    "primary": true,
    "action": {
      "name": "submit"
    }
  }
}
```

支持字段：

- `child`（必填）
  - 指向子组件 ID
- `primary`（可选）
  - `true | false`
- `action`（必填）
  - `name`：动作名
  - `context`：可选上下文参数

渲染行为：

- 渲染为 `<button>`
- 点击时会在控制台输出动作信息
- 当前实现为轻量级占位行为，不做完整事件总线联动

---

### 3.9 Card

用途：卡片容器，包裹一个子组件。

```json
{
  "type": "Card",
  "props": {
    "child": "content-1"
  }
}
```

支持字段：

- `child`（必填）
  - 指向子组件 ID

渲染行为：

- 渲染为带边框、圆角和阴影的卡片容器

## 4. 与标准目录的对应关系

当前实现支持的组件，基本对应标准目录中的以下组件：

- `Text`
- `Image`
- `Icon`
- `Video`
- `Row`
- `Column`
- `List`
- `Button`
- `Card`

与标准定义相比，当前 renderer 还没有实现以下组件：

- `AudioPlayer`
- `Tabs`
- `Divider`
- `Modal`
- `CheckBox`
- `TextField`
- `DateTimeInput`
- `MultipleChoice`
- `Slider`

## 5. 实际使用建议

若要与当前 renderer 对齐，建议在协议生成阶段优先输出以下结构：

- 先用 `Text / Image / Icon / Video` 作为基础内容组件
- 用 `Row / Column / List` 作为布局组件
- 用 `Button / Card` 作为交互或卡片容器
- 避免直接依赖当前未实现的高级组件类型
