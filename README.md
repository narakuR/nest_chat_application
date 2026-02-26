## CHAT

一个基于 Turborepo 的多应用仓库，包含：

- **后端 `apps/api`**：NestJS + TypeORM + MySQL  
  - 集成 DeepSeek（通过 OpenAI SDK）实现流式对话
  - 会话与消息管理（Conversation / Message）
  - 用户注册 / 登录，头像上传（Multer + 静态资源）、密码加盐存储（bcrypt）
  - SSE 流式输出消息
- **前端 `apps/web`**：Vite + React + Tailwind CSS + shadcn/ui  
  - 多会话聊天界面
  - DeepSeek 流式回复展示、reasoning 折叠面板
  - 登录 / 注册弹窗，支持头像上传并显示

---

### 项目结构

```text
CHAT
├─ apps
│  ├─ api        # NestJS 后端
│  │  ├─ src
│  │  │  ├─ main.ts                  # Nest 启动入口（含静态资源、JSON 解析配置）
│  │  │  ├─ modules
│  │  │  │  ├─ auth                  # 登录 / 注册 / 用户、头像实体
│  │  │  │  ├─ conversation          # 会话 CRUD
│  │  │  │  └─ messages              # 消息流式生成（DeepSeek）
│  │  │  └─ lib/typeorm.ts           # TypeORM 配置（autoLoadEntities）
│  │  ├─ static                      # 头像等静态资源（通过 /static 暴露）
│  │  └─ .env(.example)              # 后端环境变量
│  └─ web        # 前端聊天界面
│     ├─ src
│     │  ├─ App.tsx                  # 主界面：聊天 + 会话 + 登录注册
│     │  ├─ main.tsx
│     │  └─ components/ui            # shadcn/ui 风格组件
│     └─ .env                        # 前端环境变量（可选）
├─ package.json                      # 根脚本（turbo）
└─ README.md
```

---

### 运行环境

- **Node.js**：>= 18
- **包管理器**：pnpm（根目录已配置 `"packageManager": "pnpm@9.0.0"`）
- **数据库**：MySQL（用作会话、消息、用户、头像存储）

---

### 后端配置（`apps/api`）

在 `apps/api` 下复制 `.env.example` 为 `.env`，并补全配置：

```env
# DeepSeek
DEEPSEEK_BASE_URL=              # DeepSeek API Base URL
DEEPSEEK_API_KEY=               # DeepSeek API Key

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_NAME=nest_chat_application

# JWT
JWT_SECRET=nest_chat_application_jwt_secret
JWT_EXPIRES_IN=3600
```

后端主要特性：

- 使用 `TypeORM` + `autoLoadEntities: true` 自动加载实体
- `synchronize: true`（开发环境自动建表）
- 静态资源：
  - `main.ts` 中使用 `app.useStaticAssets(join(__dirname, '..', '..', 'public'), { prefix: '/static/' })`
  - 头像文件通过 Multer 存入 `public`/`static` 目录，下发的 URL 类似 `/static/xxx.png`
- 密码加盐：
  - `AuthService.register` 中通过 `bcrypt.genSalt` + `bcrypt.hash` 存储密码哈希
  - `AuthService.signin` 中使用 `bcrypt.compare` 校验
- SSE 消息流式接口：
  - `POST /messages`：创建一条用户消息并启动 DeepSeek 流
  - `SSE /messages/:uid`：根据 `uid` 推送 reasoning + 最终回复 token

---

### 前端配置（`apps/web`）

前端使用 Vite + React 19 + Tailwind CSS 4 + shadcn/ui。

可选的环境变量（在 `apps/web/.env` 中）：

```env
VITE_API_URL=http://localhost:3000  # 后端 API 地址，默认即为此值
```

前端主要能力：

- 左侧会话列表（从 `/conversation` 拉取，按用户过滤）
- 右侧聊天窗口：
  - 支持多轮对话，历史消息展示
  - DeepSeek 流式回复，reasoning 区块默认展开，可折叠
- 顶部用户头像 + 登录状态：
  - 未登录：显示 “Sign In” 按钮，点击后弹出 Dialog
  - 已登录：展示头像（从 `/static/...` 加载），下拉菜单中预留 Sign Out
- 登录 / 注册：
  - `POST /auth/signin`：JSON 形式 `{ username, password }`
  - `POST /auth/register`：`multipart/form-data`，字段：
    - `username`、`password`、`confirmPassword`
    - `avatar`：图片文件
  - 注册成功后自动切换回登录表单
  - 登录成功后写入 `localStorage.userinfo`，关闭 Dialog 并刷新页面

---

### 本地开发

#### 1. 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

#### 2. 启动 MySQL 并配置 `.env`

- 确保本地 MySQL 已启动，数据库名与 `.env` 中的 `DB_NAME` 对应  
- 在 `apps/api` 目录下准备好 `.env`（见上文）

#### 3. 启动开发环境

在仓库根目录：

```bash
pnpm dev
```

这会通过 Turborepo 同时启动：

- `apps/api`：NestJS 后端（默认端口 `3000`）
- `apps/web`：Vite 前端（默认端口类似 `5173`，具体看终端输出）

也可以分别启动某一个应用：

```bash
# 只启动后端
pnpm turbo run dev --filter=api

# 只启动前端
pnpm turbo run dev --filter=web
```

---

### 生产构建

在仓库根目录：

```bash
pnpm build
```

会调用 Turborepo 的 `turbo run build`，分别构建前后端应用。构建产物：

- 后端：`apps/api/dist`
- 前端：`apps/web/dist`

---

### 后续优化方向

- **会话管理**：支持重命名会话、删除会话、按更新时间排序  
- **错误处理**：前端对 SSE 错误、网络错误做更友好的提示  
- **部署**：将前后端分别部署到云服务，并接入 HTTPS 与域名

