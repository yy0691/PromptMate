import { RequestContext } from '../types';
import {
  deleteFromTable,
  fetchSyncEvents,
  insertSyncEvent,
  logAuditEvent,
  upsertDevice,
  upsertTable,
} from '../services/supabaseClient';
import { sendError, sendJson } from '../utils/response';
import { assertArray, assertObject, assertString, optionalString } from '../utils/validation';

function ensureNumber(value: string | null, field: string): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${field} must be a number`);
  }
  return parsed;
}

export async function pullSync(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const cursor = ensureNumber(context.query.get('cursor'), 'cursor');
    const events = await fetchSyncEvents(context.user.id, cursor);
    const nextCursor = events.length > 0 ? events[events.length - 1].id : cursor ?? null;
    sendJson(context.res, 200, {
      events,
      next_cursor: nextCursor,
    });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to pull sync events', 'INVALID_PARAMS');
  }
}

export async function pushSync(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const body = assertObject(context.body, 'body');
    const deviceId = assertString(body.device_id ?? context.deviceId, 'device_id');
    const events = assertArray(body.events, 'events');
    const appVersion = optionalString(body.app_version);
    const processedEventIds: number[] = [];

    for (const item of events) {
      const event = assertObject(item, 'event');
      const entityType = assertString(event.entity_type, 'entity_type');
      const entityId = assertString(event.entity_id, 'entity_id');
      const operation = assertString(event.operation, 'operation').toUpperCase();
      const payloadCiphertext = optionalString(event.payload_ciphertext) ?? null;
      const payloadNonce = optionalString(event.payload_nonce) ?? null;
      const updatedAt = optionalString(event.updated_at) ?? new Date().toISOString();
      const record = event.record ? assertObject(event.record, 'record') : undefined;

      switch (entityType) {
        case 'prompt': {
          if (operation === 'DELETE') {
            await deleteFromTable('prompts', {
              id: `eq.${entityId}`,
              user_id: `eq.${context.user.id}`,
            });
          } else if (record) {
            const promptPayload: Record<string, unknown> = {
              id: entityId,
              user_id: context.user.id,
              collection_id: assertString(record.collection_id, 'record.collection_id'),
              title: assertString(record.title, 'record.title'),
              content_ciphertext: assertString(record.content_ciphertext, 'record.content_ciphertext'),
              content_nonce: assertString(record.content_nonce, 'record.content_nonce'),
              tags: record.tags ? assertArray(record.tags, 'record.tags') : [],
              updated_at: record.updated_at ?? updatedAt,
            };
            if (record.created_at) {
              promptPayload.created_at = record.created_at;
            }
            await upsertTable('prompts', promptPayload);
          } else {
            throw new Error('record payload required for prompt UPSERT');
          }
          break;
        }
        case 'collection': {
          if (operation === 'DELETE') {
            await deleteFromTable('prompt_collections', {
              id: `eq.${entityId}`,
              user_id: `eq.${context.user.id}`,
            });
          } else if (record) {
            const collectionPayload: Record<string, unknown> = {
              id: entityId,
              user_id: context.user.id,
              title: assertString(record.title, 'record.title'),
              description: optionalString(record.description) ?? null,
              updated_at: record.updated_at ?? updatedAt,
            };
            if (record.created_at) {
              collectionPayload.created_at = record.created_at;
            }
            await upsertTable('prompt_collections', collectionPayload);
          } else {
            throw new Error('record payload required for collection UPSERT');
          }
          break;
        }
        default:
          throw new Error(`Unsupported entity_type ${entityType}`);
      }

      const created = await insertSyncEvent({
        user_id: context.user.id,
        entity_type: entityType,
        entity_id: entityId,
        operation: operation === 'DELETE' ? 'DELETE' : 'UPSERT',
        payload_ciphertext: payloadCiphertext,
        payload_nonce: payloadNonce,
        created_at: updatedAt,
      });
      processedEventIds.push(created.id as number);
    }

    const latestCursor = processedEventIds.length > 0 ? processedEventIds[processedEventIds.length - 1] : undefined;

    await upsertDevice(deviceId, context.user.id, {
      device_type: context.deviceType,
      app_version: appVersion,
      last_synced_at: new Date().toISOString(),
      sync_cursor: latestCursor,
    });

    await logAuditEvent(context.user.id, 'sync.push', {
      device_id: deviceId,
      events: processedEventIds.length,
    });

    sendJson(context.res, 200, {
      synced_event_ids: processedEventIds,
      next_cursor: latestCursor ?? null,
    });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to push sync events', 'INVALID_PARAMS');
  }
}
