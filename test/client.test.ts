import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { ApiClient } from '../src/client';
import { app } from '../src/server';

// Mock console.log to keep test output clean
const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('ApiClient', () => {
  let client: ApiClient;
  let testServer: Server;
  let testPort: number;

  beforeAll(async () => {
    // Create a test server
    testServer = createServer(app);
    
    // Start the test server on a random port
    await new Promise<void>((resolve) => {
      testServer.listen(0, () => {
        const address = testServer.address();
        testPort = typeof address === 'string' ? 3000 : address?.port || 3000;
        console.log(`Test server running on port ${testPort}`);
        process.env.TEST_SERVER_URL = `http://localhost:${testPort}`;
        resolve();
      });
    });
    
    // Create a client for testing
    client = new ApiClient(`http://localhost:${testPort}`);
  });

  afterAll(async () => {
    // Close the server after tests
    await new Promise<void>((resolve) => {
      testServer.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
    
    // Restore console.log
    consoleMock.mockRestore();
  });

  describe('checkHealth', () => {
    it('should return server health status', async () => {
      const health = await client.checkHealth();
      
      expect(health).toHaveProperty('status', 'ok');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(typeof health.uptime).toBe('number');
    });
  });
});
