#!/usr/bin/env node

import { startServer } from './server';
import { ApiClient } from './client';

/**
 * Main application entry point
 */
async function main() {
  try {
    // Start the server
    await startServer();
    
    // Create a client to test the server
    const client = new ApiClient();
    
    // Test the server connection
    console.log('Testing server connection...');
    const health = await client.checkHealth();
    console.log('Server health check successful:', health);
    
  } catch (error) {
    console.error('Application failed to start:', error);
    process.exit(1);
  }
}

// Run the application
if (require.main === module) {
  main().catch(console.error);
}

export { main };
