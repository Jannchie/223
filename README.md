# NiNiSan 桌宠项目

NiNiSan 是一个基于 **Vue 3 + TypeScript + Electron** 的桌面宠物应用，结合 Live2D 渲染与 OpenAI 聊天能力，让用户可以与 06 娘等角色进行实时互动。项目整合了截图吐槽、目光追踪等多种功能，适合作为桌面陪伴或直播互动的辅助工具。

## 主要特性

- 🎨 **Live2D 渲染**：使用 PixiJS 与 `@jannchie/pixi-live2d-display` 实现角色驱动、拖拽和缩放。
- 🤖 **AI 聊天**：封装 OpenAI API，支持自定义 Base URL 及模型参数，提供流式回复体验。
- 🧠 **记忆系统**：集成角色记忆抽取与管理，让角色能记住关键信息。
- 📸 **截图吐槽**：支持自动或手动截图，并通过 AI 生成趣味吐槽内容。
- 👀 **目光追踪**：监听鼠标与输入光标位置，让角色的视线更加灵动自然。

## 快速开始

> ⚠️ **克隆前请先安装 [Git LFS](https://git-lfs.com/)**。本项目用 Git LFS 管理字体等大文件（`src/assets/fonts/*.ttf`）。装好后执行一次 `git lfs install` 再克隆；若已克隆过则补一句 `git lfs pull`。否则字体会是几百字节的指针文件，导致构建出的应用字体损坏（且不会报错）。

```bash
git lfs install        # 每台机器执行一次
git clone https://github.com/Jannchie/223.git
cd 223
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
- 样式采用内置的 UI 组件套件与 scoped CSS，主题令牌见 `src/components/ui`。

## 贡献指南

欢迎通过 Issue 或 Pull Request 提交改进建议。在提交前请确保：

1. 所有相关测试与类型检查通过。
2. 代码遵循既定的 ESLint 与格式化规范。
3. 提交信息清晰描述修改内容。

祝你开发愉快！
