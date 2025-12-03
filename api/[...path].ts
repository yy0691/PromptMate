/**
 * Vercel Serverless Function 入口
 * 处理所有 API 路由请求
 * 
 * 这个文件将后端 API 转换为 Vercel Serverless Functions
 * 所有 API 请求都会通过这个函数处理
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getRoutes } from '../server/router';
import { initRoutes } from '../server/registerRoutes';
import { getUserFromToken } from '../server/services/supabaseClient';
import { sendError } from '../server/utils/response-vercel';
import type { RouteDefinition } from '../server/types';

// 初始化路由（只执行一次）
let routesInitialized = false;
function initRoutesOnce() {
  if (!routesInitialized) {
    initRoutes();
    routesInitialized = true;
  }
}

function getIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].split(',')[0].trim();
  }
  return (req.headers['x-real-ip'] as string) || 'unknown';
}

function setCorsHeaders(res: VercelResponse, origin: string | undefined) {
  const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());
  const originHeader = origin || '*';
  
  if (allowedOrigins.includes('*') || allowedOrigins.includes(originHeader)) {
    res.setHeader('Access-Control-Allow-Origin', originHeader);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Device-Type, X-Admin-Secret');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

// 将 Vercel 请求转换为内部格式
function createMockRequest(req: VercelRequest, path: string): any {
  return {
    method: req.method,
    url: path + (req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''),
    headers: req.headers,
  };
}

// 提取路径参数
function extractParams(route: RouteDefinition, path: string): Record<string, string> {
  const match = route.path.exec(path);
  const params: Record<string, string> = {};
  if (match && route.keys) {
    for (let i = 0; i < route.keys.length; i += 1) {
      params[route.keys[i]] = decodeURIComponent(match[i + 1] || '');
    }
  }
  return params;
}

// 创建请求上下文
function createContext(
  req: VercelRequest,
  res: VercelResponse,
  route: RouteDefinition,
  path: string,
  body: unknown,
  user: any,
  query: URLSearchParams,
  ip: string,
  deviceId?: string,
  deviceType?: string,
  userAgent?: string,
) {
  return {
    req: createMockRequest(req, path),
    res,
    body,
    user,
    query,
    params: extractParams(route, path),
    ip,
    deviceId,
    deviceType,
    userAgent,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 立即输出日志，确保函数被调用
  // 使用 process.stdout.write 确保日志立即输出
  process.stdout.write('[Vercel API] ===== Function called =====\n');
  process.stdout.write(`[Vercel API] Method: ${req.method}\n`);
  process.stdout.write(`[Vercel API] URL: ${req.url}\n`);
  process.stdout.write(`[Vercel API] Query: ${JSON.stringify(req.query)}\n`);
  console.log('[Vercel API] ===== Function called =====');
  console.log('[Vercel API] Method:', req.method);
  console.log('[Vercel API] URL:', req.url);
  console.log('[Vercel API] Query:', JSON.stringify(req.query));
  console.log('[Vercel API] Headers:', JSON.stringify(req.headers));
  
  // 初始化路由
  try {
    console.log('[Vercel API] Initializing routes...');
    initRoutesOnce();
    const routes = getRoutes();
    console.log('[Vercel API] Routes initialized, total routes:', routes.length);
    if (routes.length === 0) {
      console.error('[Vercel API] WARNING: No routes registered!');
    } else {
      console.log('[Vercel API] Registered routes:', routes.map(r => `${r.method} ${r.path.toString()}`).slice(0, 5));
    }
  } catch (error) {
    console.error('[Vercel API] Route initialization error:', error);
    console.error('[Vercel API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    sendError(res, 500, 'Failed to initialize routes', 'INIT_ERROR');
    return;
  }
  
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    console.log('[Vercel API] Handling OPTIONS request');
    res.status(204).end();
    return;
  }

  try {
    // 构建请求路径
    // Vercel catch-all 路由会将路径作为 query.path 数组传递
    // 例如 /api/auth/login/email -> query.path = ['auth', 'login', 'email']
    let pathArray: string[] = [];
    
    console.log('[Vercel API] Raw query.path:', req.query.path, 'type:', typeof req.query.path, 'isArray:', Array.isArray(req.query.path));
    console.log('[Vercel API] Raw req.url:', req.url);
    
    // 优先从 req.query.path 获取路径
    if (req.query.path) {
      if (Array.isArray(req.query.path)) {
        pathArray = req.query.path as string[];
        console.log('[Vercel API] Using query.path (array):', pathArray);
      } else if (typeof req.query.path === 'string') {
        pathArray = [req.query.path];
        console.log('[Vercel API] Using query.path (string):', pathArray);
      }
    }
    
    // 如果 pathArray 为空，尝试从 req.url 中提取路径
    if (pathArray.length === 0 && req.url) {
      console.log('[Vercel API] query.path is empty, extracting from req.url');
      try {
        // 尝试解析完整 URL
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathSegments = url.pathname.split('/').filter(Boolean);
        console.log('[Vercel API] Parsed pathname segments:', pathSegments);
        // 移除 'api' 前缀（如果存在）
        if (pathSegments[0] === 'api') {
          pathArray = pathSegments.slice(1);
        } else {
          pathArray = pathSegments;
        }
        console.log('[Vercel API] Extracted pathArray from URL:', pathArray);
      } catch (e) {
        console.log('[Vercel API] URL parsing failed, trying string split:', e);
        // 如果 URL 解析失败，尝试简单字符串解析
        const urlPath = req.url.split('?')[0];
        const pathSegments = urlPath.split('/').filter(Boolean);
        console.log('[Vercel API] Split path segments:', pathSegments);
        if (pathSegments[0] === 'api') {
          pathArray = pathSegments.slice(1);
        } else {
          pathArray = pathSegments;
        }
        console.log('[Vercel API] Extracted pathArray from string:', pathArray);
      }
    }
    
    // 路径需要包含 /api 前缀才能匹配注册的路由
    const path = '/api/' + pathArray.join('/');
    const pathname = path.split('?')[0]; // 移除查询字符串
    
    console.log('[Vercel API] Final pathArray:', pathArray);
    console.log('[Vercel API] Final path:', path);
    console.log('[Vercel API] Final pathname:', pathname);
    
    console.log('[Vercel API] Request URL:', req.url);
    console.log('[Vercel API] Request:', req.method, pathname, 'query:', JSON.stringify(req.query));
    console.log('[Vercel API] Path array:', pathArray, 'Full path:', path);
    
    // 直接匹配路由（不依赖 IncomingMessage 类型）
    const method = req.method?.toUpperCase();
    const routes = getRoutes();
    console.log('[Vercel API] Available routes:', routes.map(r => `${r.method} ${r.path.toString()}`));
    console.log('[Vercel API] Matching routes for method:', method, 'pathname:', pathname);
    let route: RouteDefinition | undefined;
    
    for (const r of routes) {
      if (r.method !== method) continue;
      // 重置正则表达式的 lastIndex，确保每次匹配都从头开始
      r.path.lastIndex = 0;
      const match = r.path.exec(pathname);
      if (match) {
        route = r;
        console.log('[Vercel API] Route matched:', r.method, r.path, 'with pathname:', pathname);
        break;
      }
    }
    
    if (!route) {
      console.log('[Vercel API] No route found for:', req.method, pathname);
      const matchingMethodRoutes = routes.filter(r => r.method === method);
      console.log('[Vercel API] Tried routes:', matchingMethodRoutes.map(r => `${r.method} ${r.path.toString()}`));
      console.log('[Vercel API] Testing each route:');
      matchingMethodRoutes.forEach(r => {
        r.path.lastIndex = 0;
        const testMatch = r.path.exec(pathname);
        console.log(`  - ${r.path.toString()}: ${testMatch ? 'MATCH' : 'NO MATCH'}`);
        if (testMatch) {
          console.log(`    Match groups:`, testMatch);
        }
      });
      sendError(res, 404, `Route not found: ${req.method} ${pathname}`, 'NOT_FOUND');
      return;
    }
    
    console.log('[Vercel API] Matched route:', route.method, route.path);

    const ip = getIp(req);
    
    // 速率限制（简化版，生产环境建议使用 Redis）
    // 注意：Vercel 有内置的速率限制，这里可以简化
    // if (route.rateLimitKey && !checkRateLimit(route.rateLimitKey, identifier)) {
    //   sendError(res, 429, 'Too Many Requests', 'RATE_LIMITED');
    //   return;
    // }

    // 解析请求体（Vercel 已经自动解析了 JSON）
    let body: unknown = req.body || {};

    // 解析查询参数
    const query = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        query.set(key, Array.isArray(value) ? value[0] : String(value));
      }
    });

    // 验证用户身份
    let user;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (accessToken) {
      try {
        user = await getUserFromToken(accessToken);
      } catch (error) {
        // Token 无效，但不一定需要认证
      }
    }

    if (route.requireAuth && !user) {
      sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');
      return;
    }

    // 创建请求上下文
    const context = createContext(
      req,
      res,
      route,
      path,
      body,
      user,
      query,
      ip,
      req.headers['x-device-id'] as string || undefined,
      req.headers['x-device-type'] as string || undefined,
      req.headers['user-agent'],
    );

    // 执行路由处理器
    await route.handler(context);
  } catch (error: any) {
    console.error('Serverless function error:', error);
    if (!res.headersSent) {
      sendError(res, 500, error.message || 'Internal Server Error', 'INTERNAL_ERROR');
    }
  }
}
