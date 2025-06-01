
import { z } from 'zod';
import { Session, AsyncSessionLifecycleHook, sessionStore } from '../../common/sessionStore.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import { ServerNotification, ServerRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ok as assert } from 'assert'
import { Browser, NavigationParams, NavigationResult, navigationParamsShape, navigationResultShape } from '../../services/browser.js'

type ExtraData = RequestHandlerExtra<ServerRequest,ServerNotification>;


async function requireSession(tool_name: string, extra:ExtraData): Promise<Session> {
    assert(extra.sessionId,`calling tool ${tool_name} requires a session`)
    const session = sessionStore.getSession(extra.sessionId);
    if (!session) throw new Error('invalid sessionId');
    await session.waitUntilInitialized();
    return session
}

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
    const session = await requireSession('imagine',extra);
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
    const session = await requireSession('isLessThan',extra);
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
    const session = await requireSession('guess',extra);
    if (typeof session?.data.imaginedNumber !== 'number') throw new Error('No number imagined yet');
    const result:CallToolResult = { structuredContent: { correct: (Math.floor(session.data.imaginedNumber) === Math.floor(n)) } }
    return result
  });

  // reveal
  server.registerTool('reveal', {
    description: 'Reveal the imagined number',
    inputSchema: { 
      // buggy:z.string().describe("this is only here because an empty input schema causes problems").optional()
    },
    outputSchema: {
      secret: z.number(),
    },
  }, async ( _p, extra:ExtraData) => {
    const session = await requireSession('reveal',extra);
    // if (buggy) {} // having no inputSchema defined causes weird behavior
    if (typeof session?.data.imaginedNumber !== 'number') throw new Error('No number imagined yet');
    const result:CallToolResult = { structuredContent: { secret: session.data.imaginedNumber } }
    return result
  });

  // Real tools start here
  server.registerTool('navigateTo', {
    description: 'Pick a random number between lower and upper',
    inputSchema: navigationParamsShape,
    outputSchema: navigationResultShape
  }, async (inputParams:NavigationParams, extra:ExtraData) => {
    const session = await requireSession('imagine',extra);
    const browser:Browser = session.data.browser as Browser;
    assert(browser, `browser not initialized in session ${session.id}`)
    
    const navigationResult:NavigationResult = await browser.navigateToPage(inputParams)
    const result:CallToolResult = { structuredContent: navigationResult }
    return result
  });
}

// Ensure that each session has its own stagehand Browser instance
export const sessionInitHook:AsyncSessionLifecycleHook = async (session:Session):Promise<void> => {
  console.log("in sessionInitHook")
  if (session.data.browser) { throw new Error(`browser already initialized in session ${session.id}`) }
  console.log(`Creating a new stagehand browser for session ${session.id}`)
  const browser = new Browser();
  await browser.init();
  session.data.browser = browser
  console.log(`Just set browser in session ${session.id}`)
  const session2 = sessionStore.getSession(session.id);
  assert(session2, `cannot find session ${session.id} in sessionStore?`)
  const browser2:Browser = session2.data.browser as Browser;
  if (browser2) {
    console.log(`the browser is definitely set in the store for session ${session.id}`)
  } else {
    console.log(`ERROR: the browser is not set in the store for session ${session.id}`)
  } 
}

export const sessionEndHook:AsyncSessionLifecycleHook = async (session:Session):Promise<void> => {
  console.log("in sessionEndHook")
  if (session.data.browser) { 
    if (session.data.browser instanceof Browser === false) { throw new Error(`browser session data not of type Browser in session ${session.id}`) }
    const browser:Browser = session.data.browser as Browser;
    console.log(`releasing a stagehand browser for session ${session.id}`)
    await browser.release();
    session.data.browser = undefined
  }
}



