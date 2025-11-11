import { RequestContext } from '../types';
import { deleteFromTable, insertSyncEvent, insertTable, logAuditEvent, queryTable, updateTable } from '../services/supabaseClient';
import { sendError, sendJson, sendNoContent } from '../utils/response';
import { assertObject, assertString, optionalString } from '../utils/validation';

export async function listCollections(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const data = await queryTable('prompt_collections', {
      user_id: `eq.${context.user.id}`,
    }, { order: 'updated_at', ascending: false });
    sendJson(context.res, 200, { data });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to load collections', 'INVALID_PARAMS');
  }
}

export async function createCollection(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const body = assertObject(context.body, 'body');
    const title = assertString(body.title, 'title');
    const description = optionalString(body.description) ?? null;

    const [collection] = await insertTable('prompt_collections', {
      user_id: context.user.id,
      title,
      description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await insertSyncEvent({
      user_id: context.user.id,
      entity_type: 'collection',
      entity_id: collection.id,
      operation: 'UPSERT',
      payload_ciphertext: null,
      payload_nonce: null,
    });

    await logAuditEvent(context.user.id, 'collection.create', {
      collection_id: collection.id,
      device_id: context.deviceId,
    });

    sendJson(context.res, 201, collection);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to create collection', 'INVALID_PARAMS');
  }
}

export async function updateCollection(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const { id } = context.params;
    if (!id) {
      sendError(context.res, 400, 'Collection id is required', 'INVALID_PARAMS');
      return;
    }
    const body = assertObject(context.body, 'body');
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) {
      payload.title = assertString(body.title, 'title');
    }
    if (body.description !== undefined) {
      payload.description = optionalString(body.description) ?? null;
    }
    const [collection] = await updateTable('prompt_collections', {
      id: `eq.${id}`,
      user_id: `eq.${context.user.id}`,
    }, payload);

    await insertSyncEvent({
      user_id: context.user.id,
      entity_type: 'collection',
      entity_id: id,
      operation: 'UPSERT',
      payload_ciphertext: null,
      payload_nonce: null,
    });

    await logAuditEvent(context.user.id, 'collection.update', {
      collection_id: id,
      device_id: context.deviceId,
    });

    sendJson(context.res, 200, collection);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to update collection', 'INVALID_PARAMS');
  }
}

export async function deleteCollection(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const { id } = context.params;
    if (!id) {
      sendError(context.res, 400, 'Collection id is required', 'INVALID_PARAMS');
      return;
    }
    await deleteFromTable('prompt_collections', {
      id: `eq.${id}`,
      user_id: `eq.${context.user.id}`,
    });

    await insertSyncEvent({
      user_id: context.user.id,
      entity_type: 'collection',
      entity_id: id,
      operation: 'DELETE',
      payload_ciphertext: null,
      payload_nonce: null,
    });

    await logAuditEvent(context.user.id, 'collection.delete', {
      collection_id: id,
      device_id: context.deviceId,
    });

    sendNoContent(context.res);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to delete collection', 'INVALID_PARAMS');
  }
}
