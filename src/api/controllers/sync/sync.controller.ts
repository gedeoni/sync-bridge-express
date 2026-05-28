import { Request, Response } from 'express';
import { Transaction } from 'sequelize';
import { Model } from 'sequelize-typescript';
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

// ==========================================
// 1. Interfaces & Types
// ==========================================

interface SyncPayload {
  model: 'customers' | 'products' | 'orders' | 'employees';
  data: Array<Record<string, any> & { id?: number | string }>;
}

interface SyncProcessor<T extends Model = Model> {
  postSync?: (rawItem: any, record: T, tx: Transaction) => Promise<void>;
}

// ==========================================
// 2. Repositories & Custom Processors Registry
// ==========================================
/**
 * Custom order-item upsert utility
 */
const upsertOrderItem = async (orderItem: any, transaction: Transaction) => {
  if (orderItem.id) {
    await orderItemRepository.update(orderItem, { where: { id: orderItem.id }, transaction });
  } else {
    const created = await orderItemRepository.create(orderItem, { transaction });
    orderItem.id = created.id;
  }
};

/**
 * Model-specific processor registry (Open-Closed Principle)
 * Adding child relationships for new models is done here, leaving the core loop untouched.
 */
const processors: Partial<Record<SyncPayload['model'], SyncProcessor>> = {
  orders: {
    postSync: async (rawItem, record, tx) => {
      if (rawItem.items && Array.isArray(rawItem.items)) {
        for (const orderItem of rawItem.items) {
          await upsertOrderItem({ ...orderItem, order_id: record.get('id') }, tx);
        }
      }
    },
  },
};

// ==========================================
// 3. Core Sync Operations
// ==========================================

/**
 * Upserts a single model item and runs post-sync hooks if registered
 */
const syncSingleItem = async (
  repository: any,
  item: Record<string, any>,
  existingIdsSet: Set<any>,
  processor: SyncProcessor | undefined,
  tx: Transaction
): Promise<{ id: any; status: 'created' | 'updated' }> => {
  const { id } = item;
  const isExisting = id !== undefined && id !== null && existingIdsSet.has(id);

  if (isExisting) {
    const attributes = { ...item };
    delete attributes.id;
    await repository.update(attributes, { where: { id }, transaction: tx });

    // Fetch the updated instance to pass to postSync if needed
    const updatedRecord = await repository.findByPk(id, { transaction: tx });
    if (processor?.postSync && updatedRecord) {
      await processor.postSync(item, updatedRecord, tx);
    }
    return { id, status: 'updated' };
  } else {
    const createdRecord = await repository.create(item, { transaction: tx });
    if (processor?.postSync) {
      await processor.postSync(item, createdRecord, tx);
    }
    return { id: createdRecord.get('id'), status: 'created' };
  }
};

// ==========================================
// 4. Controller Handlers
// ==========================================

/**
 * Synchronizes a batch of model data (Creates/Updates) within a transaction
 */
export const sync = async (req: Request, res: Response) => {
  const { model, data } = req.body as SyncPayload;

  const syncHistory = await syncHistoryRepository.create({
    payload: req.body,
    status: SyncStatus.PENDING_RETRY,
  });

  let repository: any;
  switch (model) {
    case 'customers':
      repository = customerRepository;
      break;
    case 'products':
      repository = productRepository;
      break;
    case 'orders':
      repository = orderRepository;
      break;
    case 'employees':
      repository = employeeRepository;
      break;
    default:
      return responseWrapper({ res, status: 400, message: `Invalid model: ${model}` });
  }

  let processor;
  switch (model) {
    case 'orders':
      processor = processors.orders;
      break;
    default:
      processor = undefined;
  }

  const tx = await sequelize.transaction();

  try {
    // 1. Gather all incoming IDs and batch fetch existing records to minimize DB lookups
    const incomingIds = data
      .map((item) => item.id)
      .filter((id): id is string | number => id !== undefined && id !== null);

    let existingIdsSet = new Set<any>();
    if (incomingIds.length > 0) {
      const existingRecords = await repository.findAll({
        where: { id: incomingIds },
        attributes: ['id'],
        transaction: tx,
      });
      existingIdsSet = new Set(existingRecords.map((r: any) => r.get('id')));
    }

    // 2. Process items
    const results = [];
    for (const item of data) {
      const result = await syncSingleItem(repository, item, existingIdsSet, processor, tx);
      results.push(result);
    }

    // 3. Commit operations and log success
    await tx.commit();
    await syncHistory.update({ status: SyncStatus.SUCCESSFUL });

    return responseWrapper({
      res,
      status: 200,
      message: `${model.charAt(0).toUpperCase() + model.slice(1)} synchronized successfully`,
      data: { results },
    });
  } catch (error: any) {
    await tx.rollback();
    logger.error(`Sync transaction rolled back for model ${model}:`, error);

    await syncHistory.update({
      status: SyncStatus.FAILED,
      failure_reason: error.message || 'Unknown database error',
    });

    return responseWrapper({ res, status: 500, message: error.message });
  }
};

/**
 * Retrieves aggregate statistics for sync history
 */
export const getStats = async (req: Request, res: Response) => {
  const stats = await syncHistoryRepository.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
    group: ['status'],
  });

  // Initialize summary map directly using known status enums
  const statsSummary: Record<SyncStatus | 'total', number> = {
    [SyncStatus.SUCCESSFUL]: 0,
    [SyncStatus.FAILED]: 0,
    [SyncStatus.INVALID]: 0,
    [SyncStatus.PENDING_RETRY]: 0,
    total: 0,
  };

  let totalCount = 0;
  for (const stat of stats) {
    const { status, count } = stat.get() as { status: SyncStatus; count: string };
    const numCount = parseInt(count, 10) || 0;

    switch (status) {
      case SyncStatus.SUCCESSFUL:
        statsSummary.successful = numCount;
        break;
      case SyncStatus.FAILED:
        statsSummary.failed = numCount;
        break;
      case SyncStatus.INVALID:
        statsSummary.invalid = numCount;
        break;
      case SyncStatus.PENDING_RETRY:
        statsSummary.pending_retry = numCount;
        break;
    }
    totalCount += numCount;
  }
  statsSummary.total = totalCount;

  return responseWrapper({
    res,
    status: 200,
    message: 'Sync statistics retrieved successfully',
    data: statsSummary,
  });
};
