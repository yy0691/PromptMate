import { RequestContext } from '../types';
import {
  buildOAuthUrl,
  exchangeOAuthCode,
  fetchProfile,
  refreshAccessToken,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  upsertProfile,
} from '../services/supabaseClient';
import { sendError, sendJson, sendNoContent } from '../utils/response';
import { assertObject, assertString } from '../utils/validation';

export async function registerWithEmail(context: RequestContext) {
  try {
    const body = assertObject(context.body, 'body');
    const email = assertString(body.email, 'email');
    const password = assertString(body.password, 'password');
    const nickname = assertString(body.nickname, 'nickname');

    const result = await signUpWithEmail(email, password, nickname);
    
    console.log('[Register] signUpWithEmail result:', JSON.stringify({
      hasUser: !!result.user,
      userId: result.user?.id,
      hasSession: !!result.session,
    }));

    // 创建 profiles 表记录
    if (result.user?.id) {
      try {
        const profile = await upsertProfile(result.user.id, {
          nickname: nickname,
        });
        console.log('[Register] upsertProfile result:', JSON.stringify(profile));
      } catch (profileError: any) {
        console.error('[Register] upsertProfile failed:', profileError.message);
        // 不抛出错误，允许注册继续（用户可以稍后登录时补充 profile）
      }
    } else {
      console.warn('[Register] No user ID returned from signUpWithEmail');
    }

    sendJson(context.res, 200, {
      user: {
        id: result.user?.id,
        email: result.user?.email,
        nickname,
      },
      session: result.session ?? null,
      email_confirmed: false,
    });
  } catch (error: any) {
    console.error('[Register] Error:', error.message);
    sendError(context.res, 400, error.message ?? 'Failed to register', 'INVALID_PARAMS');
  }
}

export async function loginWithEmail(context: RequestContext) {
  try {
    const body = assertObject(context.body, 'body');
    const email = assertString(body.email, 'email');
    const password = assertString(body.password, 'password');

    const result = await signInWithEmail(email, password);
    if (!result.access_token || !result.refresh_token || !result.user) {
      throw new Error('Invalid login response');
    }
    let profile = await fetchProfile(result.user.id);
    if (!profile) {
      profile = await upsertProfile(result.user.id, {
        nickname: result.user.user_metadata?.nickname as string | undefined,
      });
    }

    sendJson(context.res, 200, {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
      user: {
        id: result.user.id,
        email: result.user.email,
        nickname: profile?.nickname ?? result.user.user_metadata?.nickname ?? null,
      },
    });
  } catch (error: any) {
    sendError(context.res, 401, error.message ?? 'Invalid credentials', 'UNAUTHORIZED');
  }
}

export async function getOAuthUrl(context: RequestContext) {
  try {
    const provider = assertString(context.query.get('provider'), 'provider');
    const redirectUri = assertString(context.query.get('redirect_uri'), 'redirect_uri');
    const url = buildOAuthUrl(provider, redirectUri);
    sendJson(context.res, 200, { url });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Invalid parameters', 'INVALID_PARAMS');
  }
}

export async function oauthCallback(context: RequestContext) {
  try {
    const body = assertObject(context.body, 'body');
    const provider = assertString(body.provider, 'provider');
    void provider;
    const code = assertString(body.code, 'code');
    const redirectUri = assertString(body.redirect_uri, 'redirect_uri');

    const result = await exchangeOAuthCode(code, redirectUri);
    if (!result.access_token || !result.refresh_token || !result.user) {
      throw new Error('OAuth callback failed');
    }
    const profile = await fetchProfile(result.user.id);
    if (!profile) {
      await upsertProfile(result.user.id, {
        nickname: result.user.user_metadata?.nickname as string | undefined,
      });
    }
    sendJson(context.res, 200, {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
      user: {
        id: result.user.id,
        email: result.user.email,
        nickname: profile?.nickname ?? result.user.user_metadata?.nickname ?? null,
      },
    });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'OAuth exchange failed', 'INVALID_PARAMS');
  }
}

export async function refreshToken(context: RequestContext) {
  try {
    const body = assertObject(context.body, 'body');
    const token = assertString(body.refresh_token, 'refresh_token');
    const result = await refreshAccessToken(token);
    if (!result.access_token || !result.refresh_token) {
      throw new Error('Failed to refresh token');
    }
    sendJson(context.res, 200, {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
      token_type: result.token_type,
    });
  } catch (error: any) {
    sendError(context.res, 401, error.message ?? 'Unable to refresh token', 'UNAUTHORIZED');
  }
}

export async function logout(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    const authHeader = context.req.headers['authorization'];
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const token = headerValue?.split(' ')[1];
    if (!token) {
      sendError(context.res, 400, 'Missing Authorization header', 'INVALID_PARAMS');
      return;
    }
    await signOut(token);
    sendNoContent(context.res);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Logout failed', 'INVALID_PARAMS');
  }
}
