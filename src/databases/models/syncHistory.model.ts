import {
  Table,
  Column,
  Model,
  DataType,
  AllowNull,
  Default,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export enum SyncStatus {
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  INVALID = 'invalid',
  PENDING_RETRY = 'pending_retry',
}

@Table({
  tableName: 'sync_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export default class SyncHistory extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @Column(DataType.JSON)
  payload: any;

  @AllowNull(false)
  @Default(SyncStatus.PENDING_RETRY)
  @Column(DataType.ENUM(...Object.values(SyncStatus)))
  status!: SyncStatus;

  @Column(DataType.TEXT)
  failure_reason!: string;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  retries!: number;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}
