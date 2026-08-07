const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || 'http://127.0.0.1:8787';
const ENV_PATH = path.resolve(__dirname, '../server/.env');

function parseEnv(filePath) {
  const env = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^"|"$/g, '');
  }
  return env;
}

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

async function request(method, route, { token, body, headers } = {}) {
  const response = await fetch(`${BASE_URL}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }

  return { status: response.status, ok: response.ok, json };
}

async function supabaseAdminRequest(env, method, route, body) {
  const response = await fetch(`${env.SUPABASE_URL}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }

  if (!response.ok) {
    throw new Error(`Supabase admin ${method} ${route} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json;
}

function assertStatus(result, expectedStatuses, label) {
  if (!expectedStatuses.includes(result.status)) {
    throw new Error(`${label} expected ${expectedStatuses.join('/')} but got ${result.status}: ${JSON.stringify(result.json)}`);
  }
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Missing server env file: ${ENV_PATH}`);
  }

  const env = parseEnv(ENV_PATH);
  const now = Date.now();
  const registerEmail = `promptmate-reg-${now}@mailinator.com`;
  const loginEmail = `promptmate-e2e-${now}@mailinator.com`;
  const password = `PmTest!${now}`;
  const nickname = `e2e-${now}`;
  let adminUserId;
  let createdCollectionId;
  let createdPromptId;
  let createdMarketplacePromptId;
  let syncCollectionId;

  const summary = [];

  try {
    log('health', 'checking public endpoints');
    const health = await request('GET', '/api/health');
    assertStatus(health, [200], 'GET /api/health');
    summary.push('health');

    const test = await request('GET', '/api/test');
    assertStatus(test, [200], 'GET /api/test');
    summary.push('test');

    const oauthUrl = await request('GET', `/api/auth/oauth/url?provider=google&redirect_uri=${encodeURIComponent('http://localhost:5174/auth/callback')}`);
    assertStatus(oauthUrl, [200], 'GET /api/auth/oauth/url');
    if (!oauthUrl.json || !oauthUrl.json.url) {
      throw new Error('OAuth URL response missing url field');
    }
    summary.push('oauth-url');

    log('register', 'testing email registration');
    const register = await request('POST', '/api/auth/register/email', {
      body: { email: registerEmail, password, nickname },
    });
    assertStatus(register, [200, 429], 'POST /api/auth/register/email');
    summary.push(register.status === 429 ? 'register-rate-limited' : 'register');

    log('admin-user', 'creating confirmed user for authenticated flow');
    const createdAdminUser = await supabaseAdminRequest(env, 'POST', '/auth/v1/admin/users', {
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { nickname },
    });
    adminUserId = createdAdminUser.user?.id || createdAdminUser.id;
    if (!adminUserId) {
      throw new Error(`admin user create response missing id: ${JSON.stringify(createdAdminUser)}`);
    }
    summary.push('admin-user-create');

    log('login', 'logging in through backend');
    const login = await request('POST', '/api/auth/login/email', {
      body: { email: loginEmail, password },
    });
    assertStatus(login, [200], 'POST /api/auth/login/email');
    const accessToken = login.json?.access_token;
    const refreshToken = login.json?.refresh_token;
    const userId = login.json?.user?.id;
    if (!accessToken || !refreshToken || !userId) {
      throw new Error(`login response missing token or user: ${JSON.stringify(login.json)}`);
    }
    summary.push('login');

    const profile = await request('GET', '/api/profile', { token: accessToken });
    assertStatus(profile, [200], 'GET /api/profile');
    summary.push('profile-get');

    const updatedProfile = await request('PATCH', '/api/profile', {
      token: accessToken,
      body: {
        nickname: `${nickname}-updated`,
        avatar_url: 'https://example.com/avatar.png',
      },
    });
    assertStatus(updatedProfile, [200], 'PATCH /api/profile');
    summary.push('profile-patch');

    const refresh = await request('POST', '/api/auth/token/refresh', {
      body: { refresh_token: refreshToken },
    });
    assertStatus(refresh, [200], 'POST /api/auth/token/refresh');
    summary.push('refresh-token');

    const listCollectionsInitial = await request('GET', '/api/prompt-collections', { token: accessToken });
    assertStatus(listCollectionsInitial, [200], 'GET /api/prompt-collections');
    summary.push('collections-list-initial');

    const createdCollection = await request('POST', '/api/prompt-collections', {
      token: accessToken,
      body: {
        title: `E2E Collection ${now}`,
        description: 'created by backend e2e test',
      },
    });
    assertStatus(createdCollection, [201], 'POST /api/prompt-collections');
    createdCollectionId = createdCollection.json?.id;
    if (!createdCollectionId) {
      throw new Error(`create collection missing id: ${JSON.stringify(createdCollection.json)}`);
    }
    summary.push('collections-create');

    const updatedCollection = await request('PATCH', `/api/prompt-collections/${createdCollectionId}`, {
      token: accessToken,
      body: {
        title: `E2E Collection ${now} Updated`,
        description: 'updated by backend e2e test',
      },
    });
    assertStatus(updatedCollection, [200], 'PATCH /api/prompt-collections/:id');
    summary.push('collections-update');

    const createdPrompt = await request('POST', '/api/prompts', {
      token: accessToken,
      body: {
        collection_id: createdCollectionId,
        title: `E2E Prompt ${now}`,
        content_ciphertext: 'ciphertext-demo',
        content_nonce: 'nonce-demo',
        tags: ['e2e', 'backend'],
      },
    });
    assertStatus(createdPrompt, [201], 'POST /api/prompts');
    createdPromptId = createdPrompt.json?.id;
    if (!createdPromptId) {
      throw new Error(`create prompt missing id: ${JSON.stringify(createdPrompt.json)}`);
    }
    summary.push('prompts-create');

    const promptList = await request('GET', `/api/prompts?collection_id=${createdCollectionId}`, { token: accessToken });
    assertStatus(promptList, [200], 'GET /api/prompts');
    summary.push('prompts-list');

    const updatedPrompt = await request('PATCH', `/api/prompts/${createdPromptId}`, {
      token: accessToken,
      body: {
        title: `E2E Prompt ${now} Updated`,
        content_ciphertext: 'ciphertext-demo-updated',
        content_nonce: 'nonce-demo-updated',
        tags: ['e2e', 'backend', 'updated'],
      },
    });
    assertStatus(updatedPrompt, [200], 'PATCH /api/prompts/:id');
    summary.push('prompts-update');

    syncCollectionId = `sync-col-${now}`;
    const syncPush = await request('POST', '/api/sync/push', {
      token: accessToken,
      body: {
        device_id: `device-${now}`,
        app_version: '1.1.18-test',
        events: [
          {
            entity_type: 'collection',
            entity_id: syncCollectionId,
            operation: 'UPSERT',
            updated_at: new Date().toISOString(),
            record: {
              id: syncCollectionId,
              title: `Synced Collection ${now}`,
              description: 'from sync push',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          },
        ],
      },
    });
    assertStatus(syncPush, [200], 'POST /api/sync/push');
    summary.push('sync-push');

    const syncPull = await request('GET', '/api/sync/pull', { token: accessToken });
    assertStatus(syncPull, [200], 'GET /api/sync/pull');
    summary.push('sync-pull');

    const heartbeat = await request('POST', '/api/devices/heartbeat', {
      token: accessToken,
      body: {
        device_id: `device-${now}`,
        device_type: 'desktop',
        app_version: '1.1.18-test',
        sync_cursor: syncPush.json?.next_cursor ?? null,
      },
    });
    assertStatus(heartbeat, [200], 'POST /api/devices/heartbeat');
    summary.push('devices-heartbeat');

    const publicMarketplace = await request('GET', '/api/marketplace/prompts');
    assertStatus(publicMarketplace, [200], 'GET /api/marketplace/prompts');
    summary.push('marketplace-list');

    const marketplaceItems = Array.isArray(publicMarketplace.json?.data) ? publicMarketplace.json.data : [];
    if (marketplaceItems.length > 0) {
      const firstMarketplaceId = marketplaceItems[0].id;
      const marketplaceDetail = await request('GET', `/api/marketplace/prompts/${firstMarketplaceId}`);
      assertStatus(marketplaceDetail, [200], 'GET /api/marketplace/prompts/:id');
      summary.push('marketplace-detail');

      const downloadMarketplace = await request('POST', `/api/marketplace/prompts/${firstMarketplaceId}/download`);
      assertStatus(downloadMarketplace, [200], 'POST /api/marketplace/prompts/:id/download');
      summary.push('marketplace-download');
    }

    const createdMarketplacePrompt = await request('POST', '/api/marketplace/prompts', {
      token: accessToken,
      body: {
        title: `Marketplace E2E ${now}`,
        content: 'Prompt content for backend e2e test',
        description: 'created by backend e2e',
        category: 'testing',
        tags: ['e2e', 'backend'],
      },
    });
    assertStatus(createdMarketplacePrompt, [201], 'POST /api/marketplace/prompts');
    createdMarketplacePromptId = createdMarketplacePrompt.json?.id;
    if (!createdMarketplacePromptId) {
      throw new Error(`create marketplace prompt missing id: ${JSON.stringify(createdMarketplacePrompt.json)}`);
    }
    summary.push('marketplace-create');

    const updatedMarketplacePrompt = await request('PATCH', `/api/marketplace/prompts/${createdMarketplacePromptId}`, {
      token: accessToken,
      body: {
        title: `Marketplace E2E ${now} Updated`,
        description: 'updated by backend e2e',
      },
    });
    assertStatus(updatedMarketplacePrompt, [200], 'PATCH /api/marketplace/prompts/:id');
    summary.push('marketplace-update');

    if (env.AUDIT_ADMIN_SECRET) {
      const auditLogs = await request('GET', '/api/security/audit-logs?limit=10', {
        headers: { 'X-Admin-Secret': env.AUDIT_ADMIN_SECRET },
      });
      assertStatus(auditLogs, [200], 'GET /api/security/audit-logs');
      summary.push('audit-logs');
    } else {
      const auditLogs = await request('GET', '/api/security/audit-logs');
      assertStatus(auditLogs, [403], 'GET /api/security/audit-logs');
      summary.push('audit-logs-disabled');
    }

    const logout = await request('POST', '/api/auth/logout', { token: accessToken, body: {} });
    assertStatus(logout, [204], 'POST /api/auth/logout');
    summary.push('logout');

    console.log('\nE2E backend test passed.');
    console.log(`Covered steps: ${summary.join(', ')}`);
  } finally {
    if (createdPromptId && adminUserId) {
      await request('DELETE', `/api/prompts/${createdPromptId}`, {
        token: (
          await request('POST', '/api/auth/login/email', {
            body: { email: loginEmail, password },
          })
        ).json?.access_token,
      }).catch(() => {});
    }

    if (createdCollectionId && adminUserId) {
      await request('DELETE', `/api/prompt-collections/${createdCollectionId}`, {
        token: (
          await request('POST', '/api/auth/login/email', {
            body: { email: loginEmail, password },
          })
        ).json?.access_token,
      }).catch(() => {});
    }

    if (createdMarketplacePromptId && adminUserId) {
      await request('DELETE', `/api/marketplace/prompts/${createdMarketplacePromptId}`, {
        token: (
          await request('POST', '/api/auth/login/email', {
            body: { email: loginEmail, password },
          })
        ).json?.access_token,
      }).catch(() => {});
    }

    if (syncCollectionId && adminUserId) {
      await supabaseAdminRequest(env, 'DELETE', `/rest/v1/prompt_collections?id=eq.${syncCollectionId}&user_id=eq.${adminUserId}`).catch(() => {});
    }

    if (adminUserId) {
      await supabaseAdminRequest(env, 'DELETE', `/auth/v1/admin/users/${adminUserId}`).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error('\nE2E backend test failed.');
  console.error(error.message || error);
  process.exit(1);
});
