import { beforeAll, afterAll } from 'vitest';
import { server } from '../src/server';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Start server before tests
beforeAll(() => {
  // Any global test setup can go here
});

// Clean up after tests
afterAll(() => {
  // Close the server after all tests
  server.close();
});
