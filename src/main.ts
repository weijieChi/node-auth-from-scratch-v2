import { env } from './config/env.js';
import { logger } from './observability/logger.js';

logger.info('Node Auth From Scratch v2');

logger.info('Application configuration loaded', {
  environment: env.NODE_ENV,
  host: env.HOST,
  port: env.PORT,
});

logger.debug('Debug logging is enabled');
