import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
} from 'mcp-handler';
 
const handler = protectedResourceHandler({
  authServerUrls: ['https://example-authorization-server-issuer.com'],
  resourceUrl: 'https://my-mcp-server.vercel.app/api/mcp',
});
 
const corsHandler = metadataCorsOptionsRequestHandler();
 
export { handler as GET, corsHandler as OPTIONS };