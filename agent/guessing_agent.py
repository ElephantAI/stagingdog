import asyncio
import os
from agents import Agent, MessageOutputItem, Runner, AgentHooks, enable_verbose_stdout_logging, StreamEvent, RunItemStreamEvent, ToolCallItem, function_tool, set_tracing_disabled
from agents.mcp import MCPServer, MCPServerStreamableHttp
from dotenv import load_dotenv
import logging
import json

from typing import cast, Any

from openai.types.responses import ResponseOutputMessage, ResponseOutputText

logger = logging.getLogger(__name__)

agent_instructions = """
    You are a web app explorer and analyst.
    Your goal is to navigate through the site in a methodical way as the user would, 
    writing an analysis of each page/view you encounter until you reach max_turns.

    You will analyzing this website: https://staging.elephantllm.com.

    **Navigation**

    In order to navigate the site, you will use the navigateTo tool on the MCP server.
    After navigating to the first page, use the performActions tool to perform actions like filling forms and clicking buttons to navigate through the site as a curious user would.
    With each navigation or action that is expected to change the page content, request a screenshot in 1080p
    resolution so you can visually examine the new content.
    Take any actions that do NOT require signing in. 
    
    
    **Analysis**
    
    When performing your analysis: 
    - Try to guess the purpose of the web app, its intended audience, what 
    they would be trying to do with it, etc.
    - Vocalize your impressions of that and then systematically go 
    through the elements on the page guessing at the purpose and meaning of each.
    - For the elements that are active controls, also describe the expected effect of invoking them.
    - You may encounter bugs, report them in your page analysis.
    - Use the record_page_observations tool to record your analysis of the page. 
    The tool will return your own observations to you for usage In later steps.

    You'll refer back to the analysis that you generate as a reference in later steps while you attempt 
    to take actions with the performActions tool to explore the web app, learning what it does and trying 
    out all of the most interesting features by repeatedly calling performActions followed by record_page_observations.
   
    At each new page you encounter, repeat the page analysis process described above. 

    **Goal**
    Your goal is to navigate through the site in a methodical way as the user would, recording an analysis of 
    each page you encounter indefinitely. Do not return text, only call tools in a loop.
    """

test_func_instructions = """
    You are an agent who is designed to test calling a function hello_world. call the function and then tell me you did it.
    """
enable_verbose_stdout_logging()

load_dotenv(".env")
MCP_SERVER_PORT=os.getenv("MCP_SERVER_PORT","3088")
mcp_server_url = f"http://localhost:{MCP_SERVER_PORT}/mcp"


guessing_mcp_server=MCPServerStreamableHttp(params={"url": mcp_server_url,"terminate_on_close":True }, client_session_timeout_seconds=30)
mcp_servers: list[MCPServer] =  [guessing_mcp_server]


# Define hooks for logging requests and responses
def log_request(request):
    """Hook to log LLM requests."""
    print(f"LLM Request: {json.dumps(request, indent=2)}")
    return request  # Return the request unchanged

def log_response(response):
    """Hook to log LLM responses."""
    print(f"LLM Response: {json.dumps(response, indent=2)}")
    return response  # Return the response unchanged

class LoggingAgentHooks(AgentHooks):
    async def on_request(self,request):
            log_request(request)
            return request

    async def on_response(self,response):
            log_response(response)
            return response


@function_tool  
def record_page_observations(page_observations: str, navigation_history: list[str] | None = None) -> None:
    """Record observations of the current page. This will return nothing 
    Use this tool whenever you want to make any sort of notes or observations about a page. 

    Args:
        page_observations: The observations to record.
        navigation_history: a list of textual descriptions of navigation actions taken to this point.
    """
    history = [] if navigation_history is None else navigation_history
    print(f" Navigation history: {history}\n\n Page observations: {page_observations} \n")
    # return {"observations": page_observations, "navigation_history": history}

@function_tool
async def hello_world() -> str:
    return "Hello World"


# Define the agent with the MCP server URL
agent = Agent(
    name="StagingDogAgent",
    instructions=agent_instructions,
    mcp_servers=mcp_servers,  # Directly specify the MCP server URL
    tools=[record_page_observations],
    hooks=LoggingAgentHooks(),
)

tool_calls_in_flight = {}

