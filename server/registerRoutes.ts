import { registerRoute } from './router';
import {
  getOAuthUrl,
  loginWithEmail,
  logout,
  oauthCallback,
  refreshToken,
  registerWithEmail,
} from './controllers/authController';
import { createPrompt, deletePrompt, listPrompts, updatePrompt } from './controllers/promptsController';
import { createCollection, deleteCollection, listCollections, updateCollection } from './controllers/collectionsController';
import { getProfile, updateProfile } from './controllers/profileController';
import { pullSync, pushSync } from './controllers/syncController';
import { heartbeat } from './controllers/devicesController';
import { listAuditLogs } from './controllers/securityController';
import {
  createMarketplacePrompt,
  deleteMarketplacePrompt,
  downloadMarketplacePrompt,
  getMarketplacePrompt,
  listMarketplacePrompts,
  reviewMarketplacePrompt,
  updateMarketplacePrompt,
} from './controllers/marketplaceController';

export function initRoutes() {
  registerRoute('POST', '/api/auth/register/email', registerWithEmail, { rateLimitKey: 'auth:strict' });
  registerRoute('POST', '/api/auth/login/email', loginWithEmail, { rateLimitKey: 'auth:strict' });
  registerRoute('GET', '/api/auth/oauth/url', getOAuthUrl, { rateLimitKey: 'auth:strict' });
  registerRoute('POST', '/api/auth/oauth/callback', oauthCallback, { rateLimitKey: 'auth:strict' });
  registerRoute('POST', '/api/auth/token/refresh', refreshToken, { rateLimitKey: 'auth:strict' });
  registerRoute('POST', '/api/auth/logout', logout, { requireAuth: true });

  registerRoute('GET', '/api/profile', getProfile, { requireAuth: true });
  registerRoute('PATCH', '/api/profile', updateProfile, { requireAuth: true, rateLimitKey: 'write:standard' });

  registerRoute('GET', '/api/prompts', listPrompts, { requireAuth: true });
  registerRoute('POST', '/api/prompts', createPrompt, { requireAuth: true, rateLimitKey: 'write:standard' });
  registerRoute('PATCH', '/api/prompts/:id', updatePrompt, { requireAuth: true, rateLimitKey: 'write:standard' });
  registerRoute('DELETE', '/api/prompts/:id', deletePrompt, { requireAuth: true, rateLimitKey: 'write:standard' });

  registerRoute('GET', '/api/prompt-collections', listCollections, { requireAuth: true });
  registerRoute('POST', '/api/prompt-collections', createCollection, { requireAuth: true, rateLimitKey: 'write:standard' });
  registerRoute('PATCH', '/api/prompt-collections/:id', updateCollection, { requireAuth: true, rateLimitKey: 'write:standard' });
  registerRoute('DELETE', '/api/prompt-collections/:id', deleteCollection, { requireAuth: true, rateLimitKey: 'write:standard' });

  registerRoute('GET', '/api/sync/pull', pullSync, { requireAuth: true });
  registerRoute('POST', '/api/sync/push', pushSync, { requireAuth: true, rateLimitKey: 'write:standard' });

  registerRoute('POST', '/api/devices/heartbeat', heartbeat, { requireAuth: true });

  registerRoute('GET', '/api/security/audit-logs', listAuditLogs);

  // 模板市场路由
  registerRoute('GET', '/api/marketplace/prompts', listMarketplacePrompts);
  registerRoute('GET', '/api/marketplace/prompts/:id', getMarketplacePrompt);
  registerRoute('POST', '/api/marketplace/prompts', createMarketplacePrompt, { requireAuth: true, rateLimitKey: 'write:standard' });
  registerRoute('PATCH', '/api/marketplace/prompts/:id', updateMarketplacePrompt, { requireAuth: true, rateLimitKey: 'write:standard' });
  registerRoute('DELETE', '/api/marketplace/prompts/:id', deleteMarketplacePrompt, { requireAuth: true, rateLimitKey: 'write:standard' });
  registerRoute('POST', '/api/marketplace/prompts/:id/review', reviewMarketplacePrompt, { requireAuth: true, rateLimitKey: 'write:standard' });
  registerRoute('POST', '/api/marketplace/prompts/:id/download', downloadMarketplacePrompt);
}
