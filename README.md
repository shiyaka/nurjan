# Nurjan · 轻量信息流

一个用 **Vue 3 + Pinia** 写成的极简信息流小应用，数据保存在浏览器 **Local Storage**，无后端、无账号、无网络请求。项目以 TDD 方式开发：先写失败测试，再实现到测试全部通过。

- 线上地址：<https://shiyaka.github.io/nurjan/>
- 仓库地址：<https://github.com/shiyaka/nurjan>
- 旧版纯 HTML 实现归档在 [`legacy/`](./legacy)，可直接双击 `legacy/index.html` 对比。

## 功能

- **发布**：输入后点击「发布」或按 `Ctrl / Cmd + Enter`，内容即时置顶；空白内容不可发布。
- **浏览**：按时间倒序展示，显示作者、相对时间（刚刚 / n 分钟前 / n 小时前 / 昨天 / 日期）。
- **删除**：点击「删除」后按钮变为「确认删除」，再次点击才真正删除；3.2 秒无操作自动还原。
- **持久化**：写入 Local Storage，刷新或重开页面后仍在；兼容旧版数据。
- **健壮性**：空数据、损坏 JSON、非法字段、写入超限（配额）均有兜底，不会白屏。
- **体验**：响应式布局（≤640px 适配）、键盘可完整操作、`focus-visible` 焦点样式、尊重系统「减少动效」偏好。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 运行时 | Node.js 22 LTS |
| 框架 | Vue 3（`<script setup>` 单文件组件） |
| 状态 | Pinia（唯一数据源） |
| 构建 | Vite 6 |
| 测试 | Vitest 3 + @vue/test-utils + jsdom + v8 覆盖率 |
| 存储 | localStorage（键：`stream.posts.v1`） |
| 部署 | GitHub Actions → GitHub Pages |

## 快速开始

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
```

其他命令：

```bash
npm run test       # 监听模式
npm run test:run   # 单次运行（CI 使用）
npm run coverage   # 覆盖率，门槛 80%
npm run build      # 生产构建，输出 dist/
npm run preview    # 预览构建产物（注意 base 为 /nurjan/）
```

## 目录结构

```
.
├── index.html                     # Vite 入口
├── vite.config.js                 # Vue 插件、@ 别名、base、Vitest 配置
├── src/
│   ├── main.js                    # createApp + Pinia + 全局样式
│   ├── App.vue                    # 装配组件与 store、toast、跨标签页同步
│   ├── constants.js               # 存储键、字数上限、作者、超时时间
│   ├── components/                # AppHeader / PostComposer / PostList / PostItem / EmptyState / ToastHost
│   ├── composables/useToast.js    # 单条轻提示状态与定时器
│   ├── stores/posts.js            # Pinia store：hydrate / add / remove
│   ├── utils/                     # time / storage / id
│   └── styles/                    # tokens / base / components
├── tests/
│   ├── setup.js                   # jsdom 环境补丁与每例清理
│   ├── unit/                      # time、storage、id、store
│   └── components/                # PostComposer、PostItem、App
├── legacy/                        # 旧版纯 HTML/CSS/JS 实现（归档）
└── .github/workflows/deploy.yml   # 测试 + 构建 + 发布 Pages
```

## 测试与 TDD

先写测试并确认失败，再实现功能：

1. `tests/unit/time.spec.js`：相对时间的各分支（刚刚 / 分钟 / 小时 / 昨天 / 同年 / 跨年）。
2. `tests/unit/storage.spec.js`：空值、损坏 JSON、非数组、脏字段过滤、超长截断、排序、写入成功与配额失败。
3. `tests/unit/posts.store.spec.js`：hydrate、add 校验与置顶、remove、写入失败回滚。
4. `tests/components/*.spec.js`：禁用态、字数计数、发布清空、XSS 纯文本渲染、两段删除、定时器清理、集成持久化。

当前状态：**7 个测试文件 / 43 个用例全部通过**，行覆盖率约 97%。

## 数据结构

存储键：`stream.posts.v1`（与旧版一致，可直接读取旧数据）

```json
[
  {
    "id": "0f8c6a2e-6f0e-4c1c-9b23-2d1b6d9a1c11",
    "content": "第一条内容",
    "author": "我",
    "createdAt": 1762934400000
  }
]
```

- `content` 最长 280 字符，渲染时使用 Vue 插值（禁止 `v-html`），防止 XSS。
- 读取时逐条校验并补默认值，脏数据被丢弃而非整体失败。
- 写入失败（如 `QuotaExceededError`）会回滚内存状态并提示。

## 部署

推送到 `main` 后，GitHub Actions 会依次执行 `npm ci` → 覆盖率测试 → 构建 → 部署到 Pages。

线上地址：<https://shiyaka.github.io/nurjan/>

首次启用需在仓库 **Settings → Pages → Build and deployment** 中把 Source 设为 **GitHub Actions**（工作流中已声明 `enablement`）。

## 版本管理

```bash
git add .
git commit -m "feat: 描述本次改动"
git push
```

## License

MIT
