import { IPaginationArgs } from '../types/shared.types';

export const getPagination = (paginationArgs: IPaginationArgs) => {
  const limit = paginationArgs.limit && paginationArgs.limit > 0 ? paginationArgs.limit : 15;
  const page = paginationArgs.page && paginationArgs.page > 0 ? paginationArgs.page : 1;
  const offset = (page - 1) * limit;

  return {
    limit,
    offset,
    page,
  };
};
