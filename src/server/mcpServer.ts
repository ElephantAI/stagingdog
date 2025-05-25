// src/server/mcpServer.ts
import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { Session, sessionStore } from './sessionStore.js'

import { ok as assert } from 'assert'

export function createMcpServerApp(options: { 
                                      defineTools?: (server:McpServer) => void;
                                      sessionInitHook?: (session:Session) => Promise<void>;
                                      sessionEndHook?: (session:Session) => Promise<void>;
                                  }): express.Router {
  const router = express.Router();

  // Ensure body parsing (needed for POST /mcp)
  router.use(express.json());

  // MCP POST
  router.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    let session:Session|undefined = undefined;
    if (sessionId && (session=sessionStore.getSession(sessionId))) {
      transport = session.transport
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessionStore.createSession(newSessionId,transport,{})
        },
      });

      transport.onclose = async () => {
        if (transport.sessionId) {
          const session = sessionStore.getSession(transport.sessionId)
          if (session) {
            if (options.sessionEndHook) {
              await options.sessionEndHook(session);
            }
            sessionStore.deleteSession(transport.sessionId)
          }
        }
      };

      const mcpServer = new McpServer({
        name: 'example-server',
        version: '1.0.0',
      });

      if (options?.defineTools) {
        options.defineTools(mcpServer);
      }

      await mcpServer.connect(transport);
      const sessionId = transport.sessionId;
      assert(sessionId,"No sessionId in a connected transport?")
      const session = sessionStore.getSession(sessionId);
      assert(session,`SessionId ${sessionId} was not added to SessionStore during McpServer.connect?`)
      if (options.sessionInitHook) {
        await options.sessionInitHook(session);
      }

    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // MCP GET/DELETE
  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let session:Session|undefined = undefined;
    if (!sessionId || !(session = sessionStore.getSession(sessionId))) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = session.transport
    await transport.handleRequest(req, res);
  };

  router.get('/mcp', handleSessionRequest);
  router.delete('/mcp', handleSessionRequest);

  return router;
}
