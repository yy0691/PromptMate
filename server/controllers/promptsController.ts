import { RequestContext } from '../types';
import {
  deleteFromTable,
  insertSyncEvent,
  insertTable,
  logAuditEvent,
  queryTable,
  updateTable,
} from '../services/supabaseClient';
import { sendError, sendJson, sendNoContent } from '../utils/response';
import { assertArray, assertObject, assertString } from '../utils/validation';

export async function listPrompts(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const filters: Record<string, string> = {
      user_id: `eq.${context.user.id}`,
    };
    const collectionId = context.query.get('collection_id');
    if (collectionId) {
      filters.collection_id = `eq.${collectionId}`;
    }
    const updatedAfter = context.query.get('updated_after');
    if (updatedAfter) {
      filters.updated_at = `gt.${updatedAfter}`;
    }
    const data = await queryTable('prompts', filters, { order: 'updated_at', ascending: false });
    sendJson(context.res, 200, { data });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to load prompts', 'INVALID_PARAMS');
  }
}

export async function createPrompt(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const body = assertObject(context.body, 'body');
    const collectionId = assertString(body.collection_id, 'collection_id');
    const title = assertString(body.title, 'title');
    const ciphertext = assertString(body.content_ciphertext, 'content_ciphertext');
    const nonce = assertString(body.content_nonce, 'content_nonce');
    const tags = body.tags ? assertArray(body.tags, 'tags') : [];

    const [prompt] = await insertTable('prompts', {
      user_id: context.user.id,
      collection_id: collectionId,
      title,
      content_ciphertext: ciphertext,
      content_nonce: nonce,
      tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await insertSyncEvent({
      user_id: context.user.id,
      entity_type: 'prompt',
      entity_id: prompt.id,
      operation: 'UPSERT',
      payload_ciphertext: ciphertext,
      payload_nonce: nonce,
    });

    await logAuditEvent(context.user.id, 'prompt.create', {
      prompt_id: prompt.id,
      device_id: context.deviceId,
    });

    sendJson(context.res, 201, prompt);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to create prompt', 'INVALID_PARAMS');
  }
}

export async function updatePrompt(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const { id } = context.params;
    if (!id) {
      sendError(context.res, 400, 'Prompt id is required', 'INVALID_PARAMS');
      return;
    }
    const body = assertObject(context.body, 'body');
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) {
      payload.title = assertString(body.title, 'title');
    }
    if (body.content_ciphertext !== undefined) {
      payload.content_ciphertext = assertString(body.content_ciphertext, 'content_ciphertext');
    }
    if (body.content_nonce !== undefined) {
      payload.content_nonce = assertString(body.content_nonce, 'content_nonce');
    }
    if (body.tags !== undefined) {
      payload.tags = assertArray(body.tags, 'tags');
    }

    const [updated] = await updateTable('prompts', {
      id: `eq.${id}`,
      user_id: `eq.${context.user.id}`,
    }, payload);

    await insertSyncEvent({
      user_id: context.user.id,
      entity_type: 'prompt',
      entity_id: id,
      operation: 'UPSERT',
      payload_ciphertext: (payload.content_ciphertext as string | undefined) ?? null,
      payload_nonce: (payload.content_nonce as string | undefined) ?? null,
    });

    await logAuditEvent(context.user.id, 'prompt.update', {
      prompt_id: id,
      device_id: context.deviceId,
    });

    sendJson(context.res, 200, updated);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to update prompt', 'INVALID_PARAMS');
  }
}

export async function deletePrompt(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const { id } = context.params;
    if (!id) {
      sendError(context.res, 400, 'Prompt id is required', 'INVALID_PARAMS');
      return;
    }
    await deleteFromTable('prompts', {
      id: `eq.${id}`,
      user_id: `eq.${context.user.id}`,
    });

    await insertSyncEvent({
      user_id: context.user.id,
      entity_type: 'prompt',
      entity_id: id,
      operation: 'DELETE',
      payload_ciphertext: null,
      payload_nonce: null,
    });

    await logAuditEvent(context.user.id, 'prompt.delete', {
      prompt_id: id,
      device_id: context.deviceId,
    });

    sendNoContent(context.res);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to delete prompt', 'INVALID_PARAMS');
  }
}
