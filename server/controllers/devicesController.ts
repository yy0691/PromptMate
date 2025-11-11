import { RequestContext } from '../types';
import { logAuditEvent, upsertDevice } from '../services/supabaseClient';
import { sendError, sendJson } from '../utils/response';
import { assertObject, assertString, optionalString } from '../utils/validation';

export async function heartbeat(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const body = assertObject(context.body, 'body');
    const deviceId = assertString(body.device_id ?? context.deviceId, 'device_id');
    const deviceType = optionalString(body.device_type) ?? context.deviceType;
    const appVersion = optionalString(body.app_version) ?? null;
    const syncCursorValue = body.sync_cursor !== undefined ? Number(body.sync_cursor) : undefined;
    const syncCursor = Number.isFinite(syncCursorValue as number) ? (syncCursorValue as number) : undefined;

    const record = await upsertDevice(deviceId, context.user.id, {
      device_type: deviceType ?? undefined,
      app_version: appVersion ?? undefined,
      sync_cursor: syncCursor,
      last_synced_at: new Date().toISOString(),
    });

    await logAuditEvent(context.user.id, 'device.heartbeat', {
      device_id: deviceId,
      device_type: deviceType,
    });

    sendJson(context.res, 200, record);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Heartbeat failed', 'INVALID_PARAMS');
  }
}
