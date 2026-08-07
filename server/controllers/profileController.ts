import { RequestContext } from '../types';
import { fetchProfile, updateProfile as updateProfileRow, upsertProfile, logAuditEvent } from '../services/supabaseClient';
import { sendError, sendJson } from '../utils/response';
import { assertObject, optionalString } from '../utils/validation';

export async function getProfile(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const profile = await fetchProfile(context.user.id);
    if (!profile) {
      const created = await upsertProfile(context.user.id, {
        nickname: context.user.nickname ?? undefined,
      });
      sendJson(context.res, 200, {
        id: created.id,
        email: context.user.email,
        nickname: created.nickname,
        avatar_url: created.avatar_url,
      });
      return;
    }
    sendJson(context.res, 200, {
      id: profile.id,
      email: context.user.email,
      nickname: profile.nickname,
      avatar_url: profile.avatar_url,
    });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to load profile', 'INVALID_PARAMS');
  }
}

export async function updateProfile(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const body = assertObject(context.body, 'body');
    const nickname = optionalString(body.nickname);
    const avatarUrl = optionalString(body.avatar_url);

    const updated = await updateProfileRow(context.user.id, {
      ...(nickname !== undefined ? { nickname } : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      updated_at: new Date().toISOString(),
    });

    await logAuditEvent(context.user.id, 'profile.update', {
      ip: context.ip,
      device_id: context.deviceId,
    });

    sendJson(context.res, 200, {
      id: updated.id,
      email: context.user.email,
      nickname: updated.nickname,
      avatar_url: updated.avatar_url,
    });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to update profile', 'INVALID_PARAMS');
  }
}
