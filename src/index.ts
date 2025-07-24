import { register } from 'prom-client';

export class PrometheusMetrics {
  constructor() {
    // Initialize Prometheus metrics
  }

  getRegistry() {
    return register;
  }

  getMetrics(): Promise<string> {
    return register.metrics();
  }
}

export default PrometheusMetrics;