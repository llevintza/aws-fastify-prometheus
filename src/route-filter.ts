/**
 * Route filtering helpers for the Fastify plugin
 */

import type { RouteFilterConfig, RouteMatcher, RouteMatchMode } from './types';

/**
 * Test a single matcher against a route label.
 *
 * Strings honour `mode` (`'substring'` uses `String.includes`, `'exact'` uses equality).
 * RegExp and function matchers ignore `mode`.
 */
export function matchesRoute(
  route: string,
  matcher: RouteMatcher,
  mode: RouteMatchMode = 'substring'
): boolean {
  if (typeof matcher === 'string') {
    return mode === 'exact' ? route === matcher : route.includes(matcher);
  }
  if (matcher instanceof RegExp) {
    // `search` ignores `lastIndex`, so global/sticky regexes stay stateless across requests.
    return route.search(matcher) !== -1;
  }
  return matcher(route);
}

/**
 * Decide whether HTTP metrics should be recorded for a route label.
 *
 * A route is skipped when it matches any `excludeRoutes` entry, or when `includeRoutes`
 * is non-empty and the route matches none of its entries.
 */
export function shouldRecord(route: string, config: RouteFilterConfig): boolean {
  const mode = config.routeMatch ?? 'substring';

  if (config.excludeRoutes?.some(matcher => matchesRoute(route, matcher, mode)) === true) {
    return false;
  }

  if (
    config.includeRoutes !== undefined &&
    config.includeRoutes.length > 0 &&
    !config.includeRoutes.some(matcher => matchesRoute(route, matcher, mode))
  ) {
    return false;
  }

  return true;
}
