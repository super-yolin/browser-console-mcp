/**
 * Static File Server
 *
 * Used to serve client JS files
 */

import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

export class StaticFileServer {
	private server: http.Server;
	private port: number;
	private clientJsPath: string;

	constructor(
		port = 3001,
		clientJsPath: string = path.join(
			process.cwd(),
			"dist",
			"client",
			"browser-console-mcp.js",
		),
	) {
		this.port = port;
		this.clientJsPath = clientJsPath;
		this.server = http.createServer(this.handleRequest.bind(this));
	}

	/**
	 * Get server port
	 */
	getPort(): number {
		return this.port;
	}

	/**
	 * Handle HTTP requests
	 */
	private handleRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	): void {
		// Set CORS headers, allow access from any origin
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
		res.setHeader(
			"Access-Control-Allow-Headers",
			"Origin, X-Requested-With, Content-Type, Accept",
		);

		// Handle preflight requests
		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}

		// Only handle GET requests
		if (req.method !== "GET") {
			res.writeHead(405, { "Content-Type": "text/plain" });
			res.end("Method Not Allowed");
			return;
		}

		// Get request path
		const requestPath = req.url || "/";

		// Serve client JS file
		if (requestPath === "/browser-console-mcp.js") {
			this.serveClientJs(res);
		}
		// Serve html2canvas file
		else if (requestPath === "/html2canvas.min.js") {
			this.serveStaticFile(
				path.join(process.cwd(), "dist", "static", "html2canvas.min.js"),
				"application/javascript",
				res,
			);
		}
		// Try to serve files from static directory
		else if (requestPath.startsWith("/static/")) {
			const filePath = path.join(process.cwd(), "dist", requestPath);
			const contentType = this.getContentType(filePath);
			this.serveStaticFile(filePath, contentType, res);
		} else {
			// Return a simple HTML page explaining how to use
			this.serveIndexPage(res);
		}
	}

	/**
	 * Serve client JS file
	 */
	private serveClientJs(res: http.ServerResponse): void {
		this.serveStaticFile(this.clientJsPath, "application/javascript", res);
	}

	/**
	 * Serve index page
	 */
	private serveIndexPage(res: http.ServerResponse): void {
		const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Browser Console MCP</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        pre {
          background-color: #f5f5f5;
          padding: 10px;
          border-radius: 5px;
          overflow-x: auto;
        }
        code {
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <h1>Browser Console MCP</h1>
      <p>This is the Browser Console MCP static file server.</p>
      <p>Client JS file is available at the following URL:</p>
      <pre><code>http://localhost:${this.port}/browser-console-mcp.js</code></pre>
      
      <h2>Usage</h2>
      <p>Paste the following code in your browser console:</p>
      <pre><code>// Load client script
const script = document.createElement('script');
script.src = 'http://localhost:${this.port}/browser-console-mcp.js';
document.head.appendChild(script);</code></pre>
      
      <p>Then interact with the server using these commands:</p>
      <pre><code>// Execute command
mcp.exec('ls -la');

// View help
mcp.help();

// Disconnect
mcp.disconnect();

// Reconnect
mcp.reconnect();</code></pre>
    </body>
    </html>
    `;

		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(html);
	}

	/**
	 * Serve html2canvas file
	 */
	private serveStaticFile(
		filePath: string,
		contentType: string,
		res: http.ServerResponse,
	): void {
		try {
			if (fs.existsSync(filePath)) {
				const fileContent = fs.readFileSync(filePath);
				// Set correct content type and cache control headers
				res.writeHead(200, {
					"Content-Type": contentType,
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
					Expires: "0",
				});
				res.end(fileContent);
				console.info(
					`[Static Server] Successfully served static file: ${filePath}`,
				);
			} else {
				console.error(`[Static Server] Static file not found: ${filePath}`);
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("File not found");
			}
		} catch (error) {
			console.error("[Static Server] Error serving static file:", error);
			res.writeHead(500, { "Content-Type": "text/plain" });
			res.end("Internal Server Error");
		}
	}

	/**
	 * Start server
	 */
	start(): void {
		this.server.listen(this.port, () => {
			console.info(
				`[Static Server] Server started, listening on port ${this.port}`,
			);
			console.info(
				`[Static Server] Client JS file URL: http://localhost:${this.port}/browser-console-mcp.js`,
			);
		});
	}

	/**
	 * Stop server
	 */
	stop(): void {
		this.server.close(() => {
			console.info("[Static Server] Server closed");
		});
	}

	/**
	 * Get content type based on file extension
	 */
	private getContentType(filePath: string): string {
		const ext = path.extname(filePath).toLowerCase();

		switch (ext) {
			case ".html":
				return "text/html";
			case ".js":
				return "application/javascript";
			case ".css":
				return "text/css";
			case ".json":
				return "application/json";
			case ".png":
				return "image/png";
			case ".jpg":
			case ".jpeg":
				return "image/jpeg";
			case ".gif":
				return "image/gif";
			case ".svg":
				return "image/svg+xml";
			case ".ico":
				return "image/x-icon";
			default:
				return "application/octet-stream";
		}
	}
}

export default StaticFileServer;
