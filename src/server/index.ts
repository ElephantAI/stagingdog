import express, { type Request, type Response, type NextFunction, type Application } from 'express';
import { createServer, type Server as HttpServer } from 'node:http';

// Create Express application
const app: Application = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction): void => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler - moved before error handling
app.use((req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource '${req.path}' was not found`,
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Create HTTP server
const server: HttpServer = createServer(app);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection at:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle graceful shutdown
const shutdown = (): void => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server has been stopped');
    process.exit(0);
  });
};

// Handle process termination
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
async function startServer(port: number = PORT): Promise<void> {
  return new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
      console.log('Press Ctrl+C to stop the server');
      resolve();
    });
  });
}

// Only start the server if this file is run directly
if (import.meta.url.endsWith(process.argv[1])) {
  startServer(PORT).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { app, server, startServer };
