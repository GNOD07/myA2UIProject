import React, { useState, useCallback } from "react";
import type { ComponentRenderer } from "@a2ui/core";

// ═══════════════════════════════════════════════════════════════════════════
// A2UI v0.8 Standard Catalog — TextField 组件
// 协议属性：label (required), text (optional), textFieldType (optional), validationRegexp (optional)
// ═══════════════════════════════════════════════════════════════════════════

/** textFieldType → HTML input type 映射 */
const TYPE_MAP: Record<string, string> = {
  date: "date",
  number: "number",
  shortText: "text",
  obscured: "password",
};

/** 协议层 TextField 组件属性（渲染前，含 BoundValue） */
export interface TextFieldProps {
  label: { literalString?: string; path?: string };
  text?: { literalString?: string; path?: string };
  textFieldType?: "date" | "longText" | "number" | "shortText" | "obscured";
  validationRegexp?: string;
}

/** treeBuilder 解析 BoundValue 后的 TextField 属性 */
export interface ResolvedTextFieldProps {
  label: string;
  text?: string;
  textFieldType?: string;
  validationRegexp?: string;
  componentId?: string;
}

/** renderMap 入口：协议 props → ComponentVNode */
export const TextField: ComponentRenderer = (props, componentId?) => ({
  __a2ui_component: true,
  type: "TextField",
  props: {
    label: props.label,
    text: props.text,
    textFieldType: props.textFieldType,
    validationRegexp: props.validationRegexp,
  },
  componentId,
});

/** React 渲染组件：VNode → DOM */
export function TextFieldRenderer({
  label,
  text,
  textFieldType,
  validationRegexp,
  componentId,
}: ResolvedTextFieldProps) {
  const isLongText = textFieldType === "longText";
  const [value, setValue] = useState(text ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      // 客户端正则校验
      if (validationRegexp && newValue) {
        try {
          const regex = new RegExp(validationRegexp);
          if (!regex.test(newValue)) {
            setError(`输入格式不匹配`);
            return;
          }
        } catch {
          // 无效正则，忽略校验
        }
      }
      setError(null);
    },
    [validationRegexp],
  );

  const inputType = TYPE_MAP[textFieldType ?? ""] ?? "text";

  const sharedStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    fontSize: 14,
    border: error ? "1px solid #ff4d4f" : "1px solid #d9d9d9",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
    backgroundColor: "#fff",
    color: "#333",
  };

  return React.createElement(
    "div",
    {
      id: componentId ?? undefined,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 4,
        width: "100%",
      },
    },
    // label
    React.createElement(
      "label",
      {
        style: {
          fontSize: 13,
          fontWeight: 500,
          color: "#555",
        },
      },
      String(label ?? ""),
    ),
    // input / textarea
    isLongText
      ? React.createElement("textarea", {
          value,
          onChange: handleChange,
          placeholder: text ?? undefined,
          rows: 4,
          style: {
            ...sharedStyle,
            resize: "vertical",
            minHeight: 80,
          },
        })
      : React.createElement("input", {
          type: inputType,
          value,
          onChange: handleChange,
          placeholder: text ?? undefined,
          style: sharedStyle,
        }),
    // 校验错误提示
    error
      ? React.createElement(
          "span",
          { style: { fontSize: 12, color: "#ff4d4f", marginTop: 2 } },
          error,
        )
      : null,
  );
}
