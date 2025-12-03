/**
 * 健康检查控制器
 * 用于检查服务状态
 */

import { RequestContext } from '../types';
import { sendJson } from '../utils/response';

export async function healthCheck(context: RequestContext) {
  sendJson(context.res, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'PromptMate API',
  });
}

export async function testEndpoint(context: RequestContext) {
  sendJson(context.res, 200, {
    message: 'Test API is working!',
    method: context.req.method,
    url: context.req.url,
    timestamp: new Date().toISOString(),
  });
}

