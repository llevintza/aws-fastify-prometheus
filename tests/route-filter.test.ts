/**
 * Unit tests for the pure route filter helpers
 */

import { describe, test, expect } from '@jest/globals';

import { matchesRoute, shouldRecord } from '../src/index';

describe('matchesRoute', () => {
  test('string matcher uses substring matching by default', () => {
    expect(matchesRoute('/healthcare', '/health')).toBe(true);
    expect(matchesRoute('/users', '/health')).toBe(false);
  });

  test('string matcher uses equality in exact mode', () => {
    expect(matchesRoute('/health', '/health', 'exact')).toBe(true);
    expect(matchesRoute('/healthcare', '/health', 'exact')).toBe(false);
  });

  test('RegExp matcher ignores mode', () => {
    expect(matchesRoute('/api/v1/users', /^\/api\//, 'exact')).toBe(true);
    expect(matchesRoute('/web/api/', /^\/api\//)).toBe(false);
  });

  test('global RegExp matcher is stateless across calls', () => {
    const matcher = /health/g;
    expect(matchesRoute('/health', matcher)).toBe(true);
    expect(matchesRoute('/health', matcher)).toBe(true);
  });

  test('function matcher receives the route', () => {
    const matcher = (route: string): boolean => route.startsWith('/internal');
    expect(matchesRoute('/internal/x', matcher, 'exact')).toBe(true);
    expect(matchesRoute('/public', matcher)).toBe(false);
  });
});

describe('shouldRecord', () => {
  test('records everything when no filters are set', () => {
    expect(shouldRecord('/anything', {})).toBe(true);
    expect(shouldRecord('/anything', { excludeRoutes: [], includeRoutes: [] })).toBe(true);
  });

  test('substring exclusion drops similar routes (legacy default)', () => {
    const config = { excludeRoutes: ['/health'] };
    expect(shouldRecord('/health', config)).toBe(false);
    expect(shouldRecord('/healthcare', config)).toBe(false);
    expect(shouldRecord('/users', config)).toBe(true);
  });

  test('exact exclusion keeps similar routes', () => {
    const config = { excludeRoutes: ['/health'], routeMatch: 'exact' as const };
    expect(shouldRecord('/health', config)).toBe(false);
    expect(shouldRecord('/healthcare', config)).toBe(true);
  });

  test('include list restricts recording to matching routes', () => {
    const config = { includeRoutes: ['/api'] };
    expect(shouldRecord('/api/users', config)).toBe(true);
    expect(shouldRecord('/web', config)).toBe(false);
  });

  test('exact include requires equality', () => {
    const config = { includeRoutes: ['/api'], routeMatch: 'exact' as const };
    expect(shouldRecord('/api', config)).toBe(true);
    expect(shouldRecord('/api/users', config)).toBe(false);
  });

  test('RegExp and function matchers work for exclude', () => {
    expect(shouldRecord('/admin/x', { excludeRoutes: [/^\/admin/] })).toBe(false);
    expect(shouldRecord('/x', { excludeRoutes: [(r: string) => r === '/x'] })).toBe(false);
    expect(shouldRecord('/y', { excludeRoutes: [/^\/admin/, (r: string) => r === '/x'] })).toBe(
      true
    );
  });

  test('RegExp and function matchers work for include', () => {
    expect(shouldRecord('/api/x', { includeRoutes: [/^\/api\//] })).toBe(true);
    expect(shouldRecord('/web', { includeRoutes: [/^\/api\//] })).toBe(false);
    expect(shouldRecord('/v2', { includeRoutes: [(r: string) => r.startsWith('/v2')] })).toBe(true);
  });

  test('exclusion wins over inclusion', () => {
    expect(
      shouldRecord('/api/health', { includeRoutes: ['/api'], excludeRoutes: ['health'] })
    ).toBe(false);
  });
});
