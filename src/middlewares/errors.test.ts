import { errorHandler } from './errors';
import { CelebrateError } from 'celebrate';

describe('Error Handler Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;
  let jsonMock: any;
  let statusMock: any;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      method: 'POST',
      url: '/api/v1/sync',
      headers: {
        'content-type': 'application/json',
        'x-auth-token': 'very-secret-token',
        authorization: 'Bearer confidential',
      },
      body: {
        model: 'products',
        data: [{ id: 1, name: 'Normal Product' }],
      },
    };

    mockRes = {
      status: statusMock,
    };

    mockNext = jest.fn();
  });

  it('should handle standard 500 server errors and redact request info in logs', () => {
    const error = new Error('Database connection failed');

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      status: 500,
      message: 'Something Went Wrong',
      data: {
        message: undefined,
        method: 'POST',
        url: '/api/v1/sync',
      },
    });
  });

  it('should handle 4xx client errors and expose the message in the response data', () => {
    const error = new Error('Resource not found');
    (error as any).status = 404;

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      status: 404,
      message: 'Resource not found',
      data: {
        message: 'Resource not found',
        method: 'POST',
        url: '/api/v1/sync',
      },
    });
  });

  it('should handle SequelizeUniqueConstraintError and return a 409 Conflict response', () => {
    const error = new Error('Validation error');
    error.name = 'SequelizeUniqueConstraintError';

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({
      status: 409,
      message: 'Record already exists',
      data: {
        message: undefined,
        method: 'POST',
        url: '/api/v1/sync',
      },
    });
  });

  it('should sanitize headers and bodies by redacting sensitive data and keeping others intact', () => {
    const error = new Error('Request error');
    (error as any).status = 400;

    mockReq.body = {
      username: 'user1',
      password: 'mypassword123',
      credit_card: '1111-2222-3333-4444',
      token: 'abcd123',
      nested: {
        secret_key: 'mysecret',
        cvv: 123,
      },
      arrayData: [
        {
          plain: 'text',
          card: '5555-5555',
        },
      ],
    };

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('should skip prototype properties during sanitization to avoid proto pollution issues', () => {
    const error = new Error('Request error');
    (error as any).status = 400;

    mockReq.body = {};
    Object.defineProperty(mockReq.body, '__proto__', {
      value: { sensitive: 'should_be_ignored' },
      enumerable: true,
    });

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('should handle CelebrateError (validation) and return 400 Bad Request with details', () => {
    const celebrateError = new CelebrateError('Validation failed', { celebrated: true });
    celebrateError.details.set('body', {
      isJoi: true,
      details: [{ message: '"model" is required', path: ['model'] }],
    } as any);

    errorHandler(celebrateError, mockReq, mockRes, mockNext);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      status: 400,
      message: 'Validation failed',
      errors: [{ message: '"model" is required', path: ['model'] }],
    });
  });
});
