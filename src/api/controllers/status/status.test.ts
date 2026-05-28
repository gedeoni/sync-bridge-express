import request from 'supertest';
import app from '../../../app';
import { sequelize, customerRepository } from '../../../databases/sequelize';

describe('Health Check', () => {
  beforeAll(async () => {
    // Ensure all tables are created in the SQLite database before running the health probe
    await sequelize.sync({ force: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return 200 OK for the health check when database is fully healthy', async () => {
    const res = await request(app).get('/api/v1/healthz');
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual('Service is healthy');
    expect(res.body.data.read).toEqual(true);
    expect(res.body.data.write).toEqual(true);
  });

  it('should return 503 SERVICE_UNAVAILABLE when sequelize.authenticate fails', async () => {
    jest.spyOn(sequelize, 'authenticate').mockRejectedValueOnce(new Error('Auth failure'));

    const res = await request(app).get('/api/v1/healthz');
    expect(res.statusCode).toEqual(503);
    expect(res.body.message).toEqual('Service is unhealthy');
    expect(res.body.data.read).toEqual(false);
    expect(res.body.data.write).toEqual(false);
  });

  it('should return 503 SERVICE_UNAVAILABLE when read operation fails', async () => {
    jest.spyOn(customerRepository, 'findOne').mockRejectedValueOnce(new Error('Read query failure'));

    const res = await request(app).get('/api/v1/healthz');
    expect(res.statusCode).toEqual(503);
    expect(res.body.message).toEqual('Service is unhealthy');
    expect(res.body.data.read).toEqual(false);
    expect(res.body.data.write).toEqual(false);
  });

  it('should return 503 SERVICE_UNAVAILABLE when write operation fails', async () => {
    jest.spyOn(customerRepository, 'create').mockRejectedValueOnce(new Error('Write query failure'));

    const res = await request(app).get('/api/v1/healthz');
    expect(res.statusCode).toEqual(503);
    expect(res.body.message).toEqual('Service is unhealthy');
    expect(res.body.data.read).toEqual(false);
    expect(res.body.data.write).toEqual(false);
  });
});
