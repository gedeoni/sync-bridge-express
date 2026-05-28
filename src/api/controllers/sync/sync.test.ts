import request from 'supertest';
import app from '../../../app';
import { sequelize, customerRepository } from '../../../databases/sequelize';
import { customEnv } from '../../../helpers/customEnv';

const AUTH_HEADER = { 'X-Auth-Token': customEnv.AUTHORIZATION_KEY || 'your-secret-auth-key' };

describe('Sync Controller Integration', () => {
  beforeEach(async () => {
    // Clear and sync tables before each test to ensure test isolation
    await sequelize.sync({ force: true });
  });

  it('should successfully sync customer creation and update (upsert)', async () => {
    const payload = {
      model: 'customers',
      data: [{ id: 10, email: 'john@example.com', first_name: 'John', last_name: 'Doe' }],
    };

    // 1. First sync: inserts the record
    const resCreate = await request(app).post('/api/v1/sync').set(AUTH_HEADER).send(payload);

    expect(resCreate.statusCode).toEqual(200);
    expect(resCreate.body.data.results[0].status).toEqual('created');

    const dbCustomer = await customerRepository.findByPk(10);
    expect(dbCustomer).not.toBeNull();
    expect(dbCustomer?.first_name).toEqual('John');

    // 2. Second sync: updates the record parameters
    payload.data[0].first_name = 'Johnny';
    const resUpdate = await request(app).post('/api/v1/sync').set(AUTH_HEADER).send(payload);

    expect(resUpdate.statusCode).toEqual(200);
    expect(resUpdate.body.data.results[0].status).toEqual('updated');

    const dbCustomerUpdated = await customerRepository.findByPk(10);
    expect(dbCustomerUpdated?.first_name).toEqual('Johnny');
  });

  it('should reject order sync when items mathematical sum does not equal total amount', async () => {
    // Create a customer first since orders have foreign keys to customers
    await customerRepository.create({
      id: 1,
      email: 'buyer@example.com',
      first_name: 'Buyer',
      last_name: 'One',
    });

    const payload = {
      model: 'orders',
      data: [
        {
          order_number: 'ORD-ERR-01',
          customer_id: 1,
          status: 'pending',
          amount: 500, // Mathematically incorrect: 2 * 100 = 200, not 500!
          items: [{ product_id: 1, qty: 2, unit_price: 100 }],
        },
      ],
    };

    const res = await request(app).post('/api/v1/sync').set(AUTH_HEADER).send(payload);

    expect(res.statusCode).toEqual(400); // Celebrate Joi schema validation block
    expect(res.body.message).toContain('Validation failed');
  });

  it('should roll back database transaction when an item in a batch sync fails', async () => {
    // Triggers duplicate ID constraint in the same batch loop to force a DB exception
    const dupPayload = {
      model: 'customers',
      data: [
        { id: 30, email: 'item1@example.com', first_name: 'Item1', last_name: 'Last' },
        { id: 30, email: 'item2@example.com', first_name: 'Item2', last_name: 'Last' },
      ],
    };

    const res = await request(app).post('/api/v1/sync').set(AUTH_HEADER).send(dupPayload);

    expect(res.statusCode).toEqual(500); // DB write constraint failed

    // Verify transaction rollback: BOTH insertions should be completely rolled back!
    const dbCustomer = await customerRepository.findByPk(30);
    expect(dbCustomer).toBeNull(); // Assert rolled back successfully!
  });
});
