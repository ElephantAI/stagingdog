
import { z } from 'zod';
import { Session, sessionStore } from '../sessionStore.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import { ServerNotification, ServerRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ok as assert } from 'assert'

type ExtraData = RequestHandlerExtra<ServerRequest,ServerNotification>;

function requireSession(tool_name: string, extra:ExtraData):Session {
    assert(extra.sessionId,`calling tool ${tool_name} requires a session`)
    const session = sessionStore.getSession(extra.sessionId);
    if (!session) throw new Error('invalid sessionId');
    return session
}

function mcpObjectResult(resultObject: object):CallToolResult {
    return { content: [{ type: "text", text: JSON.stringify(resultObject) }] }
}

/*
function mcpTextResult(resultText: string):CallToolResult {
    return { content: [{ type: "text", text: resultText }] }
}
*/


export function defineTools(server: McpServer): void {
  // imagine
  server.registerTool('imagine', {
    description: 'Pick a random number between lower and upper',
    inputSchema: {
      lower: z.number(),
      upper: z.number(),
    },
    outputSchema: {
      lower: z.number(),
      upper: z.number()
    }
  }, async ({ lower, upper }, extra:ExtraData) => {
    const session = requireSession('imagine',extra);
    const n = Math.floor(Math.random() * (upper - lower + 1)) + lower;
    session.data.imagineRange = { lower, upper };
    session.data.imaginedNumber = n
    
    const result:CallToolResult = { structuredContent: {lower, upper} }
    return result
  });

  // isLessThan
  server.registerTool('isLessThan', {
    description: 'Ask if the imagined number is less than the given number',
    inputSchema: {
      n: z.number(),
    },
    outputSchema: {
      isLess: z.boolean(),
    },
  }, async ({ n }, extra:ExtraData ) => {
    const session = requireSession('isLessThan',extra);
    if (typeof session.data.imaginedNumber !== 'number') throw new Error('No number imagined yet');
    const imagineRange = session.data.imagineRange as {lower:number,upper:number};
    assert(!(session.data.imaginedNumber > imagineRange.upper || session.data.imaginedNumber < imagineRange.lower),`imaginedNumber ${session.data.imaginedNumber} is outside of range ${JSON.stringify(imagineRange)}`)
    
    const result:CallToolResult = { structuredContent: { isLess: Math.floor(session.data.imaginedNumber) < Math.floor(n) } }
    return result
  });

  // guess
  server.registerTool('guess', {
    description: 'Guess the imagined number',
    inputSchema: {
      n: z.number(),
    },
    outputSchema: {
      correct: z.boolean(),
    },
  }, async ({ n }, extra:ExtraData) => {
    const session = requireSession('guess',extra);
    if (typeof session?.data.imaginedNumber !== 'number') throw new Error('No number imagined yet');
    const result:CallToolResult = { structuredContent: { correct: (Math.floor(session.data.imaginedNumber) === Math.floor(n)) } }
    return result
  });

  // reveal
  server.registerTool('reveal', {
    description: 'Reveal the imagined number',
    outputSchema: {
      secret: z.number(),
    },
  }, async (_input, extra:ExtraData) => {
    const session = requireSession('reveal',extra);
    if (typeof session?.data.secret !== 'number') throw new Error('No number imagined yet');
    const result:CallToolResult = { structuredContent: { secret: session.data.secret } }
    return result
  });
}

