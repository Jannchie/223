# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Vue 3 + Electron + Live2D 的桌面宠物应用（NiNiSan），用户可以与 Live2D 角色进行聊天交互。应用支持拖拽、缩放、目光追踪、OpenAI 集成等功能。

## 开发命令

### 核心命令

- `npm run dev`: 启动开发服务器（Vite + Electron）
- `npm run build`: 构建项目（TypeScript 检查 → Vite 构建 → Electron Builder 打包）
- `npm run preview`: 预览构建结果

### 检查和测试

- `vue-tsc`: TypeScript 类型检查（已集成到 build 命令中）
- 使用 `@jannchie/eslint-config` 进行代码规范检查

## 技术架构

### 主要技术栈

- **前端框架**: Vue 3 + TypeScript + Vite
- **桌面应用**: Electron
- **Live2D 渲染**: @jannchie/pixi-live2d-display + PixiJS
- **样式**: UnoCSS + Scoped CSS
- **AI 集成**: OpenAI API
- **状态管理**: VueUse (useLocalStorage)

### 核心文件结构

```txt
electron/
├── main.ts           # Electron 主进程 - 窗口管理、静态服务器、系统托盘
├── preload.ts        # 进程间通信 - 暴露 electronAPI
src/
├── App.vue           # 根组件
├── components/
│   └── SimpleLive2DViewer.vue  # 主要的 Live2D 交互组件
├── utils/
│   ├── openai.ts     # OpenAI API 封装
│   └── system-prompt.ts  # AI 系统提示词
public/models/        # Live2D 模型文件
```

### 关键架构特性

#### Electron 主进程功能 (electron/main.ts)

- **窗口管理**: 全屏透明窗口，始终置顶，动态鼠标穿透
- **静态服务器**: HTTP 服务器提供 Live2D 模型文件访问
- **全局鼠标跟踪**: 30fps 鼠标位置监听，用于目光追踪
- **系统托盘**: 显示/隐藏和退出功能

#### 渲染进程功能 (SimpleLive2DViewer.vue)

- **Live2D 渲染**: PixiJS + Live2D 模型加载和渲染
- **交互功能**: 拖拽、缩放、右键设置
- **目光追踪**: 鼠标位置和输入光标位置追踪
- **聊天系统**: OpenAI 流式响应，对话气泡显示
- **透明度控制**: 根据鼠标位置动态显示/隐藏 UI

#### 进程间通信 (preload.ts)

- **模型路径**: 根据静态服务器状态返回正确的模型文件 URL
- **鼠标事件**: 全局鼠标位置监听和穿透控制
- **IPC 通道**: 安全的进程间消息传递

## 开发规范

### 代码风格

- 使用 `@jannchie/eslint-config` 规范
- TypeScript 严格模式
- Vue 3 Composition API + `<script setup>`
- UnoCSS 原子化 CSS

### 存储和配置

- 使用 `useLocalStorage` 持久化用户设置
- 配置包括：API Key、Base URL、Canvas 位置/缩放
- 模型文件通过 HTTP 服务器或自定义协议访问

### 性能优化

- Live2D 渲染限制 60fps
- 鼠标跟踪 30fps（降低 CPU 使用）
- 防抖光标位置计算
- GPU 硬件加速启用

## 开发注意事项

### Live2D 集成

- 模型文件位于 `public/models/` 目录
- 通过动态端口的 HTTP 服务器提供访问
- 使用 `@jannchie/pixi-live2d-display` 包进行渲染
- 目光追踪基于屏幕坐标转换到模型坐标

### Electron 安全

- 启用 `contextIsolation` 和
`nodeIntegration: false`
- 通过 contextBridge 安全暴露 API
- 自定义协议处理本地文件访问

### OpenAI 集成

- 支持自定义 Base URL（兼容其他 API）
- 流式响应处理
- 错误处理和重试机制

### 构建和分发

- 使用 electron-builder 打包
- 支持 Windows (NSIS)、macOS (DMG)、Linux (AppImage)
- 自动更新配置指向 GitHub releases
- 我用的是pnpm
