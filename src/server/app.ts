import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { dbStorage } from './db/storage';
import { logger } from './utils/logger';
import { apiRateLimiter } from './middleware/rateLimit';

import { authRouter } from './routes/auth.routes';
import { companyRouter } from './routes/company.routes';
import { taskRouter } from './routes/task.routes';
import { customFieldRouter } from './routes/custom-field.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { reportRouter } from './routes/report.routes';
import { roleRouter } from './routes/role.routes';
import { userRouter } from './routes/user.routes';
import { auditRouter } from './routes/audit.routes';
import { notificationRouter } from './routes/notification.routes';
import { systemRouter } from './routes/system.routes';
import { schemaRouter } from './routes/schema.routes';
import { securityTestRouter } from './routes/security-test.routes';

dotenv.config();

export const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Remote state synchronization middleware (ensures latest state across multiple serverless/Vercel containers)
app.use(async (req, _res, next) => {
  if (req.originalUrl.startsWith('/api') && req.originalUrl !== '/api/health') {
    try {
      await dbStorage.syncFromRemoteIfAvailable();
    } catch {
      // non-blocking
    }
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api') && req.originalUrl !== '/api/health') {
      logger.info(`${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`);
    }
  });
  next();
});

app.use('/api', apiRateLimiter);

const handleHealth = (_req: express.Request, res: express.Response) => {
  const mem = process.memoryUsage();
  const companies = dbStorage.getAllCompanies();
  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '2.5.0-production',
    environment: process.env.NODE_ENV || 'development',
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsageMb: {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
      },
    },
    database: {
      status: 'connected',
      storageEngine: dbStorage.isPostgresConnected() ? 'postgresql_cloud' : 'local_json_file',
      companiesCount: companies.length,
    },
  });
};

app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

// Mount routers with both /api prefix (for local and standard proxy) and without prefix (for Vercel serverless rewrites)
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

app.use('/api/companies', companyRouter);
app.use('/companies', companyRouter);

app.use('/api/tasks', taskRouter);
app.use('/tasks', taskRouter);

app.use('/api/custom-fields', customFieldRouter);
app.use('/custom-fields', customFieldRouter);

app.use('/api/dashboard', dashboardRouter);
app.use('/dashboard', dashboardRouter);

app.use('/api/reports', reportRouter);
app.use('/reports', reportRouter);

app.use('/api/roles', roleRouter);
app.use('/roles', roleRouter);

app.use('/api/users', userRouter);
app.use('/users', userRouter);

app.use('/api/audit-logs', auditRouter);
app.use('/audit-logs', auditRouter);

app.use('/api/notifications', notificationRouter);
app.use('/notifications', notificationRouter);

app.use('/api/system', systemRouter);
app.use('/system', systemRouter);

app.use('/api/system/schema', schemaRouter);
app.use('/system/schema', schemaRouter);

app.use('/api/security-test', securityTestRouter);
app.use('/security-test', securityTestRouter);

export default app;
