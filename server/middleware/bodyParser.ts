import { IncomingMessage } from 'http';

export async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    if (chunks.reduce((acc, buffer) => acc + buffer.length, 0) > 2 * 1024 * 1024) {
      throw new Error('Payload too large');
    }
  }
  if (chunks.length === 0) {
    return undefined;
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Invalid JSON payload');
  }
}
