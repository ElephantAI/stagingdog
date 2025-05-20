# MCP Stateful Example

A minimal, fully MCP-compliant server and client setup for exploring and validating session-based tool invocation workflows using the [Model Context Protocol (MCP)](https://modelcontext.org).

## Features

- **Toy Stateful MCP Server**: Implements a minimal MCP server with session handling
- **Test Tools**: Includes `imagine` and `reveal` tools for testing session state
- **Integration Test Client**: Validates server behavior and session persistence
- **Wire Protocol Inspector**: Logs all JSON-RPC requests, HTTP headers, and SSE messages

## Prerequisites

- Node.js 18+
- npm or yarn

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Run the test client:
   ```bash
   npm run test:client
   ```

## Project Structure

- `src/` - Source code
  - `server/` - MCP server implementation
  - `client/` - Test client implementation
  - `common/` - Shared utilities and types
  - `types/` - TypeScript type definitions
- `test/` - Test files
- `scripts/` - Build and utility scripts

## License

ISC
