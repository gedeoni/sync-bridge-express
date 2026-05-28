import { Request, Response, NextFunction } from 'express';
import { responseWrapper } from '../helpers/responseWrapper';
import httpCodes from '../constants/httpCodes';
import { logger } from '../helpers/logger';
import { customEnv } from '../helpers/customEnv';
import { isCelebrateError, type CelebrateError } from 'celebrate';

interface ErrorT extends Error {
  status?: number;
}

const sanitizeBody = (body: any): any => {
  if (!body) return body;
  if (typeof body !== 'object') return body;
  if (Array.isArray(body)) {
    return body.map((item) => sanitizeBody(item));
  }
  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'token', 'secret', 'card', 'cvv', 'credit_card'];
  for (const key of Object.keys(sanitized)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }
  return sanitized;
};

export const errorHandler = (
  error: ErrorT | CelebrateError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  if (customEnv.NODE_ENV === 'development' || customEnv.NODE_ENV === 'test') {
    // eslint-disable-next-line no-console
    console.log(error);
  }

  const sanitizedBody = sanitizeBody(req.body);

  logger.error(
    {
      req,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
      body: sanitizedBody,
      method: req.method,
      url: req.url,
      message: isCelebrateError(error) ? error?.details?.get('body')?.message : error?.message,
    },
    error?.message ?? 'error handling the request'
  );

  const status = isCelebrateError(error) ? httpCodes.BAD_REQUEST : error?.status ?? httpCodes.INTERNAL_SERVER_ERROR;
  const isClientError = status >= 400 && status < 500;

  const response = isCelebrateError(error)
    ? {
        res,
        status: httpCodes.BAD_REQUEST,
        message: error.message,
        data: undefined,
        errors:
          error.details.get('headers')?.details ||
          error.details.get('params')?.details ||
          error.details.get('query')?.details ||
          error.details.get('body')?.details,
      }
    : {
        res,
        data: {
          message: isClientError ? error?.message : undefined,
          method: req.method,
          url: req.url,
        },
        status: error?.name === 'SequelizeUniqueConstraintError' ? httpCodes.CONFLICT : status,
        message:
          error?.name === 'SequelizeUniqueConstraintError'
            ? 'Record already exists'
            : isClientError
            ? error?.message || 'Bad Request'
            : 'Something Went Wrong',
      };

  return responseWrapper(response);
};
