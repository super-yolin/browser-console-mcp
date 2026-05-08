# Browser Console MCP

Browser console MCP client and server. Let your AI assistant control the browser!

**Language**: [English](#english) | [中文](#中文) | [日本語](#日本語) | [한국어](#한국어)

## English

### Introduction

Browser Console MCP is a relay server that lets any MCP-compatible AI client (Cursor, Claude Desktop, etc.) interact with your browser in real time. Inject the client script into any page and your AI can:

- Get page HTML content
- Execute JavaScript code
- Get page title and URL
- Query elements using CSS selectors
- Capture page screenshots
- Click elements
- Fill in form fields

### How it works

The relay server runs locally and bridges two connections:

1. **Browser side** — a small script injected into the page connects via WebSocket (`/browser`)
2. **AI client side** — the MCP server communicates with Cursor / Claude Desktop via stdio

All browser commands go through this relay; nothing is sent to any external service.

### Usage

#### Step 1 — Start the relay server

The server starts automatically when your MCP client launches it. Or run it manually:

```bash
npx browser-console-mcp
```

Open `http://localhost:7898` in your browser to check connection status and get the bookmarklet.

#### Step 2 — Inject the client into your browser

Drag the **Browser MCP** bookmarklet from `http://localhost:7898` to your bookmarks bar, then click it on any page.

Or paste this into the browser console:

```javascript
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

#### Step 3 — Configure your MCP client

**Cursor** — add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "pnpx",
      "enable": true,
      "args": ["-y", "browser-console-mcp"],
      "env": {
        "PORT": "7898"
      }
    }
  }
}
```

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "npx",
      "args": ["-y", "browser-console-mcp"],
      "env": {
        "PORT": "7898"
      }
    }
  }
}
```

#### Available tools

| Tool | Description |
|------|-------------|
| `executeJS` | Execute JavaScript in the page context |
| `getPageHTML` | Get full page HTML |
| `getPageTitle` | Get page title |
| `getPageURL` | Get current URL |
| `getElements` | Query elements by CSS selector |
| `captureScreenshot` | Screenshot the page or a specific element |
| `clickElement` | Click an element by CSS selector |
| `inputText` | Type into an input or textarea |

#### Troubleshooting

- **No browser connection** — make sure you've injected the client script on the target page. The status page at `http://localhost:7898` shows live connection counts.
- **Screenshot is blank** — try targeting a specific element: `captureScreenshot({selector: ".main-content"})`. Some pages block canvas rendering due to CSP.
- **Port conflict** — change `PORT` in the MCP config and use the same port in the inject URL.

### License

MIT

## 中文

### 简介

Browser Console MCP 是一个本地中继服务器，让任何支持 MCP 协议的 AI 客户端（Cursor、Claude Desktop 等）能够实时控制浏览器。在页面中注入客户端脚本后，AI 可以：

- 获取页面 HTML 内容
- 执行 JavaScript 代码
- 获取页面标题和 URL
- 使用 CSS 选择器查询元素
- 截取页面或指定元素的截图
- 点击页面元素
- 向输入框填入文本

### 工作原理

中继服务器在本地运行，连接两端：

1. **浏览器端** — 注入页面的脚本通过 WebSocket（`/browser`）连接服务器
2. **AI 客户端** — MCP 服务器通过 stdio 与 Cursor / Claude Desktop 通信

所有指令都在本地转发，不经过任何外部服务。

### 使用方法

#### 第一步 — 启动中继服务器

MCP 客户端会自动启动服务器。也可以手动运行：

```bash
npx browser-console-mcp
```

打开 `http://localhost:7898` 查看连接状态和书签工具。

#### 第二步 — 在浏览器中注入客户端

把 `http://localhost:7898` 页面上的 **Browser MCP** 书签拖到浏览器书签栏，然后在任意页面点击它。

或者直接在控制台粘贴：

```javascript
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

#### 第三步 — 配置 MCP 客户端

**Cursor** — 编辑 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "pnpx",
      "enable": true,
      "args": ["-y", "browser-console-mcp"],
      "env": {
        "PORT": "7898"
      }
    }
  }
}
```

