// RePassa agent orchestrator - MCP stdio server.
// All logs go to stderr; stdout is reserved for the JSON-RPC channel.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { registerTools } from './tools.js';
import { assertLocalUrl } from './safety.js';

async function main() {
  const loaded = loadConfig();
  try {
    assertLocalUrl(loaded.config.gateway.baseUrl, loaded.config.safety.localhostOnly);
  } catch (err) {
    process.stderr.write(`[orchestrator] unsafe gateway config: ${(err as Error).message}\n`);
    process.exit(2);
  }
  const server = new McpServer({ name: 'repassa-orchestrator', version: '0.1.0' });
  registerTools(server, loaded);
  await server.connect(new StdioServerTransport());
  process.stderr.write(`[orchestrator] ready (mode=${loaded.config.safety.mode}, config=${loaded.configPath})\n`);
}

main().catch((err) => {
  process.stderr.write(`[orchestrator] fatal: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
