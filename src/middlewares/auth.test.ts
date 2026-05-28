import request from 'supertest';
import app from '../app';
import { sequelize } from '../databases/sequelize';
import { customEnv } from '../helpers/customEnv';
import { isAuth } from './auth.middleware';

describe('Auth Middleware', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  it('should return 401 Access Denied when X-Auth-Token is missing', async () => {
    const res = await request(app).get('/api/v1/sync-history');
    expect(res.statusCode).toEqual(401);
    expect(res.body.message).toEqual('Access Denied');
  });

  it('should return 401 Access Denied when X-Auth-Token is wrong', async () => {
    const res = await request(app).get('/api/v1/sync-history').set('X-Auth-Token', 'wrong-token-123');
    expect(res.statusCode).toEqual(401);
    expect(res.body.message).toEqual('Access Denied');
  });

  it('should pass and return 200 OK when X-Auth-Token is correct', async () => {
    const res = await request(app)
      .get('/api/v1/sync-history')
      .set('X-Auth-Token', customEnv.AUTHORIZATION_KEY || 'your-secret-auth-key');
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual('Sync histories retrieved successfully');
  });

  describe('isAuth internal error handling', () => {
    it('should catch and forward unexpected exceptions to next(error)', async () => {
      // Test isAuth function imported at top level

      const malformedReq = {
        get headers() {
          throw new Error('Unexpected header retrieval error');
        },
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      await isAuth(malformedReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toEqual('Unexpected header retrieval error');
    });
  });
});
