import * as dotenv from 'dotenv';
dotenv.config();
import {
  customerRepository,
  productRepository,
  orderRepository,
  orderItemRepository,
  employeeRepository,
  syncHistoryRepository,
} from './sequelize';

const dropTable = async () => {
  const repositories = [
    orderItemRepository,
    orderRepository,
    customerRepository,
    productRepository,
    employeeRepository,
    syncHistoryRepository,
  ];

  for (const repository of repositories) {
    await repository.drop({ cascade: true });
  }
};

dropTable();
