import request from 'supertest';
import app from '../../../app';
import { sequelize, syncHistoryRepository } from '../../../databases/sequelize';
import { customEnv } from '../../../helpers/customEnv';
import { SyncStatus } from '../../../databases/models/syncHistory.model';

const AUTH_HEADER = { 'X-Auth-Token': customEnv.AUTHORIZATION_KEY || 'your-secret-auth-key' };

describe('Sync History Controller Integration', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  it('should successfully get paginated history records with correct filtered count', async () => {
    // Create multiple records with different statuses
    await syncHistoryRepository.bulkCreate([
      { payload: { data: 'test1' }, status: SyncStatus.SUCCESSFUL },
      { payload: { data: 'test2' }, status: SyncStatus.FAILED },
      { payload: { data: 'test3' }, status: SyncStatus.FAILED },
    ]);

    // 1. Check all records
    const resAll = await request(app).get('/api/v1/sync-history').set(AUTH_HEADER);

    expect(resAll.statusCode).toEqual(200);
    expect(resAll.body.data.count).toEqual(3);
    expect(resAll.body.data.pages).toEqual(1);
    expect(resAll.body.data.rows.length).toEqual(3);

    // 2. Check filtered records (failed only)
    const resFiltered = await request(app).get('/api/v1/sync-history?status=failed').set(AUTH_HEADER);

    expect(resFiltered.statusCode).toEqual(200);
    expect(resFiltered.body.data.count).toEqual(2); // Should correctly reflect count = 2 instead of total = 3!
    expect(resFiltered.body.data.rows.length).toEqual(2);
  });

  it('should get a single sync history record by ID', async () => {
    const record = await syncHistoryRepository.create({
      payload: { data: 'test' },
      status: SyncStatus.SUCCESSFUL,
    });

    const res = await request(app).get(`/api/v1/sync-history/${record.id}`).set(AUTH_HEADER);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.id).toEqual(record.id);
  });

  it('should retry a failed sync by changing its status to pending_retry', async () => {
    const record = await syncHistoryRepository.create({
      payload: { data: 'test' },
      status: SyncStatus.FAILED,
    });

    const res = await request(app).post(`/api/v1/sync-history/retry/${record.id}`).set(AUTH_HEADER);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.status).toEqual(SyncStatus.PENDING_RETRY);

    const dbRecord = await syncHistoryRepository.findByPk(record.id);
    expect(dbRecord?.status).toEqual(SyncStatus.PENDING_RETRY);
  });

  it('should delete a sync history record', async () => {
    const record = await syncHistoryRepository.create({
      payload: { data: 'test' },
      status: SyncStatus.SUCCESSFUL,
    });

    const res = await request(app).delete(`/api/v1/sync-history/${record.id}`).set(AUTH_HEADER);

    expect(res.statusCode).toEqual(204);

    const dbRecord = await syncHistoryRepository.findByPk(record.id);
    expect(dbRecord).toBeNull();
  });

  it('should return 404 Not Found when getting a non-existent sync history by ID', async () => {
    const res = await request(app).get('/api/v1/sync-history/999999').set(AUTH_HEADER);

    expect(res.statusCode).toEqual(404);
    expect(res.body.message).toEqual('Sync history not found');
  });

  it('should return 404 Not Found when retrying a non-existent sync history by ID', async () => {
    const res = await request(app).post('/api/v1/sync-history/retry/999999').set(AUTH_HEADER);

    expect(res.statusCode).toEqual(404);
    expect(res.body.message).toEqual('Sync history not found');
  });

  it('should return 400 Bad Request when trying to retry a non-failed sync history', async () => {
    const record = await syncHistoryRepository.create({
      payload: { data: 'test' },
      status: SyncStatus.SUCCESSFUL,
    });

    const res = await request(app).post(`/api/v1/sync-history/retry/${record.id}`).set(AUTH_HEADER);

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toEqual('Only failed syncs can be retried');
  });

  it('should return 404 Not Found when trying to delete a non-existent sync history by ID', async () => {
    const res = await request(app).delete('/api/v1/sync-history/999999').set(AUTH_HEADER);

    expect(res.statusCode).toEqual(404);
    expect(res.body.message).toEqual('Sync history not found');
  });
});