**Claude Desktop** — 编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "npx",
      "args": ["-y", "browser-console-mcp"],
      "env": {
        "PORT": "7898"
      }
    }
  }
}
```

#### 可用工具

| 工具 | 说明 |
|------|------|
| `executeJS` | 在页面上下文中执行 JavaScript |
| `getPageHTML` | 获取完整页面 HTML |
| `getPageTitle` | 获取页面标题 |
| `getPageURL` | 获取当前 URL |
| `getElements` | 用 CSS 选择器查询元素 |
| `captureScreenshot` | 截取页面或指定元素截图 |
| `clickElement` | 点击指定元素 |
| `inputText` | 向输入框或文本域填入文本 |

#### 常见问题

- **提示无浏览器连接** — 确认已在目标页面注入客户端脚本，`http://localhost:7898` 会显示实时连接数。
- **截图空白** — 试试指定具体元素：`captureScreenshot({selector: ".main-content"})`，部分页面的 CSP 策略会阻止 canvas 渲染。
- **端口冲突** — 在 MCP 配置中修改 `PORT`，注入 URL 中也使用相同端口。

### 许可证

MIT

## 日本語

### はじめに

Browser Console MCPは、MCP対応AIクライアント（Cursor、Claude Desktopなど）がブラウザをリアルタイムで操作できるようにするローカル中継サーバーです。ページにクライアントスクリプトを注入すると、AIが以下の操作を実行できます：

- ページのHTML内容の取得
- JavaScriptコードの実行
- ページタイトルとURLの取得
- CSSセレクタを使用した要素の取得
- ページまたは特定要素のスクリーンショット撮影
- ページ要素のクリック
- 入力フィールドへのテキスト入力

### 使用方法

#### ステップ1 — ブラウザにクライアントを注入

ブラウザのコンソールで以下のコードを実行します：

```javascript
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

または `http://localhost:7898` のブックマークレットを使用してください。

#### ステップ2 — MCP設定

**Cursor** — `~/.cursor/mcp.json` に追加：

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "pnpx",
      "enable": true,
      "args": ["-y", "browser-console-mcp"],
      "env": {
        "PORT": "7898"
      }
    }
  }
}
```

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json` に追加：

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "npx",
      "args": ["-y", "browser-console-mcp"],
      "env": {
        "PORT": "7898"
      }
    }
  }
}
```

#### 利用可能なツール

| ツール | 説明 |
|--------|------|
| `executeJS` | ページコンテキストでJavaScriptを実行 |
| `getPageHTML` | ページの全HTMLを取得 |
| `getPageTitle` | ページタイトルを取得 |
| `getPageURL` | 現在のURLを取得 |
| `getElements` | CSSセレクタで要素を取得 |
| `captureScreenshot` | ページまたは特定要素のスクリーンショット |
| `clickElement` | 要素をクリック |
| `inputText` | 入力フィールドにテキストを入力 |

### ライセンス

MIT

## 한국어

### 소개

Browser Console MCP는 MCP 호환 AI 클라이언트(Cursor, Claude Desktop 등)가 브라우저를 실시간으로 제어할 수 있게 해주는 로컬 릴레이 서버입니다. 페이지에 클라이언트 스크립트를 주입하면 AI가 다음 작업을 수행할 수 있습니다:

- 페이지 HTML 콘텐츠 가져오기
- JavaScript 코드 실행하기
- 페이지 제목 및 URL 가져오기
- CSS 선택자로 요소 가져오기
- 페이지 또는 특정 요소 스크린샷 캡처하기
- 페이지 요소 클릭하기
- 입력 필드에 텍스트 입력하기

### 사용 방법

#### 1단계 — 브라우저에 클라이언트 주입하기

브라우저 콘솔에서 다음 코드를 실행하세요:

```javascript
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

또는 `http://localhost:7898`의 북마크릿을 사용하세요.

#### 2단계 — MCP 클라이언트 설정

**Cursor** — `~/.cursor/mcp.json`에 추가:

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "pnpx",
      "enable": true,
      "args": ["-y", "browser-console-mcp"],
      "env": {
        "PORT": "7898"
      }
    }
  }
}
```

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "npx",
      "args": ["-y", "browser-console-mcp"],
      "env": {
        "PORT": "7898"
      }
    }
  }
}
```

#### 사용 가능한 도구

| 도구 | 설명 |
|------|------|
| `executeJS` | 페이지 컨텍스트에서 JavaScript 실행 |
| `getPageHTML` | 전체 페이지 HTML 가져오기 |
| `getPageTitle` | 페이지 제목 가져오기 |
| `getPageURL` | 현재 URL 가져오기 |
| `getElements` | CSS 선택자로 요소 가져오기 |
| `captureScreenshot` | 페이지 또는 특정 요소 스크린샷 |
| `clickElement` | 요소 클릭하기 |
| `inputText` | 입력 필드에 텍스트 입력하기 |

### 라이선스

MIT
