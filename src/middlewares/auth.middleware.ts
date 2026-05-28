import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { responseWrapper } from '../helpers/responseWrapper';
import httpCodes from '../constants/httpCodes';
import { customEnv } from '../helpers/customEnv';

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    // Perform a dummy operation of the same length to prevent timing leakage
    crypto.timingSafeEqual(new Uint8Array(aBuf), new Uint8Array(aBuf));
    return false;
  }
  return crypto.timingSafeEqual(new Uint8Array(aBuf), new Uint8Array(bBuf));
}

export const isAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inputToken = req.headers['x-auth-token'];
    const systemToken = customEnv.AUTHORIZATION_KEY;

    if (!inputToken || typeof inputToken !== 'string' || !systemToken || !safeCompare(inputToken, systemToken)) {
      return responseWrapper({
        res,
        status: httpCodes.UNAUTHORIZED,
        message: 'Access Denied',
      });
    }
    next();
  } catch (error) {
    return next(error);
  }
};
