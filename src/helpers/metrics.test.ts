import { metricsHandler, register } from './metrics';

describe('metricsHandler helper', () => {
  it('should set Content-Type header and output metrics in the response body', async () => {
    const mockReq = {} as any;

    const setMock = jest.fn();
    const endMock = jest.fn();
    const mockRes = {
      set: setMock,
      end: endMock,
    } as any;

    const spyGetMetrics = jest.spyOn(register, 'metrics').mockResolvedValueOnce('mocked_prometheus_metrics_output');

    await metricsHandler(mockReq, mockRes);

    expect(setMock).toHaveBeenCalledWith('Content-Type', register.contentType);
    expect(endMock).toHaveBeenCalledWith('mocked_prometheus_metrics_output');

    spyGetMetrics.mockRestore();
  });
});
