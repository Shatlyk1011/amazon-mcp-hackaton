import type { AuthInfo } from '@modelcontextprotocol/server';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
 
const handler = createMcpHandler((server) => {
  server.registerTool(
    'roll_dice',
    {
      description: 'Roll an N-sided die',
      inputSchema: z.object({ sides: z.number().int().min(2) }),
    },
    async ({ sides }) => {
      const value = 1 + Math.floor(Math.random() * sides);
      return {
        content: [{ type: 'text', text: `🎲 You rolled a ${value}!` }],
      };
    },
  );
});
 
const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  if (!bearerToken || bearerToken !== process.env.MCP_DEMO_TOKEN) {
    return undefined;
  }
 
  return {
    token: bearerToken,
    scopes: ['read:dice'],
    clientId: 'demo-client',
  };
};
 
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ['read:dice'],
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});
 
export { authHandler as GET, authHandler as POST };