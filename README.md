# NiNiSan 桌宠项目

NiNiSan 是一个基于 **Vue 3 + TypeScript + Electron** 的桌面宠物应用，结合 Live2D 渲染与 OpenAI 聊天能力，让用户可以与 06 娘等角色进行实时互动。项目整合了截图吐槽、录制窗口、目光追踪等多种功能，适合作为桌面陪伴或直播互动的辅助工具。

## 主要特性

- 🎨 **Live2D 渲染**：使用 PixiJS 与 `@jannchie/pixi-live2d-display` 实现角色驱动、拖拽和缩放。
- 🤖 **AI 聊天**：封装 OpenAI API，支持自定义 Base URL 及模型参数，提供流式回复体验。
- 🧠 **记忆系统**：集成角色记忆抽取与管理，让角色能记住关键信息。
- 📸 **截图吐槽**：支持自动或手动截图，并通过 AI 生成趣味吐槽内容。
- 🎥 **录制模式**：额外提供带背景色的录制窗口，便于 OBS 等软件捕获。
- 👀 **目光追踪**：监听鼠标与输入光标位置，让角色的视线更加灵动自然。

## 快速开始

```bash
pnpm install
pnpm dev
```

开发过程中可使用以下命令：

- `pnpm dev`：启动 Vite + Electron 联调环境。
- `pnpm build`：执行类型检查、打包前端与 Electron 主进程。
- `pnpm preview`：预览构建后的渲染进程内容。

## 目录结构

```
.
├── electron/               # Electron 主进程与预加载脚本
├── src/
│   ├── components/         # Vue 组件（包含 SimpleLive2DViewer 等核心组件）
│   ├── composables/        # 组合式函数（聊天、目光追踪等）
│   ├── services/           # 业务服务（消息、角色、聊天、记忆等）
│   ├── utils/              # 工具函数与测试脚本
│   └── types/              # 类型定义
├── public/                 # 静态资源与 Live2D 模型
├── build/                  # 构建脚本与配置
├── package.json
└── pnpm-lock.yaml
```

## 代码风格与检查

- 使用 `vue-tsc` 进行类型检查。
- ESLint 配置基于 `@jannchie/eslint-config`。
- UnoCSS 负责样式原子化，相关配置见 `uno.config.ts`。

## 贡献指南

欢迎通过 Issue 或 Pull Request 提交改进建议。在提交前请确保：

1. 所有相关测试与类型检查通过。
2. 代码遵循既定的 ESLint 与格式化规范。
3. 提交信息清晰描述修改内容。

祝你开发愉快！
