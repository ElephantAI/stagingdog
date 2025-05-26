#!/usr/bin/env python
import asyncio
from mcp.client.streamable_http import streamablehttp_client
from mcp.client.session import ClientSession
from mcp.types import ( Implementation)
from dotenv import load_dotenv
import os
import json


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
            print(f"✅ Session initialized! Session ID: {session_id}")
            tools = await session.list_tools()
            print(f"tools are : {json.dumps([tool.__dict__ for tool in tools.tools],indent=2)}")
            assert isinstance(tools.tools,list)

        # Optional: you can now send `tools/list`, `callTool`, etc. manually

def test_initialize():
    asyncio.run(main())

if __name__ == "__main__":
    test_initialize()
