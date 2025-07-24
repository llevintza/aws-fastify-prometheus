import PrometheusMetrics from '@/index';

describe('PrometheusMetrics', () => {
  it('should create an instance', () => {
    const metrics = new PrometheusMetrics();
    expect(metrics).toBeDefined();
  });

  it('should return a registry', () => {
    const metrics = new PrometheusMetrics();
    const registry = metrics.getRegistry();
    expect(registry).toBeDefined();
  });
});