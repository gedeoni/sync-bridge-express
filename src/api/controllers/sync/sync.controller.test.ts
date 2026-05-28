import request from 'supertest';
import app from '../../../app';
import {
  sequelize,
  productRepository,
  customerRepository,
  orderRepository,
  orderItemRepository,
  syncHistoryRepository,
} from '../../../databases/sequelize';
import { SyncStatus } from '../../../databases/models/syncHistory.model';

const AUTH_TOKEN = process.env.AUTHORIZATION_KEY || 'your-secret-auth-key';

describe('Sync Controller Integration Tests', () => {
  beforeAll(async () => {
    // Ensure all tables are created and clean in the SQLite database before running the tests
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clean up database tables before each test to guarantee isolation
    await orderItemRepository.destroy({ where: {}, truncate: true });
    await orderRepository.destroy({ where: {}, force: true });
    await productRepository.destroy({ where: {}, force: true });
    await syncHistoryRepository.destroy({ where: {}, force: true });
  });

  describe('POST /api/v1/sync', () => {
    it('should fail with 401 if auth header is missing', async () => {
      const res = await request(app)
        .post('/api/v1/sync')
        .send({
          model: 'products',
          data: [{ name: 'Test Product', price: 100 }],
        });

      expect(res.statusCode).toEqual(401);
    });

    it('should fail with 400 if validation fails (invalid model)', async () => {
      const res = await request(app)
        .post('/api/v1/sync')
        .set('X-Auth-Token', AUTH_TOKEN)
        .send({
          model: 'invalid_model_name',
          data: [{ id: 1 }],
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message.toLowerCase()).toContain('validation');
    });

    it('should successfully sync products (create then update)', async () => {
      // 1. Create a product
      const createRes = await request(app)
        .post('/api/v1/sync')
        .set('X-Auth-Token', AUTH_TOKEN)
        .send({
          model: 'products',
          data: [
            {
              id: 99,
              name: 'Original Product Name',
              price: 1500,
              currency: 'USD',
              active: true,
            },
          ],
        });

      expect(createRes.statusCode).toEqual(200);
      expect(createRes.body.data.results).toEqual([{ id: 99, status: 'created' }]);

      // Check DB value
      const createdProduct = await productRepository.findByPk(99);
      expect(createdProduct).not.toBeNull();
      expect(createdProduct?.name).toEqual('Original Product Name');
      expect(createdProduct?.price).toEqual(1500);

      // 2. Update the same product
      const updateRes = await request(app)
        .post('/api/v1/sync')
        .set('X-Auth-Token', AUTH_TOKEN)
        .send({
          model: 'products',
          data: [
            {
              id: 99,
              name: 'Updated Product Name',
              price: 2000,
              currency: 'USD',
              active: true,
            },
          ],
        });

      expect(updateRes.statusCode).toEqual(200);
      expect(updateRes.body.data.results).toEqual([{ id: 99, status: 'updated' }]);

      // Check DB value updated
      const updatedProduct = await productRepository.findByPk(99);
      expect(updatedProduct?.name).toEqual('Updated Product Name');
      expect(updatedProduct?.price).toEqual(2000);
    });

    it('should successfully sync orders with nested order items', async () => {
      // Setup: Create a customer first for foreign key constraint
      await customerRepository.create({
        id: 1,
        email: 'customer@example.com',
        first_name: 'John',
        last_name: 'Doe',
      });

      // Setup: Create a product first for foreign key constraint safety if present
      await productRepository.create({
        id: 5,
        name: 'Super Product',
        price: 100,
        currency: 'USD',
      });

      const orderPayload = {
        model: 'orders',
        data: [
          {
            id: 200,
            order_number: 'ORD-TEST-1',
            customer_id: 1, // Assumes mock customer or bypasses foreign key in sqlite
            status: 'pending',
            amount: 200, // unit_price 100 * qty 2
            items: [
              {
                product_id: 5,
                qty: 2,
                unit_price: 100,
              },
            ],
          },
        ],
      };

      const res = await request(app).post('/api/v1/sync').set('X-Auth-Token', AUTH_TOKEN).send(orderPayload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.results).toEqual([{ id: 200, status: 'created' }]);

      // Verify order persisted in DB
      const order = await orderRepository.findByPk(200);
      expect(order).not.toBeNull();
      expect(order?.order_number).toEqual('ORD-TEST-1');
      expect(order?.amount).toEqual(200);

      // Verify nested order items were synced via our Order Sync Processor
      const orderItems = await orderItemRepository.findAll({ where: { order_id: 200 } });
      expect(orderItems.length).toEqual(1);
      expect(orderItems[0].product_id).toEqual(5);
      expect(orderItems[0].qty).toEqual(2);
      expect(orderItems[0].unit_price).toEqual(100);
    });

    it('should roll back complete transaction if one item sync fails', async () => {
      // Suppress console error logging for this expected error test block
      const loggerSpy = jest.spyOn(sequelize, 'transaction');

      const res = await request(app)
        .post('/api/v1/sync')
        .set('X-Auth-Token', AUTH_TOKEN)
        .send({
          model: 'products',
          data: [
            {
              id: 301,
              name: 'Product 1',
              price: 10,
            },
            {
              id: 301, // Duplicate ID to trigger unique key constraint error at DB level (passes Joi)
              name: 'Product 2',
              price: 20,
            },
          ],
        });

      expect(res.statusCode).toEqual(500);

      // Verify that Product 1 (id 301) was NOT saved (rolled back)
      const product = await productRepository.findByPk(301);
      expect(product).toBeNull();

      // Verify SyncHistory entry marked as failed
      const histories = await syncHistoryRepository.findAll();
      expect(histories.length).toEqual(1);
      expect(histories[0].status).toEqual(SyncStatus.FAILED);
      expect(histories[0].failure_reason).not.toBeNull();

      loggerSpy.mockRestore();
    });

    it('should successfully sync employees', async () => {
      const employeePayload = {
        model: 'employees',
        data: [
          {
            id: '1',
            employeeId: 'EMP-1',
            firstName: 'Alice',
            lastName: 'Smith',
            gender: 'Female',
            email: 'alice@example.com',
            dateOfBirth: '1990-01-01',
            nationality: 'American',
            department: 'Engineering',
            location: 'San Francisco',
            company: 'TechCorp',
            jobTitle: 'Software Engineer',
            costCenter: 'US-ENG',
            startDate: '2020-01-01',
            employeeStatus: 'Active',
            lastModifiedOn: '2023-01-01',
            lastModified: Date.now(),
          },
        ],
      };

      const res = await request(app).post('/api/v1/sync').set('X-Auth-Token', AUTH_TOKEN).send(employeePayload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.results).toEqual([{ id: '1', status: 'created' }]);
    });

    it('should successfully update existing order and existing order item, executing postSync hook', async () => {
      // Setup: Create customer first
      await customerRepository.create({
        id: 2,
        email: 'customer2@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
      });
      // Setup: Create product
      await productRepository.create({
        id: 10,
        name: 'Cool Product',
        price: 50,
        currency: 'USD',
      });

      // 1. Sync order with one item
      const initialPayload = {
        model: 'orders',
        data: [
          {
            id: 300,
            order_number: 'ORD-300',
            customer_id: 2,
            status: 'pending',
            amount: 50,
            items: [
              {
                product_id: 10,
                qty: 1,
                unit_price: 50,
              },
            ],
          },
        ],
      };

      const res1 = await request(app).post('/api/v1/sync').set('X-Auth-Token', AUTH_TOKEN).send(initialPayload);

      expect(res1.statusCode).toEqual(200);
      expect(res1.body.data.results).toEqual([{ id: 300, status: 'created' }]);

      // Verify item has qty 1 and retrieve its generated ID
      const orderItems = await orderItemRepository.findAll({ where: { order_id: 300 } });
      expect(orderItems.length).toEqual(1);
      const generatedId = orderItems[0].id;
      expect(orderItems[0].qty).toEqual(1);

      // 2. Sync again to update order and existing order item
      const updatePayload = {
        model: 'orders',
        data: [
          {
            id: 300,
            order_number: 'ORD-300',
            customer_id: 2,
            status: 'paid',
            amount: 150,
            items: [
              {
                id: generatedId,
                product_id: 10,
                qty: 3,
                unit_price: 50,
              },
            ],
          },
        ],
      };

      const res2 = await request(app).post('/api/v1/sync').set('X-Auth-Token', AUTH_TOKEN).send(updatePayload);

      expect(res2.statusCode).toEqual(200);
      expect(res2.body.data.results).toEqual([{ id: 300, status: 'updated' }]);

      // Verify item is updated to qty 3
      const updatedItem = await orderItemRepository.findByPk(generatedId);
      expect(updatedItem?.qty).toEqual(3);
    });

    it('should successfully sync an order without any items (testing amount validation bypass)', async () => {
      await customerRepository.create({
        id: 3,
        email: 'customer3@example.com',
        first_name: 'Bob',
        last_name: 'Builder',
      });

      const orderPayload = {
        model: 'orders',
        data: [
          {
            id: 400,
            order_number: 'ORD-400',
            customer_id: 3,
            status: 'pending',
            amount: 0,
          },
        ],
      };

      const res = await request(app).post('/api/v1/sync').set('X-Auth-Token', AUTH_TOKEN).send(orderPayload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.results).toEqual([{ id: 400, status: 'created' }]);
    });
  });

  describe('GET /api/v1/sync/stats', () => {
    it('should aggregate sync statistics correctly', async () => {
      // Mock history entries
      await syncHistoryRepository.create({
        payload: {},
        status: SyncStatus.SUCCESSFUL,
      });
      await syncHistoryRepository.create({
        payload: {},
        status: SyncStatus.SUCCESSFUL,
      });
      await syncHistoryRepository.create({
        payload: {},
        status: SyncStatus.FAILED,
        failure_reason: 'DB error',
      });
      await syncHistoryRepository.create({
        payload: {},
        status: SyncStatus.INVALID,
        failure_reason: 'Bad syntax',
      });
      await syncHistoryRepository.create({
        payload: {},
        status: SyncStatus.PENDING_RETRY,
      });

      const res = await request(app).get('/api/v1/sync/stats').set('X-Auth-Token', AUTH_TOKEN);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        successful: 2,
        failed: 1,
        invalid: 1,
        pending_retry: 1,
        total: 5,
      });
    });
  });
});
