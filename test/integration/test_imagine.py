#!/usr/bin/env python
import asyncio
from mcp.client.streamable_http import streamablehttp_client
from mcp.client.session import ClientSession
from mcp.types import ( CallToolResult, Implementation)
from dotenv import load_dotenv
from typing import Any
import os


load_dotenv("../../.env.test")

SERVER_PORT= int(os.getenv('PORT') or '3088')

async def main():
    url = f"http://localhost:{SERVER_PORT}/mcp"
    
    # Set up the transport
    async with streamablehttp_client(url) as (read,write,get_session_id_callback):
        async with ClientSession(read,write, client_info=Implementation(name="mcp-test-client", version="0.1.0")) as session:
            await session.initialize()
            session_id = get_session_id_callback()
            assert session_id
            # call the imagine tool with upper and lower bounds as args
            result:CallToolResult = await session.call_tool(
                name="imagine",
                arguments={
                    "upper": 10,
                    "lower": 1
                }
            )
            structured_content:Any = getattr(result,"structuredContent",None)
            assert structured_content
            #print (f"result is : {result}")
            #print (f"result.structuredContent is : {result.structuredContent}")
            #print (f"result.content is : {result.content}")
            assert isinstance(structured_content, dict)
            assert structured_content["upper"] == 10
            assert structured_content["lower"] == 1



        # Optional: you can now send `tools/list`, `callTool`, etc. manually

def test_imagine():
    asyncio.run(main())

if __name__ == "__main__":
    test_imagine()
