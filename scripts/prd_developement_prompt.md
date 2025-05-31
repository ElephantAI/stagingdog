## ChatGPT Deep Research Initial Prompt:
I need to figure out how to set up a stateful MCP server serving over HTTP SSE.
All of the example code I can find is moving too fast in an uncoordinated way and there does not seem to be any complete documentation on stateful mcp-session-id handling.
- I know I want to start with the typescript reference implementation of the MCP server https://github.com/modelcontextprotocol/typescript-sdk.
- I know I will want to eventually call it from the OpenAI Agents SDK: https://github.com/openai/openai-agents-python
- I know that I'll need stateful connection capability because I'm eventually going to create a browser user MCP server to be invoked by an OpenAI Agent and that will have to chain together navigations and click actions in subsequent calls.
- Initially, I just want to implement a toy server that does nothing but return some stateful information (/call/imagine generates random text and stores it in in-memory variables, /call/reveal returns the text generated during previous imagine call).
- I also initially want to implement a typescript client to integration test my toy MCP server using import { Client } from "@modelcontextprotocol/sdk/client/index.js" so that I can be certain the server I implemented is 100% compliant with protocol expectations.

## Huge research report ensues...

## User followup prompt
Now I'm getting more confusion.  I have been advised by various models and various online tutorials to create a vast variety of routes for the exact same functionality.  Sometimes its /function1, sometimes /tools/call POST { "method": "function1"...}, sometimes /call/function1, sometimes "/mcp/" POST { "method": "function1 ...}

It's all over the place.  I guess I'll just have to create a server and client with the reference implementation SDK and inspect what's getting sent over the wire between them to figure out WTF is going on.

## MCP server routing treatise ensues...

## User final prompt
OK, let's write a PRD.md that describes the toy mcp server and integration testing client combo.
I want one that's ready-made for use with task-master-ai.  Here is the PRD template I want to use.
Please generate quoted markdown that I can copy and paste as markdown source.

__paste content of **example_prd.txt**_
