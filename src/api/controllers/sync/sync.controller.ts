import { Request, Response } from 'express';
import {
  customerRepository,
  orderRepository,
  productRepository,
  orderItemRepository,
  syncHistoryRepository,
  employeeRepository,
  sequelize,
} from '../../../databases/sequelize';
import { responseWrapper } from '../../../helpers/responseWrapper';
import { logger } from '../../../helpers/logger';
import { SyncStatus } from '../../../databases/models/syncHistory.model';

const repositories: { [key: string]: any } = {
  customers: customerRepository,
  products: productRepository,
  orders: orderRepository,
  employees: employeeRepository,
};

export const sync = async (req: Request, res: Response) => {
  const { model, data } = req.body;

  const syncHistory = await syncHistoryRepository.create({
    payload: req.body,
    status: SyncStatus.PENDING_RETRY,
  });

  if (
    typeof model !== 'string' ||
    model === '__proto__' ||
    model === 'constructor' ||
    model === 'prototype' ||
    !Object.prototype.hasOwnProperty.call(repositories, model)
  ) {
    logger.error(`Invalid model: ${model}`);
    await syncHistory.update({ status: SyncStatus.INVALID, failure_reason: `Invalid model: ${model}` });
    return responseWrapper({ res, status: 400, message: `Invalid model: ${model}` });
  }

  const repository = repositories[model];

  const tx = await sequelize.transaction();

  try {
    const results = [];
    const incomingIds = data.map((item: any) => item.id).filter((id: any) => id !== undefined && id !== null);

    let existingIdsSet = new Set<any>();
    if (incomingIds.length > 0) {
      const existingRecords = await repository.findAll({
        where: { id: incomingIds },
        attributes: ['id'],
        transaction: tx,
      });
      existingIdsSet = new Set(existingRecords.map((r: any) => r.id));
    }

    for (const item of data) {
      const { id, ...attributes } = item;
      const isExisting = id !== undefined && id !== null && existingIdsSet.has(id);

      if (isExisting) {
        await repository.update(attributes, { where: { id }, transaction: tx });
        results.push({ id, status: 'updated' });
        if (model === 'orders' && item.items) {
          for (const orderItem of item.items) {
            await upsertOrderItem({ ...orderItem, order_id: id }, tx);
          }
        }
      } else {
        const created = await repository.create(item, { transaction: tx });
        if (model === 'orders' && item.items) {
          for (const orderItem of item.items) {
            await upsertOrderItem({ ...orderItem, order_id: created.id }, tx);
          }
        }
        results.push({ id: created.id, status: 'created' });
      }
    }

    await tx.commit();
    await syncHistory.update({ status: SyncStatus.SUCCESSFUL });
    return responseWrapper({ res, status: 200, message: 'Sync successful', data: { results } });
  } catch (error: any) {
    await tx.rollback();
    logger.error('Sync error, transaction rolled back:', error);
    await syncHistory.update({ status: SyncStatus.FAILED, failure_reason: error.message });
    return responseWrapper({ res, status: 500, message: error.message });
  }
};

const upsertOrderItem = async (orderItem: any, transaction: any) => {
  if (orderItem.id) {
    await orderItemRepository.update(orderItem, { where: { id: orderItem.id }, transaction });
  } else {
    const createdOrderItem = await orderItemRepository.create(orderItem, { transaction });
    orderItem.id = createdOrderItem.id;
  }
};

export const getStats = async (req: Request, res: Response) => {
  const stats = await syncHistoryRepository.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
    group: ['status'],
  });

  const statsSummary: { [key: string]: number } = {
    successful: 0,
    failed: 0,
    invalid: 0,
    pending_retry: 0,
    total: 0,
  };

  let total = 0;
  for (const stat of stats) {
    const { status, count } = stat.get() as any;
    const numCount = parseInt(count, 10);
    if (
      status &&
      status !== '__proto__' &&
      status !== 'constructor' &&
      status !== 'prototype' &&
      Object.prototype.hasOwnProperty.call(statsSummary, status)
    ) {
      statsSummary[status] = numCount;
    }
    total += numCount;
  }
  statsSummary.total = total;

  return responseWrapper({ res, status: 200, message: 'Sync stats retrieved successfully', data: statsSummary });
};
