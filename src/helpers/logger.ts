import bunyan from 'bunyan';
import { customEnv } from './customEnv';

const streams: bunyan.Stream[] = [
  {
    level: 'trace',
    stream: process.stdout,
  },
];

export const logger = bunyan.createLogger({
  name: customEnv.APP_NAME as string,
  src: true,
  streams,
  serializers: {
    req: (req) => {
      if (!req) return req;
      const sanitizedHeaders = { ...req.headers };
      if (sanitizedHeaders['x-auth-token']) sanitizedHeaders['x-auth-token'] = '[REDACTED]';
      if (sanitizedHeaders['authorization']) sanitizedHeaders['authorization'] = '[REDACTED]';

      return {
        id: req.id,
        method: req.method,
        url: req.url,
        headers: sanitizedHeaders,
        remoteAddress: req.connection ? req.connection.remoteAddress : undefined,
        remotePort: req.connection ? req.connection.remotePort : undefined,
      };
    },
    res: bunyan.stdSerializers.res,
    err: bunyan.stdSerializers.err,
  },
});
