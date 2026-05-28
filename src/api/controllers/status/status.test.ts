import request from 'supertest';
import app from '../../../app';
import { sequelize } from '../../../databases/sequelize';

describe('Health Check', () => {
  beforeAll(async () => {
    // Ensure all tables are created in the SQLite database before running the health probe
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close connection pool after tests finish
    await sequelize.close();
  });

  it('should return 200 OK for the health check', async () => {
    const res = await request(app).get('/api/v1/healthz');
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual('Service is healthy');
  });
});