class CompletedToolCall:
    tool_name: str
    arguments: dict[str, Any]
    output: dict[str, Any] | str | None

    def __init__(self,tool_name:str,arguments:dict[str, Any], output_json:str | None = None) :
        self.tool_name = tool_name
        self.arguments = arguments
        if output_json is None:
            self.output = None
        else:
            try:
                self.output = json.loads(output_json)
            except json.JSONDecodeError:
                # Fall back to raw string if it isn't valid JSON
                self.output = output_json
        # print (f"in ComletedToolCall constructor output is {self.output}")

    def result_object(self) -> Any:
        if self.output is None:
            return None

        # If the output is a dict, try to decode the "text" field if present
        if isinstance(self.output, dict):
            text_val = self.output.get("text")
            if text_val is None:
                return self.output  # return raw dict
            try:
                return json.loads(text_val)
            except json.JSONDecodeError:
                return text_val  # return raw string

        # Otherwise (e.g., str / int) just return as-is
        return self.output

    # string representation for formatting strings
    def __str__(self):
        return f"CompletedToolCall(tool_name={self.tool_name}, arguments={self.arguments}, result_object={self.result_object()})"


def on_complete_tool_call(ctc:CompletedToolCall)->None:
    print(f"completed_tool_call: {ctc}")

def handle_tool_call(tci:ToolCallItem):
    raw_item = tci.raw_item
    tool_name:str = getattr(raw_item, "name", "anonymous")
    call_id = getattr(raw_item,'call_id',None)
    arguments:dict = getattr(raw_item, "arguments",{})
    tool_calls_in_flight[call_id] = { "tool_name":tool_name, "arguments":arguments}
    print(f"Tool {tool_name} called with id {call_id} and args: {arguments}")

def handle_tool_output(tci:ToolCallItem):
    print(f"I am in tool output with item {tci}")
    raw_item_dict:dict = cast(dict,tci.raw_item)
    call_id = raw_item_dict.get('call_id',None)
    output = raw_item_dict.get('output',None)
    associated_call = tool_calls_in_flight.get(call_id,None)
    if associated_call is None:
        print(f"Got a tool output with no associated call! Call_id: {call_id} Output: {output}")
        pass
    else:
        print(f"tool name is {associated_call['tool_name']} \n\narguments are {associated_call['arguments']}\n\noutput is {output}")
        completed_tool_call = CompletedToolCall(tool_name=associated_call["tool_name"], arguments=associated_call["arguments"], output_json=output)
        on_complete_tool_call(completed_tool_call)
        tool_calls_in_flight.pop(call_id)

def handle_message_output_created(item: MessageOutputItem):
    response_ouput_message:ResponseOutputText = cast(ResponseOutputText ,item.raw_item.content[0])
    ouput_text:str = response_ouput_message.text
    print(f"Message output created: {ouput_text}")
    
def handle_run_stream_event(event: RunItemStreamEvent):
    print(f"handling event named {event.name}")
    if event.name == "tool_called":
        # print(f"tool_called event and item is {event.item}")
        tci:ToolCallItem = cast(ToolCallItem,event.item)
        handle_tool_call(tci)
    elif event.name == "tool_output":
        # print(f"tool_output event and item is {event.item}")
        tci:ToolCallItem = cast(ToolCallItem,event.item)
        handle_tool_output(tci)
    elif event.name == "message_output_created":
        print(f"message_output_created event and item is {event.item}")
        handle_message_output_created(cast(MessageOutputItem,event.item))
       

async def main():
    # Run the agent with a starting prompt
    set_tracing_disabled(False)

    try:
        await guessing_mcp_server.connect()
        servers = await guessing_mcp_server.list_tools()
        print("MCP list-tools result:", servers)
        bad = [t for t in servers if not isinstance(t.name, str)]
        print("Bad names:", bad)

        result = Runner.run_streamed(
            agent,
            input= """Use the tools on the MCP server to examine staging.elephantllm.com. Do not return text, only call tools in a loop.""",  # Adjust prompt based on your tools
            max_turns=15,
        )
        async for event in result.stream_events():
            if event.type == "run_item_stream_event":
                run_item_stream_event:RunItemStreamEvent = event
                handle_run_stream_event(run_item_stream_event)
    finally:
        await guessing_mcp_server.cleanup()

if __name__ == "__main__":

    asyncio.run(main())
