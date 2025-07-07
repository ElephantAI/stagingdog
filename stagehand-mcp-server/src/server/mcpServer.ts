// src/server/mcpServer.ts
import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Session, AsyncSessionLifecycleHook, sessionStore } from '../common/sessionStore.js'

import { ok as assert } from 'assert'


function problemsWithInitializeParams(req: any): string|undefined {
  const problems: string[] = [];

  const params = req.body?.params;
  if (typeof params !== 'object' || params === null) {
    problems.push('Missing or invalid "params" — expected an object.');
  } else {
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
            }
          }
        }'
    */

   const problems:Array<string> = []
   if (req.body.jsonrpc == 'undefined') problems.push('initialize call must specify jsonrpc version');
   if (req.body.id == 'undefined') problems.push('initialize call must specify an id');
   if (req.body.method !== "initialize") problems.push('method must be initialize');
   const paramsProblems = problemsWithInitializeParams(req);
   if (paramsProblems) problems.push(paramsProblems);
   return problems
}

function looksLikeInitializeRequest(req_body: { method: string }): boolean {
  return req_body?.method === 'initialize';
}

let sessionLifetimeMs:number = process.env.SESSION_LIFETIME_MS ? parseInt(process.env.SESSION_LIFETIME_MS) : 30*60*1000; // 30 minutes default

async function reapStaleSessions(sessionEndHook: AsyncSessionLifecycleHook|undefined): Promise<void> {

  console.log("reaping loop")
  for (const session of sessionStore.expiredSessions(sessionLifetimeMs)) {
    console.log(`reaping stale session ${session.id}`);
    if (sessionEndHook) {
      await sessionEndHook(session)
    }
    sessionStore.deleteSession(session.id)
  }
}

export function createMcpServerApp(options: { 
                                      defineTools?: (server:McpServer) => void;
                                      sessionInitHook?: AsyncSessionLifecycleHook;
                                      sessionEndHook?: AsyncSessionLifecycleHook;
                                  }): express.Router {
  const router = express.Router();

  // Ensure body parsing (needed for POST /mcp)
  router.use(express.json());

  // MCP POST
  router.post('/mcp', async (req, res) => {

    console.log(`existing session ids are ${sessionStore.getAllSessionIds()}`);
    

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
    // console.log('looksLikeInitializeRequest:', looksLikeInitializeRequest(req.body));

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
      console.log("looksLikeInitializeRequest")
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => { const sessionId= randomUUID(); console.log(`generated sessionId ${sessionId}`); return sessionId; },
        onsessioninitialized: (newSessionId) => {
          console.log(`onsessioninitialized got called with ${newSessionId}`);
          const newSession = new Session(newSessionId,transport,{})
          sessionStore.add(newSession)
        },
      });

      // For some reason transport.onclose() does not get called when the transport is closed so I've put the session
      // deletion logic in the http DELETE handler.

      const mcpServer = new McpServer({
        name: 'example-server',
        version: '1.0.0',
      });

      if (options?.defineTools) {
        options.defineTools(mcpServer);
      }

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      console.log("handled the initialize request")

      const sessionId = transport.sessionId;
      assert(sessionId,"No sessionId in a connected transport?")
      const session = sessionStore.getSession(sessionId);
      assert(session,`SessionId ${sessionId} was not added to SessionStore session initialization?`)
      console.log("Checking initSessionHook")
      if (options.sessionInitHook) {
        console.log(`calling initSessionHook with session ${sessionId}`)
        session.initWith(options.sessionInitHook)
        await session.waitUntilInitialized()
        session.touch()
      } else {
        console.log("There is not a initSessionHook")
      }
      await reapStaleSessions(options.sessionEndHook);
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

  const handleGetSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let session:Session|undefined = undefined;
    if (!sessionId || !(session = sessionStore.getSession(sessionId))) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = session.transport
    await transport.handleRequest(req, res);
    await reapStaleSessions(options.sessionEndHook);
  };

  const handleDeleteSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    console.log(`handling a DELETE request with sessionId ${sessionId}`);
    let session:Session|undefined = undefined;
    if (!sessionId || !(session = sessionStore.getSession(sessionId))) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    const transport = session.transport
    if (options.sessionEndHook) {
        console.log(`calling sessionEndHook for ${sessionId}`)
        await options.sessionEndHook(session);
    }
    console.log(`deleting session ${sessionId}`); 
    await sessionStore.deleteSession(sessionId)
    if (typeof transport.close === 'function') {
      console.log("calling transport.close")
      await transport.close(); // This will call your transport.onclose
    } else {
      console.log("no transport.close function exists");
    }
    res.status(204).end(); // No Content
    await reapStaleSessions(options.sessionEndHook);
  };

  router.get('/mcp', handleGetSessionRequest);
  router.delete('/mcp', handleDeleteSessionRequest);

  return router;
}
