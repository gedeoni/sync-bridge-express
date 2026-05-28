import { Request, Response } from 'express';
import { getPagination } from '../../../helpers/getPagination';
import { syncHistoryRepository } from '../../../databases/sequelize';
import { SyncStatus } from '../../../databases/models/syncHistory.model';
import { responseWrapper } from '../../../helpers/responseWrapper';

export const getAll = async (req: Request, res: Response) => {
  const { page, size, status } = req.query;
  const { limit, offset } = getPagination({ page: Number(page), limit: Number(size) });

  const where: any = {};
  if (status) {
    where.status = status;
  }

  const { rows, count } = await syncHistoryRepository.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });

  const pages = Math.ceil(count / limit);

  return responseWrapper({
    res,
    status: 200,
    message: 'Sync histories retrieved successfully',
    data: {
      count,
      pages,
      rows,
    },
  });
};

export const getById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const syncHistory = await syncHistoryRepository.findByPk(id);

  if (!syncHistory) {
    return responseWrapper({ res, status: 404, message: 'Sync history not found' });
  }

  return responseWrapper({ res, status: 200, message: 'Sync history retrieved successfully', data: syncHistory });
};

export const retry = async (req: Request, res: Response) => {
  const { id } = req.params;
  const syncHistory = await syncHistoryRepository.findByPk(id);

  if (!syncHistory) {
    return responseWrapper({ res, status: 404, message: 'Sync history not found' });
  }

  if (syncHistory.get('status') !== SyncStatus.FAILED) {
    return responseWrapper({ res, status: 400, message: 'Only failed syncs can be retried' });
  }

  syncHistory.set('status', SyncStatus.PENDING_RETRY);
  await syncHistory.save();

  return responseWrapper({ res, status: 200, message: 'Sync history will be retried', data: syncHistory });
};

export const deleteById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const syncHistory = await syncHistoryRepository.findByPk(id);

  if (!syncHistory) {
    return responseWrapper({ res, status: 404, message: 'Sync history not found' });
  }

  await syncHistory.destroy();

  return responseWrapper({ res, status: 204, message: 'Sync history deleted successfully' });
};
