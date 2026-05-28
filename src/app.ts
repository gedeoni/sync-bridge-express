import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { MainRoutes } from './routes/main.routes';
import { errorHandler } from './middlewares/errors';
import { collectDefaultMetrics, httpRequestDurationMicroseconds } from './helpers/metrics';
import { requestIdMiddleware } from './middlewares/requestId';
import { logger } from './helpers/logger';
import { customEnv } from './helpers/customEnv';

const app = express();

// Secure application by setting various HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Keep disabled for local Swagger and Apollo sandbox to render properly
  })
);

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Collect default metrics
collectDefaultMetrics();

app.use(express.json({ limit: '5mb' }));

app.use(express.urlencoded({ extended: true }));

// Add request ID to all requests
app.use(requestIdMiddleware);

// Configure dynamic rate limits: unauthenticated client IP vs authenticated API token
const unauthenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { status: 429, message: 'Too many unauthenticated requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: { status: 429, message: 'Rate limit exceeded for authenticated client.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use((req, res, next) => {
  const token = req.headers['x-auth-token'];
  const isAuthenticated = token && token === customEnv.AUTHORIZATION_KEY;
  if (isAuthenticated) {
    return authenticatedLimiter(req, res, next);
  }
  return unauthenticatedLimiter(req, res, next);
});

// Middleware to measure request duration
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
    logger.info({ req, res }, 'Request finished');
  });
  next();
});

const mainRoutes = new MainRoutes().router;

app.use('/api/v1', mainRoutes);

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(errorHandler);

export default app;
