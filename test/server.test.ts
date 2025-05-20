import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createServer, type Server } from 'node:http';
import type { Express } from 'express';
import { app } from '../src/server';

// Mock console.log to keep test output clean
const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Server', () => {
  let testServer: Server;
  
  beforeAll(async () => {
    // Create a test server
    testServer = createServer(app);
    
    // Start the test server on a random port
    await new Promise<void>((resolve) => {
      testServer.listen(0, () => {
        const address = testServer.address();
        const port = typeof address === 'string' ? 3000 : address?.port || 3000;
        console.log(`Test server running on port ${port}`);
        process.env.TEST_SERVER_URL = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Close the server and restore console.log
    await new Promise<void>((resolve) => {
      testServer.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
    consoleMock.mockRestore();
  });

  describe('GET /health', () => {
    it('should return 200 OK with status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 Not Found', async () => {
      const response = await request(app).get('/nonexistent');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('message');
    });
  });
});
