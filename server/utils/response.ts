import { ServerResponse } from 'http';

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  const data = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(data));
  res.end(data);
}

export function sendNoContent(res: ServerResponse) {
  res.statusCode = 204;
  res.end();
}

export function sendError(res: ServerResponse, statusCode: number, message: string, code = 'ERROR') {
  sendJson(res, statusCode, {
    error: {
      code,
      message,
    },
  });
}
