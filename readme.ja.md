# Browser Console MCP

Browser Console MCP は、Cursor や Claude Desktop などの MCP 対応 AI クライアントが、ローカル中継経由でブラウザページを検査・操作できるようにします。

## 機能

- ページ HTML、タイトル、URL、指定要素を取得。
- ページコンテキストで JavaScript を実行。
- 要素のクリックと入力欄への入力。
- ページまたは指定要素のスクリーンショット。
- コンソールログと fetch/XHR ネットワークリクエストの取得。
- 複数ブラウザ session の管理。

## 仕組み

Browser Console MCP は、ローカル常駐 daemon と短命な MCP stdio adapter で構成されます。

1. **MCP stdio adapter**: Cursor または Claude Desktop から起動され、tool 呼び出しを daemon に転送します。
2. **Local daemon**: HTTP、WebSocket、ステータスページ、session registry、ブラウザルーティングを担当します。
3. **Browser entry**: 3 種類の入口のいずれかでページを daemon に接続します。

すべてのブラウザ操作はローカルマシン内で処理されます。

## 使い方

### Step 1: 中継を起動

MCP クライアントがパッケージを起動すると daemon も自動的に起動します。手動でも実行できます。

```bash
npx browser-console-mcp
```

`http://localhost:7898` を開くと、daemon の状態、session、セットアップ手順を確認できます。

### Step 2: ブラウザを接続

3 種類の入口は、同じ daemon、protocol、Page Agent を共有します。

#### Option A: Console またはブックマークレット

`http://localhost:7898` の **Browser MCP** ブックマークレットをブックマークバーにドラッグし、任意のページでクリックします。

またはブラウザコンソールに貼り付けます。

```javascript
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

一時的なデバッグに向いています。ページ全体の再読み込みや別ページへの遷移後は、再注入が必要になる場合があります。

#### Option B: フロントエンド依存関係または Vite プラグイン

自分のフロントエンドプロジェクトで使用します。

```ts
import { browserConsoleMCP } from 'browser-console-mcp/vite';

export default {
  plugins: [browserConsoleMCP()]
};
```

このプラグインは dev server モードでのみ有効になり、Page Agent を実際のページ JavaScript コンテキストに注入します。

#### Option C: Chrome 拡張

Chrome でこのリポジトリの `extension/` ディレクトリを unpacked extension として読み込みます。第三者サイト、MPA、複数タブ、ナビゲーション後の自動再注入に推奨されます。

拡張をパッケージ化するには：

```bash
pnpm package:extension
```

生成される `extension.zip` はビルド成果物なので、git にコミットしないでください。

### Step 3: MCP クライアントを設定

Cursor、`~/.cursor/mcp.json`：

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

Claude Desktop、`~/Library/Application Support/Claude/claude_desktop_config.json`：

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

## ツール

| ツール | 説明 |
|--------|------|
| `executeJS` | ページコンテキストで JavaScript を実行 |
| `getPageHTML` | ページ全体の HTML を取得 |
| `getPageTitle` | ページタイトルを取得 |
| `getPageURL` | 現在の URL を取得 |
| `getElements` | CSS セレクタで要素を検索 |
| `captureScreenshot` | ページまたは指定要素のスクリーンショット |
| `clickElement` | CSS セレクタで要素をクリック |
| `inputText` | input または textarea にテキストを入力 |
| `getConsoleLogs` | 取得済みのコンソールログを読む |
| `getNetworkRequests` | 取得済みの fetch/XHR リクエストを読む |
| `clearBrowserDiagnostics` | コンソールとネットワーク診断をクリア |
| `listBrowserSessions` | 接続中のブラウザ session を一覧表示 |
| `selectBrowserSession` | アクティブなブラウザ session を選択 |

## トラブルシューティング

- **ブラウザ接続がない**: いずれかのブラウザ入口が有効か確認してください。`http://localhost:7898` で live session を確認できます。
- **誤ったタブを操作している**: `listBrowserSessions` の後に `selectBrowserSession({ sessionId: "..." })` を呼び出してください。
- **スクリーンショットが空白**: `captureScreenshot({ selector: ".main-content" })` を試してください。一部ページは canvas 描画をブロックします。
- **ポート競合**: MCP 設定の `PORT` を変更してください。runtime state は `~/.browser-console-mcp/runtime.json` に保存されます。
- **拡張が接続しない**: `chrome://extensions` で拡張を再読み込みし、対象ページを再読み込みして、daemon が起動していることを確認してください。

## ライセンス

MIT
