import { logger } from './logger';

describe('logger serializer', () => {
  const reqSerializer = (logger as any).serializers.req;

  it('should return falsy value if request is falsy', () => {
    expect(reqSerializer(null)).toBeNull();
    expect(reqSerializer(undefined)).toBeUndefined();
  });

  it('should sanitize x-auth-token and authorization headers and serialize standard properties', () => {
    const mockReq = {
      id: 'req-123',
      method: 'POST',
      url: '/api/v1/sync',
      headers: {
        'x-auth-token': 'secret-token-123',
        authorization: 'Bearer xyz123',
        'content-type': 'application/json',
      },
      connection: {
        remoteAddress: '127.0.0.1',
        remotePort: 54321,
      },
    };

    const result = reqSerializer(mockReq);

    expect(result).toEqual({
      id: 'req-123',
      method: 'POST',
      url: '/api/v1/sync',
      headers: {
        'x-auth-token': '[REDACTED]',
        authorization: '[REDACTED]',
        'content-type': 'application/json',
      },
      remoteAddress: '127.0.0.1',
      remotePort: 54321,
    });
  });

  it('should return undefined for remoteAddress and remotePort if connection is not present', () => {
    const mockReq = {
      id: 'req-456',
      method: 'GET',
      url: '/api/v1/healthz',
      headers: {
        'content-type': 'application/json',
      },
    };

    const result = reqSerializer(mockReq);

    expect(result).toEqual({
      id: 'req-456',
      method: 'GET',
      url: '/api/v1/healthz',
      headers: {
        'content-type': 'application/json',
      },
      remoteAddress: undefined,
      remotePort: undefined,
    });
  });
});
