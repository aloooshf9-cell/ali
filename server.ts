import express from 'express';
import path from 'path';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import { app } from './src/server/app';
import { logger } from './src/server/utils/logger';

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/*.tmp', '**/backups/**', '**/.git/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Enterprise Multi-Company Server listening on http://0.0.0.0:${PORT}`);
    console.log('\n============================================================');
    console.log(`  Enterprise Multi-Company Server is RUNNING!`);
    console.log(`  - Local:   http://localhost:${PORT}`);
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          const isV4 = iface.family === 'IPv4' || (iface as unknown as { family: number }).family === 4;
          if (isV4 && !iface.internal && iface.address !== '127.0.0.1') {
            console.log(`  - Network: http://${iface.address}:${PORT}`);
          }
        }
      }
    } catch {
      // Ignore network interface enumeration errors
    }
    console.log('============================================================\n');
  });

  // Graceful shutdown handling
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Gracefully stopping server...`);
    server.close(() => {
      logger.info('Server closed cleanly. Exiting process.');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after 10s timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
