import { IncomingMessage, ServerResponse } from 'http';

export interface AuthenticatedUser {
  id: string;
  email: string;
  nickname?: string | null;
}

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  body?: unknown;
  user?: AuthenticatedUser;
  query: URLSearchParams;
  params: Record<string, string>;
  ip: string;
  deviceId?: string;
  deviceType?: string;
  userAgent?: string;
}

export type Handler = (context: RequestContext) => Promise<void> | void;

export interface RouteDefinition {
  method: string;
  path: RegExp;
  keys: string[];
  handler: Handler;
  requireAuth?: boolean;
  rateLimitKey?: string;
}
