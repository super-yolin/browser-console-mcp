# Browser Console MCP

Browser Console MCP 让 Cursor、Claude Desktop 等支持 MCP 的 AI 客户端，可以通过本地中继检查和控制浏览器页面。

## 功能

- 读取页面 HTML、标题、URL 和指定元素。
- 在页面上下文中执行 JavaScript。
- 点击元素、填写输入框。
- 截取页面或指定元素截图。
- 捕获控制台日志和 fetch/XHR 网络请求。
- 管理多个浏览器 session。

## 工作原理

Browser Console MCP 由本地常驻 daemon 和短生命周期 MCP stdio adapter 组成：

1. **MCP stdio adapter**：由 Cursor 或 Claude Desktop 启动，负责把工具调用转发给 daemon。
2. **Local daemon**：负责 HTTP、WebSocket、状态页、session registry 和浏览器路由。
3. **浏览器入口**：通过三种入口之一把页面连接到 daemon。

所有浏览器指令都只在本机转发。

## 使用方法

### 第一步：启动中继

MCP 客户端启动包时会自动拉起 daemon。也可以手动运行：

```bash
npx browser-console-mcp
```

打开 `http://localhost:7898` 可以查看 daemon 状态、session 和安装指引。

### 第二步：连接浏览器

三种入口共享同一套 daemon、协议和 Page Agent。

#### 方式 A：Console 或书签注入

把 `http://localhost:7898` 页面上的 **Browser MCP** 书签拖到书签栏，然后在任意页面点击它。

也可以在浏览器控制台粘贴：

```javascript
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

这个方式适合临时调试。页面完整刷新或跨页面跳转后，可能需要重新注入。

#### 方式 B：前端依赖或 Vite 插件

在你自己的前端项目中使用：

```ts
import { browserConsoleMCP } from 'browser-console-mcp/vite';

export default {
  plugins: [browserConsoleMCP()]
};
```

插件只在 dev server 模式生效，并把 Page Agent 注入到真实页面 JavaScript 上下文中。

#### 方式 C：Chrome 扩展

在 Chrome 中以 unpacked extension 方式加载本仓库的 `extension/` 目录。这个方式推荐用于第三方网站、MPA 页面、多标签页，以及导航后的自动重注入。

打包扩展：

```bash
pnpm package:extension
```

生成的 `extension.zip` 是构建产物，不建议提交到 git。

### 第三步：配置 MCP 客户端

Cursor，`~/.cursor/mcp.json`：

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

Claude Desktop，`~/Library/Application Support/Claude/claude_desktop_config.json`：

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

## 工具

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
| `getConsoleLogs` | 读取已捕获的控制台日志 |
| `getNetworkRequests` | 读取已捕获的 fetch/XHR 请求 |
| `clearBrowserDiagnostics` | 清空已捕获的控制台和网络诊断 |
| `listBrowserSessions` | 查看已连接的浏览器 session |
| `selectBrowserSession` | 选择后续工具默认操作的 session |

## 常见问题

- **没有浏览器连接**：确认三种浏览器入口至少启用了一种。`http://localhost:7898` 会显示实时 session。
- **操作到了错误标签页**：先调用 `listBrowserSessions`，再调用 `selectBrowserSession({ sessionId: "..." })`。
- **截图空白**：尝试 `captureScreenshot({ selector: ".main-content" })`。部分页面会阻止 canvas 渲染。
- **端口冲突**：在 MCP 配置中修改 `PORT`。运行状态记录在 `~/.browser-console-mcp/runtime.json`。
- **扩展没有连接**：在 `chrome://extensions` 刷新扩展，刷新目标页面，并确认 daemon 正在运行。

## 许可证

MIT
