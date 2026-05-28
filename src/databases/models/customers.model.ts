import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  Default,
  IsEmail,
  AllowNull,
  AutoIncrement,
} from 'sequelize-typescript';
import { ObjectType, Field, Int } from 'type-graphql';

@ObjectType()
@Table({
  tableName: 'customers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export default class Customer extends Model {
  @Field(() => Int)
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id!: number;

  @Field()
  @IsEmail
  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
    unique: true,
  })
  email!: string;

  @Field()
  @AllowNull(false)
  @Column(DataType.TEXT)
  first_name!: string;

  @Field()
  @AllowNull(false)
  @Column(DataType.TEXT)
  last_name!: string;

  @Field()
  @AllowNull(false)
  @Default('USD')
  @Column(DataType.CHAR(3))
  default_currency!: string;

  @Field()
  @Column({
    type: DataType.VIRTUAL,
    get() {
      return `${this.getDataValue('first_name')} ${this.getDataValue('last_name')}`;
    },
  })
  full_name!: string;

  @Field()
  @CreatedAt
  created_at!: Date;

  @Field()
  @UpdatedAt
  updated_at!: Date;
}
