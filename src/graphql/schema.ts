import { buildSchema } from 'type-graphql';
import { EmployeeResolver } from './resolvers/employee.resolver';
import { CustomerResolver } from './resolvers/customer.resolver';
import { pubSub } from './pubsubInstance';

export const createSchema = async () => {
  return buildSchema({
    resolvers: [EmployeeResolver, CustomerResolver],
    emitSchemaFile: true,
    validate: false,
    pubSub,
  });
};
