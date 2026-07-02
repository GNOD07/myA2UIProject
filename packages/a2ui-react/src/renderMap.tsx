import type { RenderMap } from "@a2ui/core";
import { Text, Image, Icon, Video, Column, Row, List, Button, Card } from "./components";

/**
 * A2UI 默认组件渲染映射表
 *
 * key 对应协议中的组件类型（Text / Column / Row / List / Button / Card / Image / Icon / Video），
 * value 是对应的渲染函数（协议 props → VNode 中间表示）。
 *
 * 每个渲染函数的具体实现见 components/ 目录下同名文件。
 */
export const defaultRenderMap: RenderMap = {
  Text,
  Image,
  Icon,
  Video,
  Column,
  Row,
  List,
  Button,
  Card,
};
