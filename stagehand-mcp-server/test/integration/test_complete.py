#!/usr/bin/env python
import asyncio
from mcp.client.streamable_http import streamablehttp_client
from mcp.client.session import ClientSession
from mcp.types import ( CallToolResult, Implementation)
from dotenv import load_dotenv
from typing import Any
import os
import copy


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
            guess_range = { "upper": 128, "lower": 1}
            remaining_range = copy.deepcopy(guess_range)

            # call the imagine tool with upper and lower bounds as args
            result:CallToolResult = await session.call_tool(
                name="imagine",
                arguments=guess_range
            )
            returned_structured_content:Any = getattr(result,"structuredContent",None)
            assert returned_structured_content
            assert isinstance(returned_structured_content, dict)
            assert returned_structured_content == guess_range

            num_guesses = 0
            while remaining_range["upper"] >= remaining_range["lower"]:
                midpoint:int = int((remaining_range["upper"] + remaining_range["lower"])/2)
                print(f"midpoint is {midpoint}")
                num_guesses += 1
                if midpoint < remaining_range["lower"] or remaining_range["lower"] == remaining_range["upper"]:
                    midpoint = remaining_range["lower"]
                    result = await session.call_tool( name="guess", arguments = { "n": midpoint})
                    print(f"called guess with {midpoint} and got {result}")
                    returned_structured_content = getattr(result,"structuredContent",None)
                    assert returned_structured_content
                    assert isinstance(returned_structured_content, dict)
                    assert "correct" in returned_structured_content
                    assert isinstance(returned_structured_content["correct"],bool)
                    if returned_structured_content["correct"]:
                        print(f"I took {num_guesses} for a range of {guess_range['upper'] - guess_range['lower']}")
                        break
                    else:
                        raise RuntimeError(f"How did we end up with this range? {remaining_range}")
                else:
                    if midpoint == remaining_range["lower"]:
                        midpoint += 1
                    result = await session.call_tool( name="isLessThan", arguments = { "n": midpoint})
                    print(f"called isLessThan with {midpoint} and got {result}")
                    returned_structured_content = getattr(result,"structuredContent",None)
                    assert returned_structured_content
                    assert isinstance(returned_structured_content, dict)
                    assert "isLess" in returned_structured_content
                    assert isinstance(returned_structured_content["isLess"],bool)
                    if returned_structured_content["isLess"]:
                        remaining_range["upper"] = midpoint-1
                    else:
                        remaining_range["lower"] = midpoint
                    print(f"remaining_range is now {remaining_range}")

def test_imagine():
    asyncio.run(main())

if __name__ == "__main__":
    test_imagine()
