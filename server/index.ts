import http from 'http';
import { env } from './config';
import { initRoutes } from './registerRoutes';
import { createContext, matchRoute } from './router';
import { parseJsonBody } from './middleware/bodyParser';
import { sendError } from './utils/response';
import { checkRateLimit } from './middleware/rateLimiter';
import { getUserFromToken } from './services/supabaseClient';

initRoutes();

function getIp(req: http.IncomingMessage) {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function setCorsHeaders(res: http.ServerResponse, origin: string) {
  const allowedOrigins = env.corsOrigins;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Device-Type, X-Admin-Secret');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

const server = http.createServer(async (req, res) => {
  const origin = (req.headers.origin as string) || '*';
  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const route = matchRoute(req);
    if (!route) {
      sendError(res, 404, 'Not Found', 'NOT_FOUND');
      return;
    }

    const ip = getIp(req);
    const identifier = route.requireAuth ? req.headers.authorization || ip : ip;
    if (route.rateLimitKey && !checkRateLimit(route.rateLimitKey, identifier)) {
      sendError(res, 429, 'Too Many Requests', 'RATE_LIMITED');
      return;
    }

    let body: unknown;
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method || '')) {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        body = await parseJsonBody(req);
      }
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const query = url.searchParams;

    let user;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (accessToken) {
      user = await getUserFromToken(accessToken);
    }

    if (route.requireAuth && !user) {
      sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');
      return;
    }

    const context = createContext(
      req,
      res,
      route,
      body,
      user,
      query,
      ip,
      (req.headers['x-device-id'] as string) || undefined,
      (req.headers['x-device-type'] as string) || undefined,
      req.headers['user-agent'],
    );

    await route.handler(context);
  } catch (error: any) {
    console.error('Server error', error);
    if (!res.headersSent) {
      sendError(res, 500, error.message ?? 'Internal Server Error', 'INTERNAL_ERROR');
    }
  }
});

server.listen(env.port, () => {
  console.log(`PromptMate API server listening on port ${env.port}`);
});
