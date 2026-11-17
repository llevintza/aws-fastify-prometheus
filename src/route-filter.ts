/**
 * Route filtering helpers for the Fastify plugin
 */

import type { RouteFilterConfig, RouteMatcher, RouteMatchMode } from './types';

/**
 * Drop the query string and fragment from a URL (`/x?y=1#z` -> `/x`).
 */
function stripQueryAndFragment(route: string): string {
  const end = route.search(/[?#]/);
  return end === -1 ? route : route.slice(0, end);
}

/**
 * Test a single matcher against a route label.
 *
 * Strings honour `mode`: `'substring'` uses `String.includes` on the route as given, and
 * `'exact'` matches when the route, or the route without its query string and fragment,
 * equals the matcher. RegExp and function matchers ignore `mode` and see the route as given.
 */
export function matchesRoute(
  route: string,
  matcher: RouteMatcher,
  mode: RouteMatchMode = 'exact'
): boolean {
  if (typeof matcher === 'string') {
    if (mode === 'exact') {
      // Comparing the unstripped route too keeps every v2.1.0 exact match working.
      return route === matcher || stripQueryAndFragment(route) === matcher;
    }
    return route.includes(matcher);
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
  const mode = config.routeMatch ?? 'exact';

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
