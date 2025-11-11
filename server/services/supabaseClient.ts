import { env } from '../config';
import { AuthenticatedUser } from '../types';

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  session?: unknown;
}

interface ProfilePayload {
  nickname?: string;
  avatar_url?: string;
  updated_at?: string;
}

const { supabaseUrl, supabaseAnonKey, supabaseServiceKey } = env;

async function handleJsonResponse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const message = data?.error_description || data?.message || response.statusText;
    throw new Error(message || 'Supabase request failed');
  }
  return data;
}

async function authRequest(path: string, init: RequestInit): Promise<any> {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      ...init.headers,
    },
  });
  return handleJsonResponse(response);
}

async function serviceRequest(path: string, init: RequestInit): Promise<any> {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      ...init.headers,
    },
  });
  return handleJsonResponse(response);
}

export async function signUpWithEmail(email: string, password: string, nickname: string) {
  const result: AuthResponse = await authRequest('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { nickname } }),
  });
  return result;
}

export async function signInWithEmail(email: string, password: string) {
  const result: AuthResponse = await authRequest('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return result;
}

export function buildOAuthUrl(provider: string, redirectUri: string): string {
  const query = new URLSearchParams({
    provider,
    redirect_to: redirectUri,
  });
  return `${supabaseUrl}/auth/v1/authorize?${query.toString()}`;
}

export async function exchangeOAuthCode(code: string, redirectUri: string) {
  const result: AuthResponse = await authRequest('/auth/v1/token?grant_type=authorization_code', {
    method: 'POST',
    body: JSON.stringify({ code, redirect_to: redirectUri }),
  });
  return result;
}

export async function refreshAccessToken(refreshToken: string) {
  const result: AuthResponse = await authRequest('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return result;
}

export async function signOut(accessToken: string) {
  await authRequest('/auth/v1/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getUserFromToken(accessToken: string): Promise<AuthenticatedUser | undefined> {
  const data = await authRequest('/auth/v1/user', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!data || !data.id) return undefined;
  return {
    id: data.id,
    email: data.email,
    nickname: data.user_metadata?.nickname as string | undefined,
  };
}

export async function fetchProfile(userId: string) {
  const query = new URLSearchParams({ id: `eq.${userId}` });
  const data = await serviceRequest(`/rest/v1/profiles?${query.toString()}`, {
    method: 'GET',
  });
  return Array.isArray(data) && data.length > 0 ? data[0] : undefined;
}

export async function upsertProfile(userId: string, payload: ProfilePayload) {
  const data = await serviceRequest('/rest/v1/profiles', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([{ id: userId, ...payload }]),
  });
  return Array.isArray(data) && data.length > 0 ? data[0] : undefined;
}

export async function updateProfile(userId: string, payload: ProfilePayload) {
  const query = new URLSearchParams({ id: `eq.${userId}` });
  const data = await serviceRequest(`/rest/v1/profiles?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  return Array.isArray(data) && data.length > 0 ? data[0] : undefined;
}

export async function queryTable<T = any>(
  table: string,
  filters: Record<string, string>,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<T[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    params.set(key, value);
  });
  if (options.order) {
    params.set('order', `${options.order}.${options.ascending === false ? 'desc' : 'asc'}`);
  }
  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  return serviceRequest(`/rest/v1/${table}?${params.toString()}`, {
    method: 'GET',
  });
}

export async function insertTable<T = any>(table: string, payload: Record<string, unknown> | Record<string, unknown>[]) {
  const data = await serviceRequest(`/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(Array.isArray(payload) ? payload : [payload]),
  });
  if (Array.isArray(data)) return data as T[];
  return [data] as T[];
}

export async function upsertTable<T = any>(table: string, payload: Record<string, unknown> | Record<string, unknown>[]) {
  const data = await serviceRequest(`/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(Array.isArray(payload) ? payload : [payload]),
  });
  if (Array.isArray(data)) return data as T[];
  return [data] as T[];
}

export async function updateTable<T = any>(table: string, filters: Record<string, string>, payload: Record<string, unknown>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    params.set(key, value);
  });
  const data = await serviceRequest(`/rest/v1/${table}?${params.toString()}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  return Array.isArray(data) ? (data as T[]) : [data as T];
}

export async function deleteFromTable(table: string, filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    params.set(key, value);
  });
  await serviceRequest(`/rest/v1/${table}?${params.toString()}`, {
    method: 'DELETE',
  });
}

export async function logAuditEvent(userId: string | null, action: string, metadata: Record<string, unknown>) {
  await insertTable('audit_logs', {
    user_id: userId,
    action,
    metadata,
    created_at: new Date().toISOString(),
  });
}

export async function upsertDevice(
  deviceId: string,
  userId: string,
  payload: { device_type?: string; app_version?: string; last_synced_at?: string; sync_cursor?: number },
) {
  const [record] = await upsertTable('client_devices', {
    id: deviceId,
    user_id: userId,
    device_type: payload.device_type ?? null,
    app_version: payload.app_version ?? null,
    last_synced_at: payload.last_synced_at ?? new Date().toISOString(),
    sync_cursor: payload.sync_cursor ?? null,
    updated_at: new Date().toISOString(),
  });
  return record;
}

export interface SyncEventInput {
  user_id: string;
  entity_type: string;
  entity_id: string;
  operation: 'UPSERT' | 'DELETE';
  payload_ciphertext?: string | null;
  payload_nonce?: string | null;
  created_at?: string;
}

export async function insertSyncEvent(event: SyncEventInput) {
  const [created] = await insertTable('sync_events', {
    ...event,
    created_at: event.created_at ?? new Date().toISOString(),
  });
  return created;
}

export async function fetchSyncEvents(userId: string, cursor?: number) {
  const filters: Record<string, string> = {
    user_id: `eq.${userId}`,
  };
  if (cursor !== undefined) {
    filters.id = `gt.${cursor}`;
  }
  return queryTable('sync_events', filters, { order: 'id', ascending: true });
}
