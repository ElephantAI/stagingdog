#!/usr/bin/env node
import 'dotenv/config';

import { startServer } from './server/index.js';

/**
 * Main application entry point
 */
async function main() {
  await startServer();
}

// Run the application if this file is the entry point
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  main().catch(console.error);
}

export { main };

