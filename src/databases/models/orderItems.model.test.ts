import { sequelize, orderItemRepository } from '../sequelize';

describe('OrderItem Model Virtual Fields', () => {
  beforeAll(async () => {
    // We synchronize the OrderItem model in SQLite memory db to register attributes correctly
    await sequelize.sync({ force: true });
  });

  it('should correctly compute virtual column line_total from quantity and unit price', () => {
    const item = orderItemRepository.build({
      qty: 6,
      unit_price: 15,
    });

    expect(item.line_total).toEqual(90);
  });
});
