// AdForge tools for Claude. Stdio only. Reads and drafts. Does not send a post.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { agentHandlers } from "@/lib/api";
import { toolCatalog } from "@/lib/api/catalog";

export function createAdforgeServer() {
  const server = new McpServer({ name: "adforge", version: "1.0.0" });
  for (const tool of toolCatalog) {
    const run = agentHandlers[tool.name];
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.input }, async (args: object) => {
      try {
        const data = await run({ ...args, actor: "claude" });
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
      } catch (error) {
        return {
          isError: true as const,
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Tool failed" }],
        };
      }
    });
  }
  return server;
}

function main() {
  const server = createAdforgeServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

if (process.argv[1]?.includes("adforge-server")) main();
