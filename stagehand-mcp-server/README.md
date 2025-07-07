# MCP Stateful Example

A minimal, fully MCP-compliant server and client setup for exploring and validating session-based tool invocation workflows using the [Model Context Protocol (MCP)](https://modelcontext.org).

## Features

- **Toy Stateful MCP Server**: Implements a minimal MCP server with session handling
- **Test Tools**: Includes `imagine` and `isLessThan` tools for testing session state
- **Integration Tests**: Python-based tests for validating server behavior and session persistence
- **Health Check**: Built-in `/health` endpoint for monitoring server status

## Prerequisites

- Node.js 18+
- Python 3.8+ (for integration tests)
- npm or yarn

## Getting Started

1. Clone the repository
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Install Python dependencies for integration tests:
   ```bash
   pip install -r test/integration/requirements.txt
   ```
4. Create a `.env.test` file in the project root with the following content:
   ```
   PORT=3088
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## Running Tests

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
# Run all integration tests
npm run itest

# Or run a specific test
cd test/integration
python test_initialize.py
```

## Project Structure

- `src/` - Source code
  - `server/` - MCP server implementation
    - `tools/` - Tool definitions
  - `client/` - Test client implementation
- `test/` - Test files
  - `integration/` - Python-based integration tests
- `scripts/` - Build and utility scripts

## Available Tools

### `imagine`
Picks a random number between the specified lower and upper bounds and stores it in the session.

**Parameters:**
- `lower`: Lower bound (inclusive)
- `upper`: Upper bound (inclusive)

### `isLessThan`
Checks if a number is less than the previously imagined number in the current session.

**Parameters:**
- `number`: Number to compare against the imagined number

## API Endpoints

### `GET /health`
Health check endpoint that returns server status.

### `POST /mcp`
Main MCP protocol endpoint for handling MCP-compliant requests.

## Environment Variables

- `PORT`: Port number the server will listen on (default: 3000)
- `NODE_ENV`: Environment mode (e.g., 'development', 'production')

## License

ISC
