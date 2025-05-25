// src/server/mcpServer.ts
import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Session, sessionStore } from './sessionStore.js'

import { ok as assert } from 'assert'


function problemsWithInitializeParams(req: any): string|undefined {
  const problems: string[] = [];

  const params = req.body?.params;
  if (typeof params !== 'object' || params === null) {
    problems.push('Missing or invalid "params" — expected an object.');
  } else {
    if (! Array.isArray(params.tools) ) problems.push('Missing or invalid list of tools');

    if (typeof params.protocolVersion !== 'string') {
      problems.push('Missing or invalid "protocolVersion" — expected a string.');
    }

    if (typeof params.capabilities !== 'object' || params.capabilities === null) {
      problems.push('Missing or invalid "capabilities" — expected an object.');
    }

    if (typeof params.clientInfo !== 'object' || params.clientInfo === null) {
      problems.push('Missing or invalid "clientInfo" — expected an object.');
    } else {
      if (typeof params.clientInfo.name !== 'string') {
        problems.push('Missing or invalid "clientInfo.name" — expected a string.');
      }
      if (typeof params.clientInfo.version !== 'string') {
        problems.push('Missing or invalid "clientInfo.version" — expected a string.');
      }
    }
  }
  if (problems.length>0) {
    return `Invalid params for initialize: ${problems.join('\n')}`;
  } else {
    return undefined;
  }
}

function strictlyValidateRequestHeaders(req: express.Request): Array<string> {
   const specifiedHeaders = req.headers;
   console.log(`specified headers are ${JSON.stringify(specifiedHeaders, null, 2)}`);
   /* headers should look like this
    {
      "host": "localhost:3088",
      "user-agent": "curl/8.5.0",
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "content-length": "257"
    }
    */
   const problems:Array<string> = []
   if (!specifiedHeaders['content-type']?.match(/application\/json/i)) problems.push('content-type header must be application/json');
   if (!specifiedHeaders['accept']?.match(/application\/json/i)) problems.push('accept header must include application/json');
   if (!specifiedHeaders['accept']?.match(/text\/event-stream/i)) problems.push('accept header must include text/event-stream');
   return problems
}



// Checks that all of the required shit is there and throws an informative message if not
function strictlyValidateInitializeCall(req: express.Request): Array<string> {

    /* Strictly speaking, a valid initialize call should look like this:
     
     curl -i -X POST http://localhost:3088/mcp   \
        -H "Content-Type: application/json"   \
        -H "Accept: application/json, text/event-stream" \
        -d '{
          "jsonrpc": "2.0",
          "id": "1",
          "method": "initialize",
          "params": {
            "protocolVersion": "v0",
            "capabilities": {},
            "clientInfo": {
              "name": "curl-test",
              "version": "1.0.0"
            },
            "tools": ["*"]
          }
        }'
    */

   const problems:Array<string> = []
   if (!req.body.jsonrpc) problems.push('initialize call must specify jsonrpc version');
   if (!req.body.id) problems.push('initialize call must specify an id');
   if (req.body.method !== "initialize") problems.push('method must be initialize');
   const paramsProblems = problemsWithInitializeParams(req);
   if (paramsProblems) problems.push(paramsProblems);
   return problems
}

function looksLikeInitializeRequest(req_body: { method: string }): boolean {
  return req_body?.method === 'initialize';
}

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
    

    const requestHeaderProblems = strictlyValidateRequestHeaders(req);
    if (requestHeaderProblems.length>0) {
      console.log(`strictlyValidateRequestHeaders problems: ${requestHeaderProblems}`);
      res.status(400).json({
        error: {
          code: 40000,
          message: `Invalid request headers: [${requestHeaderProblems.join(", ")}]`,
        },
      });
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    console.log(`got a POST to /mcp: ${JSON.stringify(req.body, null, 2)}`);
    console.log('looksLikeInitializeRequest:', looksLikeInitializeRequest(req.body));

    if (looksLikeInitializeRequest(req.body)) {
      const problems:Array<string> = [];
      if (!isInitializeRequest(req.body) )  { problems.push("failed isInitializeRequest check") }
      const specificProblems= strictlyValidateInitializeCall(req);
      if (specificProblems) problems.push(...specificProblems);
      if (problems.length >0) {
        console.log(`strictlyValidateInitializeCall problems: ${problems}`);
        res.status(400).json({
          error: {
            code: 40001,
            message: `Invalid initialize call: ${problems.join(", ")}`,
          },
        });
        return;
      }
    }


    let session:Session|undefined = undefined;
    if (sessionId && (session=sessionStore.getSession(sessionId))) {
      transport = session.transport
      await transport.handleRequest(req, res, req.body);
      return;
    } else if (!sessionId && looksLikeInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => { const sessionId= randomUUID(); console.log(`generated sessionId ${sessionId}`); return sessionId; },
        onsessioninitialized: (newSessionId) => {
          console.log(`onsessioninitialized got called with ${newSessionId}`);
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
      await transport.handleRequest(req, res, req.body);

      const sessionId = transport.sessionId;
      assert(sessionId,"No sessionId in a connected transport?")
      const session = sessionStore.getSession(sessionId);
      assert(session,`SessionId ${sessionId} was not added to SessionStore session initialization?`)
      if (options.sessionInitHook) {
        await options.sessionInitHook(session);
      }
      return;
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
