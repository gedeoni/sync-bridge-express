describe('customEnv validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Make a shallow copy of process.env to restore it later
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore the original environment
    process.env = originalEnv;
  });

  it('should validate process.env and export env values successfully', () => {
    // Ensure all required env variables are present
    process.env.DATABASE_URI = 'sqlite::memory:';
    process.env.AUTHORIZATION_KEY = 'my-token';

    let customEnvModule: any = null;
    jest.isolateModules(() => {
      customEnvModule = require('./customEnv');
    });

    expect(customEnvModule).not.toBeNull();
    expect(customEnvModule.customEnv).toBeDefined();
    expect(customEnvModule.customEnv.DATABASE_URI).toEqual('sqlite::memory:');
    expect(customEnvModule.customEnv.AUTHORIZATION_KEY).toEqual('my-token');
  });

  it('should throw environment validation error when a required variable is missing', () => {
    // Delete a required variable
    delete process.env.DATABASE_URI;

    expect(() => {
      jest.isolateModules(() => {
        require('./customEnv');
      });
    }).toThrow(/Environment validation failed/);
  });
});
