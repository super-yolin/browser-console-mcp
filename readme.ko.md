# Browser Console MCP

Browser Console MCP는 Cursor, Claude Desktop 같은 MCP 호환 AI 클라이언트가 로컬 릴레이를 통해 브라우저 페이지를 검사하고 제어할 수 있게 해줍니다.

## 기능

- 페이지 HTML, 제목, URL, 선택한 요소 읽기.
- 페이지 컨텍스트에서 JavaScript 실행.
- 요소 클릭 및 입력 필드 작성.
- 페이지 또는 특정 요소 스크린샷 캡처.
- 콘솔 로그와 fetch/XHR 네트워크 요청 캡처.
- 여러 브라우저 session 관리.

## 동작 방식

Browser Console MCP는 로컬 상주 daemon과 짧게 실행되는 MCP stdio adapter로 구성됩니다.

1. **MCP stdio adapter**: Cursor 또는 Claude Desktop이 실행하며 tool 호출을 daemon으로 전달합니다.
2. **Local daemon**: HTTP, WebSocket, 상태 페이지, session registry, 브라우저 라우팅을 담당합니다.
3. **Browser entry**: 세 가지 진입 방식 중 하나로 페이지를 daemon에 연결합니다.

모든 브라우저 명령은 로컬 머신 안에서 처리됩니다.

## 사용 방법

### 1단계: 릴레이 시작

MCP 클라이언트가 패키지를 실행하면 daemon이 자동으로 시작됩니다. 수동으로도 실행할 수 있습니다.

```bash
npx browser-console-mcp
```

`http://localhost:7898` 을 열면 daemon 상태, session, 설정 안내를 볼 수 있습니다.

### 2단계: 브라우저 연결

세 가지 진입 방식은 같은 daemon, protocol, Page Agent를 공유합니다.

#### Option A: Console 또는 북마크릿

`http://localhost:7898` 의 **Browser MCP** 북마크릿을 북마크 바로 끌어 놓고, 원하는 페이지에서 클릭하세요.

또는 브라우저 콘솔에 붙여넣습니다.

```javascript
var s = document.createElement('script');
s.src = 'http://localhost:7898/browser-inject.js';
document.head.appendChild(s);
```

임시 디버깅에 적합합니다. 전체 페이지 새로고침이나 다른 페이지로 이동한 뒤에는 다시 주입해야 할 수 있습니다.

#### Option B: 프론트엔드 의존성 또는 Vite 플러그인

자신의 프론트엔드 프로젝트에서 사용합니다.

```ts
import { browserConsoleMCP } from 'browser-console-mcp/vite';

export default {
  plugins: [browserConsoleMCP()]
};
```

이 플러그인은 dev server 모드에서만 동작하며 Page Agent를 실제 페이지 JavaScript 컨텍스트에 주입합니다.

#### Option C: Chrome 확장

Chrome에서 이 저장소의 `extension/` 디렉터리를 unpacked extension으로 로드합니다. 서드파티 사이트, MPA, 여러 탭, 탐색 후 자동 재주입에 권장됩니다.

확장 패키징:

```bash
pnpm package:extension
```

생성되는 `extension.zip` 은 빌드 산출물이므로 git에 커밋하지 마세요.

### 3단계: MCP 클라이언트 설정

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

## 도구

| 도구 | 설명 |
|------|------|
| `executeJS` | 페이지 컨텍스트에서 JavaScript 실행 |
| `getPageHTML` | 전체 페이지 HTML 가져오기 |
| `getPageTitle` | 페이지 제목 가져오기 |
| `getPageURL` | 현재 URL 가져오기 |
| `getElements` | CSS 선택자로 요소 검색 |
| `captureScreenshot` | 페이지 또는 특정 요소 스크린샷 |
| `clickElement` | CSS 선택자로 요소 클릭 |
| `inputText` | input 또는 textarea에 텍스트 입력 |
| `getConsoleLogs` | 캡처된 콘솔 로그 읽기 |
| `getNetworkRequests` | 캡처된 fetch/XHR 요청 읽기 |
| `clearBrowserDiagnostics` | 콘솔 및 네트워크 진단 지우기 |
| `listBrowserSessions` | 연결된 브라우저 session 목록 |
| `selectBrowserSession` | 활성 브라우저 session 선택 |

## 문제 해결

- **브라우저 연결 없음**: 세 가지 브라우저 진입 방식 중 하나가 활성화되어 있는지 확인하세요. `http://localhost:7898` 에서 live session을 볼 수 있습니다.
- **잘못된 탭을 조작함**: `listBrowserSessions` 를 호출한 뒤 `selectBrowserSession({ sessionId: "..." })` 를 호출하세요.
- **스크린샷이 비어 있음**: `captureScreenshot({ selector: ".main-content" })` 를 시도하세요. 일부 페이지는 canvas 렌더링을 차단합니다.
- **포트 충돌**: MCP 설정의 `PORT` 를 변경하세요. runtime state는 `~/.browser-console-mcp/runtime.json` 에 저장됩니다.
- **확장이 연결되지 않음**: `chrome://extensions` 에서 확장을 새로고침하고, 대상 페이지를 새로고침한 뒤 daemon이 실행 중인지 확인하세요.

## 라이선스

MIT
