# Nurjan · 轻量信息流

一个用纯 **HTML + CSS + JavaScript** 写成的极简信息流小应用，零框架、零依赖、零构建。发布的内容通过浏览器 **Local Storage** 保存在本机，刷新或重新打开页面后依然存在。

> 名称「Nurjan」为中性自拟命名，与任何现存的社交平台的商标、名称无关。

## 功能

- **发布**：输入内容后点击「发布」或按 `Ctrl / Cmd + Enter`，即时出现在时间线顶部。
- **查看**：按时间倒序展示全部内容，显示相对时间（刚刚 / n 分钟前 / n 小时前 / 昨天 / 日期）。
- **删除**：点击单条内容右下角「删除」，按钮变为「确认删除」，再次点击才真正删除（3.2 秒后自动取消确认）。
- **持久化**：数据写入 Local Storage，重载页面后自动恢复。
- **健壮性**：存储读取失败、JSON 损坏、写入超限、空输入、超长输入均有兜底，不会白屏。
- **响应式与可访问性**：桌面 / 移动端自适应，语义化标签、`aria-live` 提示、清晰的 `focus-visible` 样式，尊重系统「减少动效」偏好。

## 运行

方式一：直接用浏览器打开 `index.html`（双击即可）。

方式二：起一个本地静态服务器（推荐，行为更贴近真实站点）：

```bash
# 任选其一
python -m http.server 5173
npx serve .
```

然后访问 `http://localhost:5173`。

## 目录结构

```
.
├── index.html   # 页面骨架：品牌栏、撰写区、时间线、空状态、页脚
├── styles.css   # 设计令牌、布局、组件与响应式样式
├── app.js       # store（localStorage 读写）/ view（渲染）/ controller（交互）
├── README.md
└── .gitignore
```

## 数据结构

存储键：`stream.posts.v1`（带版本号，便于将来迁移结构）

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

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一标识，优先使用 `crypto.randomUUID()` |
| `content` | string | 正文，最长 280 字符，渲染时使用 `textContent` 防 XSS |
| `author` | string | 作者标识，本地单用户场景下固定为「我」 |
| `createdAt` | number | 创建时间戳（毫秒） |

## 关键实现

- **单向数据流**：内存中的 `posts` 数组是唯一数据源，任何变更先更新数组与 localStorage，再全量重渲染列表。
- **事件委托**：删除操作统一绑定在列表容器上，避免逐条绑定造成的泄漏。
- **安全渲染**：所有用户内容通过 `textContent` 注入，不使用 `innerHTML` 拼接。
- **异常兜底**：读取包 `try/catch` 并逐条校验字段；写入捕获 `QuotaExceededError` 等异常并回滚内存状态。

## 版本管理

已初始化 Git 并完成初始提交。推送到你自己的 GitHub 仓库，请先创建一个**空仓库**（不要勾选自动生成 README），然后在本目录执行：

```bash
# 1) 关联远程仓库（替换为你的地址）
git remote add origin https://github.com/<你的用户名>/<仓库名>.git

# 2) 确认分支名为 main
git branch -M main

# 3) 首次推送并建立跟踪关系
git push -u origin main
```

若本机已登录 GitHub CLI，也可以一步完成：

```bash
gh repo create <仓库名> --public --source=. --remote=origin --push
```

## License

MIT
