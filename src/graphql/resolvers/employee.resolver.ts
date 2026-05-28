import { Resolver, Query, Arg, Int, Mutation, InputType, Field, FieldResolver, Root, Subscription } from 'type-graphql';
import { Employee } from '../../databases/models/employee.model';
import { employeeRepository, sequelize } from '../../databases/sequelize';
import { Op } from 'sequelize';
import { pubSub } from '../pubsubInstance';

@InputType()
class CreateEmployeeInput {
  @Field()
  id!: number;

  @Field()
  employeeId!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field({ nullable: true })
  middleName?: string;

  @Field({ nullable: true })
  company?: string;

  @Field({ nullable: true })
  jobTitle?: string;
}

@InputType()
class UpdateEmployeeInput {
  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  middleName?: string;

  @Field({ nullable: true })
  company?: string;

  @Field({ nullable: true })
  jobTitle?: string;
}

@Resolver(Employee)
export class EmployeeResolver {
  @Query(() => [Employee])
  async employees(
    @Arg('offset', () => Int, { defaultValue: 0 }) offset: number,
    @Arg('limit', () => Int, { defaultValue: 10 }) limit: number
  ): Promise<Employee[]> {
    return employeeRepository.findAll({ offset, limit });
  }

  @Query(() => Employee, { nullable: true })
  async employee(@Arg('id', () => Int) id: number): Promise<Employee | null> {
    return employeeRepository.findByPk(id);
  }

  @Query(() => [Employee])
  async searchEmployees(
    @Arg('search', { nullable: false }) search: string,
    @Arg('offset', () => Int, { defaultValue: 0 }) offset: number,
    @Arg('limit', () => Int, { defaultValue: 10 }) limit: number
  ): Promise<Employee[]> {
    const searchTerm = `%${search}%`;

    const dialect = sequelize.getDialect();
    const likeOp = dialect === 'sqlite' ? Op.like : Op.iLike;

    return employeeRepository.findAll({
      where: {
        [Op.or]: [
          { firstName: { [likeOp]: searchTerm } },
          { lastName: { [likeOp]: searchTerm } },
          { email: { [likeOp]: searchTerm } },
        ],
      },
      offset,
      limit,
    });
  }

  // Mutations
  @Mutation(() => Employee)
  async createEmployee(@Arg('data') data: CreateEmployeeInput): Promise<Employee> {
    const emp = await employeeRepository.create(data as any);
    pubSub.publish('EMPLOYEE_CREATED', emp);
    return emp;
  }

  @Mutation(() => Employee, { nullable: true })
  async updateEmployee(
    @Arg('id', () => Int) id: number,
    @Arg('data') data: UpdateEmployeeInput
  ): Promise<Employee | null> {
    const emp = await employeeRepository.findByPk(id);
    if (!emp) return null;
    await emp.update(data as any);
    return emp;
  }

  @Mutation(() => Boolean)
  async deleteEmployee(@Arg('id', () => Int) id: number): Promise<boolean> {
    const count = await employeeRepository.destroy({ where: { id } });
    return count > 0;
  }

  // Field resolver
  @FieldResolver(() => String)
  fullName(@Root() e: Employee): string {
    return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
  }

  // Subscription (requires WS transport to be usable)
  @Subscription(() => Employee, { topics: 'EMPLOYEE_CREATED' })
  employeeCreated(@Root() payload: Employee): Employee {
    // console.log('New employee created:', payload);
    return payload;
  }
}
