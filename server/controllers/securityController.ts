import { env } from '../config';
import { RequestContext } from '../types';
import { queryTable } from '../services/supabaseClient';
import { sendError, sendJson } from '../utils/response';

export async function listAuditLogs(context: RequestContext) {
  try {
    if (!env.auditAdminSecret) {
      sendError(context.res, 403, 'Audit log access disabled', 'FORBIDDEN');
      return;
    }
    const headerSecretRaw = context.req.headers['x-admin-secret'];
    const headerSecret = Array.isArray(headerSecretRaw) ? headerSecretRaw[0] : headerSecretRaw;
    if (headerSecret !== env.auditAdminSecret) {
      sendError(context.res, 403, 'Forbidden', 'FORBIDDEN');
      return;
    }
    const limitParam = context.query.get('limit');
    const limit = limitParam ? Math.min(Number(limitParam), 200) : 100;
    const logs = await queryTable('audit_logs', {}, { order: 'created_at', ascending: false, limit });
    sendJson(context.res, 200, { data: logs });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to list audit logs', 'INVALID_PARAMS');
  }
}
