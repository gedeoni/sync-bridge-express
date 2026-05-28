import { getPagination } from './getPagination';

describe('getPagination helper', () => {
  it('should use provided valid page and limit', () => {
    const result = getPagination({ page: 2, limit: 10 });
    expect(result).toEqual({
      limit: 10,
      page: 2,
      offset: 10,
    });
  });

  it('should fall back to default limit (15) and page (1) if they are missing', () => {
    const result = getPagination({});
    expect(result).toEqual({
      limit: 15,
      page: 1,
      offset: 0,
    });
  });

  it('should fall back to default limit (15) and page (1) if zero or negative is provided', () => {
    const resultZero = getPagination({ page: 0, limit: 0 });
    expect(resultZero).toEqual({
      limit: 15,
      page: 1,
      offset: 0,
    });

    const resultNegative = getPagination({ page: -5, limit: -10 });
    expect(resultNegative).toEqual({
      limit: 15,
      page: 1,
      offset: 0,
    });
  });
});
