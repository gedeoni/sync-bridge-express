import { Sequelize, SequelizeOptions } from 'sequelize-typescript';
import { customEnv } from '../helpers/customEnv';
import { logger } from '../helpers/logger';
import Customer from './models/customers.model';
import Product from './models/products.model';
import Order from './models/orders.model';
import OrderItem from './models/orderItems.model';
import SyncHistory from './models/syncHistory.model';
import Employee from './models/employee.model';

const dbUri = customEnv.DATABASE_URI as string;

export const connect = (url: string) => {
  const isSqlite = url.startsWith('sqlite');

  const options: SequelizeOptions = {
    models: [Customer, Product, Order, OrderItem, SyncHistory, Employee],
    repositoryMode: true,
    logging:
      customEnv.NODE_ENV === 'development'
        ? (sql: string) => {
            // Only log the SQL statement without the timing info
            logger.debug(`[Sequelize] ${sql}`);
          }
        : false,
    dialect: isSqlite ? 'sqlite' : 'postgres',
  };

  if (isSqlite) {
    // Keep the replication architecture active for SQLite by mapping connection storage paths
    options.replication = {
      read: [{ storage: customEnv.SLAVE_ONE || 'replica.sqlite' } as any],
      write: { storage: customEnv.MAIN_HOST || 'main.sqlite' } as any,
    };
  } else {
    options.schema = customEnv.DB_SCHEMA || 'public';
    options.replication = {
      read: [{ host: customEnv.SLAVE_ONE }],
      write: { host: customEnv.MAIN_HOST },
    };
    options.dialectOptions = {
      useUTC: false,
    };
    options.timezone = '+2:00'; // Kigali timezone
  }

  return new Sequelize(url, options);
};

export const sequelize = connect(dbUri);

export const customerRepository = sequelize.getRepository(Customer);
export const productRepository = sequelize.getRepository(Product);
export const orderRepository = sequelize.getRepository(Order);
export const orderItemRepository = sequelize.getRepository(OrderItem);
export const syncHistoryRepository = sequelize.getRepository(SyncHistory);
export const employeeRepository = sequelize.getRepository(Employee);
