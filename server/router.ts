import { IncomingMessage, ServerResponse } from 'http';
import { RouteDefinition, Handler, RequestContext } from './types';

interface RouteOptions {
  requireAuth?: boolean;
  rateLimitKey?: string;
}

const routes: RouteDefinition[] = [];

function pathToRegex(path: string): { regex: RegExp; keys: string[] } {
  const segments = path.split('/').filter(Boolean);
  const keys: string[] = [];
  const pattern = segments
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const regex = new RegExp(`^/${pattern}${path.endsWith('/') ? '/' : ''}$`);
  return { regex, keys };
}

export function registerRoute(method: string, path: string, handler: Handler, options?: RouteOptions) {
  const { regex, keys } = pathToRegex(path);
  routes.push({
    method: method.toUpperCase(),
    path: regex,
    keys,
    handler,
    requireAuth: options?.requireAuth,
    rateLimitKey: options?.rateLimitKey,
  });
}

export function matchRoute(req: IncomingMessage): RouteDefinition | undefined {
  const method = req.method?.toUpperCase();
  const url = req.url ?? '/';
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = route.path.exec(url.split('?')[0]);
    if (match) {
      return route;
    }
  }
  return undefined;
}

export function extractParams(route: RouteDefinition, req: IncomingMessage): Record<string, string> {
  const url = req.url ?? '/';
  const pathname = url.split('?')[0];
  const match = route.path.exec(pathname);
  const params: Record<string, string> = {};
  if (match) {
    for (let i = 0; i < route.keys.length; i += 1) {
      params[route.keys[i]] = decodeURIComponent(match[i + 1]);
    }
  }
  return params;
}

export function createContext(
  req: IncomingMessage,
  res: ServerResponse,
  route: RouteDefinition,
  body: unknown,
  user: RequestContext['user'],
  query: URLSearchParams,
  ip: string,
  deviceId?: string,
  deviceType?: string,
  userAgent?: string,
): RequestContext {
  return {
    req,
    res,
    body,
    user,
    query,
    params: extractParams(route, req),
    ip,
    deviceId,
    deviceType,
    userAgent,
  };
}

export function getRoutes() {
  return routes;
}
