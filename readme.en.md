# Browser Console MCP

Browser Console MCP lets MCP-compatible AI clients such as Cursor and Claude Desktop inspect and control browser pages through a local relay.

## Features

- Read page HTML, title, URL, and selected elements.
- Execute JavaScript in the page context.
- Click elements and fill inputs.
- Capture screenshots.
- Capture console logs and fetch/XHR network requests.
- Manage multiple browser sessions.

## How It Works

Browser Console MCP uses a local daemon plus a short-lived MCP stdio adapter:

1. **MCP stdio adapter**: launched by Cursor or Claude Desktop, forwards tool calls to the daemon.
2. **Local daemon**: owns HTTP, WebSocket, status pages, session registry, and browser routing.
3. **Browser entry**: connects pages to the daemon through one of three entry modes.

All browser commands stay on your machine.

## Usage

### Step 1: Start The Relay

The daemon starts automatically when your MCP client launches the package. You can also run it manually:

```bash
npx browser-console-mcp
```

Open `http://localhost:7898` to view daemon status, sessions, and setup instructions.

### Step 2: Connect Your Browser

All three entry modes share the same daemon, protocol, and page agent.

#### Option A: Console Or Bookmarklet

Drag the **Browser MCP** bookmarklet from `http://localhost:7898` to your bookmarks bar, then click it on any page.

Or paste this in the browser console:

```javascript
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

This is best for temporary debugging. Full page reloads or cross-page navigation may require reinjection.

#### Option B: Frontend Dependency Or Vite Plugin

For your own frontend project:

```ts
import { browserConsoleMCP } from 'browser-console-mcp/vite';

export default {
  plugins: [browserConsoleMCP()]
};
```

The plugin only applies in dev server mode and injects the page agent into the real page JavaScript context.

#### Option C: Chrome Extension

Load the repository `extension/` directory as an unpacked Chrome extension. This is recommended for third-party sites, MPA pages, multiple tabs, and automatic reinjection after navigation.

To package the extension:

```bash
pnpm package:extension
```

The generated `extension.zip` is a build artifact and should not be committed.

### Step 3: Configure Your MCP Client

Cursor, `~/.cursor/mcp.json`:

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

Claude Desktop, `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

## Tools

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
| `getConsoleLogs` | Read captured console logs |
| `getNetworkRequests` | Read captured fetch/XHR requests |
| `clearBrowserDiagnostics` | Clear captured console and network diagnostics |
| `listBrowserSessions` | List connected browser sessions |
| `selectBrowserSession` | Select the active browser session |

## Troubleshooting

- **No browser connection**: make sure one browser entry mode is active. `http://localhost:7898` shows live sessions.
- **Wrong tab selected**: call `listBrowserSessions`, then `selectBrowserSession({ sessionId: "..." })`.
- **Screenshot is blank**: try `captureScreenshot({ selector: ".main-content" })`. Some pages block canvas rendering.
- **Port conflict**: change `PORT` in the MCP config. Runtime state is stored in `~/.browser-console-mcp/runtime.json`.
- **Extension does not connect**: reload the extension in `chrome://extensions`, reload the target page, and verify the daemon is running.

## License

MIT
