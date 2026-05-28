import { Resolver, Query, Arg, Int } from 'type-graphql';
import Customer from '../../databases/models/customers.model';
import { customerRepository } from '../../databases/sequelize';

@Resolver(Customer)
export class CustomerResolver {
  @Query(() => [Customer])
  async customers(
    @Arg('offset', () => Int, { defaultValue: 0 }) offset: number,
    @Arg('limit', () => Int, { defaultValue: 10 }) limit: number
  ): Promise<Customer[]> {
    return customerRepository.findAll({ offset, limit });
  }

  @Query(() => Customer, { nullable: true })
  async customer(@Arg('id', () => Int) id: number): Promise<Customer | null> {
    return customerRepository.findByPk(id);
  }
}
