# Browser Console MCP

Browser console MCP client and Cursor MCP server. Let your AI assistant control the browser!

<details>
<summary>English (Default)</summary>

## Introduction

Browser Console MCP is a tool that allows Cursor's Claude AI assistant to interact with the browser through the MCP (Model Context Protocol) protocol. It provides a browser client and an MCP server, enabling the AI assistant to perform the following operations:

- Get page HTML content
- Execute JavaScript code
- Get page title and URL
- Get elements using CSS selectors
- Capture page screenshots
- Click page elements
- Input text into form fields

## Installation

### Global Installation

```bash
pnpm add -g browser-console-mcp
```

### Local Installation

```bash
pnpm add browser-console-mcp
```

## Usage

### Start MCP Server

```bash
# If installed globally
browser-console-mcp start

# If installed locally
pnpx browser-console-mcp start
```

### Inject MCP Client in Browser

Execute the following code in your browser console:

```javascript
// Inject MCP server
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

### Using in Cursor

In Cursor, your AI assistant can now use the following tools:

- `mcp_browser-mcp_executeJS`: Execute JavaScript code
- `mcp_browser-mcp_getPageHTML`: Get page HTML
- `mcp_browser-mcp_getPageTitle`: Get page title
- `mcp_browser-mcp_getElements`: Get elements using CSS selectors
- `mcp_browser-mcp_captureScreenshot`: Capture page screenshot
- `mcp_browser-mcp_getPageURL`: Get page URL
- `mcp_browser-mcp_clickElement`: Click page elements
- `mcp_browser-mcp_inputText`: Input text into form fields

## Development

```bash
# Install dependencies
pnpm install

# Build project
pnpm build:all

# Start development mode
pnpm dev
```

## License

MIT
</details>

<details>
<summary>中文</summary>

# Browser Console MCP

浏览器控制台的MCP客户端和Cursor的MCP服务器。让你的AI助手能够控制浏览器！

## 简介

Browser Console MCP 是一个工具，允许 Cursor 的 Claude AI 助手通过 MCP（Model Context Protocol）协议与浏览器进行交互。它提供了一个浏览器客户端和一个 MCP 服务器，使 AI 助手能够执行以下操作：

- 获取页面 HTML 内容
- 执行 JavaScript 代码
- 获取页面标题和 URL
- 使用 CSS 选择器获取元素
- 截取页面截图
- 点击页面元素
- 向输入框填入文本

## 安装

### 全局安装

```bash
pnpm add -g browser-console-mcp
```

### 本地安装

```bash
pnpm add browser-console-mcp
```

## 使用方法

### 启动 MCP 服务器

```bash
# 全局安装的情况
browser-console-mcp start

# 本地安装的情况
pnpx browser-console-mcp start
```

### 在浏览器中注入 MCP 客户端

在浏览器控制台中执行以下代码：

```javascript
// 注入MCP服务器
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

### 在 Cursor 中使用

在 Cursor 中，你的 AI 助手现在可以使用以下工具：

- `mcp_browser-mcp_executeJS`: 执行 JavaScript 代码
- `mcp_browser-mcp_getPageHTML`: 获取页面 HTML
- `mcp_browser-mcp_getPageTitle`: 获取页面标题
- `mcp_browser-mcp_getElements`: 使用 CSS 选择器获取元素
- `mcp_browser-mcp_captureScreenshot`: 截取页面截图
- `mcp_browser-mcp_getPageURL`: 获取页面 URL
- `mcp_browser-mcp_clickElement`: 点击页面元素
- `mcp_browser-mcp_inputText`: 向输入框填入文本

## 开发

```bash
# 安装依赖
pnpm install

# 构建项目
pnpm build:all

# 启动开发模式
pnpm dev
```

## 许可证

MIT
</details>

<details>
<summary>日本語</summary>

# Browser Console MCP

ブラウザコンソールのMCPクライアントとCursorのMCPサーバー。AIアシスタントにブラウザを制御させましょう！

## はじめに

Browser Console MCPは、CursorのClaude AIアシスタントがMCP（Model Context Protocol）プロトコルを通じてブラウザと対話できるようにするツールです。ブラウザクライアントとMCPサーバーを提供し、AIアシスタントが以下の操作を実行できるようにします：

