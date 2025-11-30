/**
 * Vercel Response 工具函数
 * 兼容 Vercel Serverless Functions 和现有控制器代码
 */

import { VercelResponse } from '@vercel/node';

// 兼容 VercelResponse 的类型，包含可能需要的额外属性
type CompatibleResponse = VercelResponse & {
  statusCode?: number;
  setHeader?(name: string, value: string | number | string[]): void;
  end?(chunk?: any): void;
};

export function sendJson(res: CompatibleResponse, statusCode: number, payload: unknown) {
  const data = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(data));
  res.json(payload);
}

export function sendNoContent(res: CompatibleResponse) {
  res.statusCode = 204;
  res.status(204).end();
}

export function sendError(res: CompatibleResponse, statusCode: number, message: string, code = 'ERROR') {
  res.statusCode = statusCode;
  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}
