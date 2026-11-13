# Nurjan · 轻量信息流

一个 **Vue 3 + Pinia** 前端 + **Hono REST API** 后端的极简信息流应用。数据保存在服务端**内存**中，无数据库、无账号、无第三方服务；服务重启后数据清空。

- 仓库：<https://github.com/shiyaka/nurjan>
- 旧版纯 HTML 实现归档在 [`legacy/`](./legacy)（使用 localStorage，仅作参考）
- 原 GitHub Pages 地址已停用，现由单台 Node 服务同时提供页面与 API

## 功能

- **发布**：输入后点击「发布」或 `Ctrl / Cmd + Enter`，请求后端写入内存并置顶；空白内容不可发布。
- **浏览**：从 `GET /api/posts` 拉取，按时间倒序展示，显示作者与相对时间。
- **删除**：两段式确认（3.2 秒超时还原），确认后调用 `DELETE /api/posts/:id`。
- **反馈**：加载占位、空状态、发布/删除/失败 toast、提交中禁用。
- **健壮性**：网络失败保留现有列表、空内容与超长内容双重校验（前端 + 后端）、JSON 解析失败返回 400。
- **体验**：响应式（≤640px）、键盘可操作、`focus-visible`、尊重「减少动效」。

## 架构

```
浏览器
  └── Vue 3 页面（Vite 构建）
        ├── PostComposer / PostList / PostItem / EmptyState / ToastHost
        ├── Pinia store（异步 actions：hydrate / add / remove）
        └── src/api/posts.js ── fetch /api/posts ──┐
                                                  │
Node 进程（server/index.js）                       │
  ├── Hono app（server/app.js）◀──────────────────┘
  │     ├── GET/POST /api/posts
  │     └── DELETE /api/posts/:id
  ├── 内存仓库（server/store.js，进程重启即清空）
  └── 静态托管 dist/ + SPA fallback
```

## REST API

| 方法 | 路径 | 成功 | 失败 |
| --- | --- | --- | --- |
| GET | `/api/posts` | `200 { data: Post[] }`（倒序） | — |
| POST | `/api/posts` | `201 { data: Post }` | `422 EMPTY_CONTENT` / `422 CONTENT_TOO_LONG` / `400 INVALID_JSON` |
| DELETE | `/api/posts/:id` | `204` | `404 NOT_FOUND` |

```json
{
  "id": "0f8c6a2e-6f0e-4c1c-9b23-2d1b6d9a1c11",
  "content": "第一条内容",
  "author": "我",
  "createdAt": 1762934400000
}
```

错误统一为 `{ "error": { "code": "EMPTY_CONTENT", "message": "内容不能为空" } }`；`content` 上限 280 字符，保存前会 trim。

## 快速开始

```bash
npm install
npm run dev        # 同时启动 web(5173) 与 api(8787)，Vite 已代理 /api
```

打开 <http://localhost:5173>。

```bash
npm run test       # Vitest 监听
npm run test:run   # 单次运行
npm run coverage   # 覆盖率，门槛 80%
npm run build      # 构建前端到 dist/
npm start          # 生产模式：8787 端口同时提供 API 与 dist
```

生产运行自定义端口（PowerShell）：

```powershell
$env:PORT = 3000; npm start
```

> 注意：数据是**进程内存**，重启 `npm start` 或 `npm run dev` 的 api 进程都会清空，这是本项目的设计取舍。

## 目录结构

```
.
├── index.html                  # Vite 入口
├── vite.config.js              # base '/'、/api 代理、Vitest 与覆盖率
├── server/
│   ├── store.js                # 内存仓库（可注入 clock/id，便于测试）
│   ├── app.js                  # Hono 应用工厂，REST 路由与错误处理
│   └── index.js                # Node 启动、静态托管 dist、SPA fallback
├── src/
│   ├── api/posts.js            # fetch 客户端与 ApiError
│   ├── stores/posts.js         # 异步 Pinia store
│   ├── components/             # Header / Composer / List / Item / Empty / Toast
│   ├── composables/useToast.js
│   ├── utils/time.js
│   ├── App.vue
│   └── styles/
├── tests/
│   ├── server/                 # API 与仓库测试（node 环境）
│   ├── unit/                   # api 客户端、store、time
│   └── components/             # Composer、Item、App
├── legacy/                     # 旧版纯 HTML + localStorage 实现
└── .github/workflows/ci.yml    # 覆盖率测试 + 构建
```

## TDD

开发顺序：先写失败测试，再实现到通过，最后重构。

- 后端：`tests/server/api.spec.js` 覆盖增删查、校验、404、JSON 错误、排序与仓库隔离；
- 前端：`tests/unit/api.spec.js` 覆盖成功、非 2xx、204、网络异常；store 测试覆盖加载/发布/删除与失败回滚；组件测试覆盖禁用态、XSS、两段删除与异步集成；
- CI 在每次 push/PR 运行 `npm run coverage` 与 `npm run build`。

## 部署说明

### 方式一：单服务自托管（Node 同时提供页面与 API）

1. 服务器安装 Node.js 20+；
2. `npm ci && npm run build`；
3. `PORT=8080 npm start`；
4. 用 Nginx 等反向代理到该端口（或直接暴露），并配置 HTTPS。

### 方式二：GitHub Pages 前端 + 独立 API

Pages 只能托管静态文件，Hono 必须部署在可运行 Node 的环境（如 CloudBase / EdgeOne / 自有服务器）。前端通过构建变量指向 API：

```bash
VITE_API_BASE=https://your-api.example.com npm run build
```

GitHub 仓库需配置 Actions Variable `VITE_API_BASE`（Settings → Secrets and variables → Actions → Variables），
`deploy-pages.yml` 会在该变量存在时构建并发布到 <https://shiyaka.github.io/nurjan/>，未配置时自动跳过，避免发布不可用的页面。

Hono 已内置 CORS（`/api/*` 允许跨域 GET / POST / DELETE），API 域名与 Pages 域名不同也能直接调用。

## License

MIT