- ページのHTML内容の取得
- JavaScriptコードの実行
- ページタイトルとURLの取得
- CSSセレクタを使用した要素の取得
- ページのスクリーンショット撮影
- ページ要素のクリック
- 入力フィールドへのテキスト入力

## インストール

### グローバルインストール

```bash
pnpm add -g browser-console-mcp
```

### ローカルインストール

```bash
pnpm add browser-console-mcp
```

## 使用方法

### MCPサーバーの起動

```bash
# グローバルインストールの場合
browser-console-mcp start

# ローカルインストールの場合
pnpx browser-console-mcp start
```

### ブラウザにMCPクライアントを注入

ブラウザのコンソールで以下のコードを実行します：

```javascript
// MCPサーバーを注入
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

### Cursorでの使用

Cursorでは、AIアシスタントが以下のツールを使用できるようになります：

- `mcp_browser-mcp_executeJS`: JavaScriptコードを実行
- `mcp_browser-mcp_getPageHTML`: ページのHTMLを取得
- `mcp_browser-mcp_getPageTitle`: ページタイトルを取得
- `mcp_browser-mcp_getElements`: CSSセレクタを使用して要素を取得
- `mcp_browser-mcp_captureScreenshot`: ページのスクリーンショットを撮影
- `mcp_browser-mcp_getPageURL`: ページURLを取得
- `mcp_browser-mcp_clickElement`: ページ要素をクリック
- `mcp_browser-mcp_inputText`: 入力フィールドにテキストを入力

## 開発

```bash
# 依存関係のインストール
pnpm install

# プロジェクトのビルド
pnpm build:all

# 開発モードの起動
pnpm dev
```

## ライセンス

MIT
</details>

<details>
<summary>한국어</summary>

# Browser Console MCP

브라우저 콘솔용 MCP 클라이언트와 Cursor용 MCP 서버. AI 어시스턴트가 브라우저를 제어할 수 있게 해보세요!

## 소개

Browser Console MCP는 Cursor의 Claude AI 어시스턴트가 MCP(Model Context Protocol) 프로토콜을 통해 브라우저와 상호작용할 수 있게 해주는 도구입니다. 브라우저 클라이언트와 MCP 서버를 제공하여 AI 어시스턴트가 다음 작업을 수행할 수 있도록 합니다:

- 페이지 HTML 콘텐츠 가져오기
- JavaScript 코드 실행하기
- 페이지 제목 및 URL 가져오기
- CSS 선택자를 사용하여 요소 가져오기
- 페이지 스크린샷 캡처하기
- 페이지 요소 클릭하기
- 입력 필드에 텍스트 입력하기

## 설치

### 전역 설치

```bash
pnpm add -g browser-console-mcp
```

### 로컬 설치

```bash
pnpm add browser-console-mcp
```

## 사용 방법

### MCP 서버 시작하기

```bash
# 전역 설치한 경우
browser-console-mcp start

# 로컬 설치한 경우
pnpx browser-console-mcp start
```

### 브라우저에 MCP 클라이언트 주입하기

브라우저 콘솔에서 다음 코드를 실행하세요:

```javascript
// MCP 서버 주입
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

### Cursor에서 사용하기

Cursor에서 AI 어시스턴트는 이제 다음 도구들을 사용할 수 있습니다:

- `mcp_browser-mcp_executeJS`: JavaScript 코드 실행하기
- `mcp_browser-mcp_getPageHTML`: 페이지 HTML 가져오기
- `mcp_browser-mcp_getPageTitle`: 페이지 제목 가져오기
- `mcp_browser-mcp_getElements`: CSS 선택자로 요소 가져오기
- `mcp_browser-mcp_captureScreenshot`: 페이지 스크린샷 캡처하기
- `mcp_browser-mcp_getPageURL`: 페이지 URL 가져오기
- `mcp_browser-mcp_clickElement`: 페이지 요소 클릭하기
- `mcp_browser-mcp_inputText`: 입력 필드에 텍스트 입력하기

## 개발

```bash
# 의존성 설치
pnpm install

# 프로젝트 빌드
pnpm build:all

# 개발 모드 시작
pnpm dev
```

## 라이선스

MIT
</details>
