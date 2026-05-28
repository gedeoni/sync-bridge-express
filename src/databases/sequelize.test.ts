import { connect } from './sequelize';
import { Sequelize } from 'sequelize-typescript';
import { customEnv } from '../helpers/customEnv';
import { logger } from '../helpers/logger';

// Mock the Sequelize class constructor to avoid actual DB connection/initialization
jest.mock('sequelize-typescript', () => {
  const original = jest.requireActual('sequelize-typescript');
  return {
    ...original,
    Sequelize: jest.fn().mockImplementation((url, options) => {
      return {
        url,
        options,
        getRepository: jest.fn().mockReturnValue({}),
      };
    }),
  };
});

describe('Sequelize Connect Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should configure SQLite database in-memory when URL is memory-based', () => {
    const prevNodeEnv = customEnv.NODE_ENV;
    (customEnv as any).NODE_ENV = 'test';

    const result = connect('sqlite::memory:') as any;

    expect(Sequelize).toHaveBeenCalled();
    expect(result.options.dialect).toEqual('sqlite');
    expect(result.options.storage).toEqual(':memory:');
    expect(result.options.pool).toEqual({
      max: 1,
      min: 1,
      idle: 900000,
    });

    (customEnv as any).NODE_ENV = prevNodeEnv;
  });

  it('should configure replication for SQLite database when not in test mode and not memory-based', () => {
    const prevNodeEnv = customEnv.NODE_ENV;
    const prevSlave = customEnv.SLAVE_ONE;
    const prevMain = customEnv.MAIN_HOST;

    (customEnv as any).NODE_ENV = 'production';
    (customEnv as any).SLAVE_ONE = 'custom_replica.sqlite';
    (customEnv as any).MAIN_HOST = 'custom_main.sqlite';

    const result = connect('sqlite://somepath.sqlite') as any;

    expect(result.options.dialect).toEqual('sqlite');
    expect(result.options.replication).toBeDefined();
    expect((result.options.replication.read as any)[0].storage).toEqual('custom_replica.sqlite');
    expect(result.options.replication.write.storage).toEqual('custom_main.sqlite');

    (customEnv as any).NODE_ENV = prevNodeEnv;
    (customEnv as any).SLAVE_ONE = prevSlave;
    (customEnv as any).MAIN_HOST = prevMain;
  });

  it('should configure replication with default storage paths for SQLite when environment hosts are missing', () => {
    const prevNodeEnv = customEnv.NODE_ENV;
    const prevSlave = customEnv.SLAVE_ONE;
    const prevMain = customEnv.MAIN_HOST;

    (customEnv as any).NODE_ENV = 'production';
    (customEnv as any).SLAVE_ONE = '';
    (customEnv as any).MAIN_HOST = '';

    const result = connect('sqlite://somepath.sqlite') as any;

    expect(result.options.dialect).toEqual('sqlite');
    expect(result.options.replication).toBeDefined();
    expect((result.options.replication.read as any)[0].storage).toEqual('replica.sqlite');
    expect(result.options.replication.write.storage).toEqual('main.sqlite');

    (customEnv as any).NODE_ENV = prevNodeEnv;
    (customEnv as any).SLAVE_ONE = prevSlave;
    (customEnv as any).MAIN_HOST = prevMain;
  });

  it('should configure Postgres options, schema, timezone and connection endpoints when postgres URI is used', () => {
    const prevSlave = customEnv.SLAVE_ONE;
    const prevMain = customEnv.MAIN_HOST;
    const prevSchema = customEnv.DB_SCHEMA;

    (customEnv as any).SLAVE_ONE = 'postgres-slave-host';
    (customEnv as any).MAIN_HOST = 'postgres-main-host';
    (customEnv as any).DB_SCHEMA = 'my_custom_schema';

    const result = connect('postgres://user:pass@localhost:5432/db') as any;

    expect(result.options.dialect).toEqual('postgres');
    expect(result.options.schema).toEqual('my_custom_schema');
    expect(result.options.timezone).toEqual('+2:00');
    expect(result.options.dialectOptions).toEqual({ useUTC: false });
    expect(result.options.replication).toBeDefined();
    expect((result.options.replication.read as any)[0].host).toEqual('postgres-slave-host');
    expect(result.options.replication.write.host).toEqual('postgres-main-host');

    (customEnv as any).SLAVE_ONE = prevSlave;
    (customEnv as any).MAIN_HOST = prevMain;
    (customEnv as any).DB_SCHEMA = prevSchema;
  });

  it('should enable custom Sequelize query logging output under development environment', () => {
    const prevNodeEnv = customEnv.NODE_ENV;
    (customEnv as any).NODE_ENV = 'development';

    const spyLogger = jest.spyOn(logger, 'debug').mockImplementation(() => null as any);

    const result = connect('sqlite::memory:') as any;
    expect(typeof result.options.logging).toEqual('function');

    // Run the logging function to hit the custom logging debug output code path
    result.options.logging('SELECT 1 FROM DUAL;');
    expect(spyLogger).toHaveBeenCalledWith('[Sequelize] SELECT 1 FROM DUAL;');

    (customEnv as any).NODE_ENV = prevNodeEnv;
    spyLogger.mockRestore();
  });
});
