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
import {
  exchangeLinuxdoCode,
  getLinuxdoUserInfo,
  isLinuxdoConfigured,
} from '../services/linuxdoOAuth';
import { sendError, sendJson, sendNoContent } from '../utils/response';
import { assertObject, assertString } from '../utils/validation';

export async function registerWithEmail(context: RequestContext) {
  try {
    const body = assertObject(context.body, 'body');
    const email = assertString(body.email, 'email');
    const password = assertString(body.password, 'password');
    const nickname = assertString(body.nickname, 'nickname');

    if (!email || !password || !nickname) {
      throw new Error('Missing required fields');
    }
    if (password.length < 6) {
      throw new Error('Password too short');
    }

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
    const status = error.status && Number.isInteger(error.status) ? error.status : 400;
    const message = error?.payload?.error_description || error?.payload?.message || error?.message || 'Failed to register';
    console.error('[Register] Error:', { message, status, payload: error?.payload });
    sendError(context.res, status, message, 'INVALID_PARAMS');
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
    const status = error.status && Number.isInteger(error.status) ? error.status : 401;
    const message = error?.payload?.error_description || error?.payload?.message || error?.message || 'Invalid credentials';
    console.error('[Login] Error:', { message, status, payload: error?.payload });
    sendError(context.res, status, message, 'UNAUTHORIZED');
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
    const code = assertString(body.code, 'code');
    const redirectUri = assertString(body.redirect_uri, 'redirect_uri');
    const codeVerifier = typeof body.code_verifier === 'string' ? body.code_verifier : undefined;

    // Linuxdo 使用独立的授权流程
    if (provider.toLowerCase() === 'linuxdo') {
      if (!isLinuxdoConfigured()) {
        throw new Error('Linuxdo OAuth is not configured');
      }

      // 1. 使用授权码交换访问令牌
      const linuxdoToken = await exchangeLinuxdoCode(code, redirectUri);

      // 2. 使用访问令牌获取用户信息
      const linuxdoUser = await getLinuxdoUserInfo(linuxdoToken.access_token);

      // 3. 在 Supabase 中创建或查找用户
      // 使用 Linuxdo 的用户邮箱作为唯一标识
      const email = linuxdoUser.email || `${linuxdoUser.username}@linux.do`;
      
      // 尝试通过邮箱查找现有用户，如果不存在则创建
      // 这里我们需要使用 Supabase Admin API 来创建用户
      const { createOrGetLinuxdoUser } = await import('../services/linuxdoOAuth.js');
      const supabaseUser = await createOrGetLinuxdoUser(linuxdoUser, email);

      // 4. 获取或创建用户资料
      let profile = await fetchProfile(supabaseUser.id);
      if (!profile) {
        profile = await upsertProfile(supabaseUser.id, {
          nickname: linuxdoUser.name || linuxdoUser.username,
          avatar_url: linuxdoUser.avatar_template 
            ? `https://linux.do${linuxdoUser.avatar_template.replace('{size}', '128')}`
            : undefined,
        });
      }

      // 5. 生成 Supabase 会话令牌
      // 由于 Linuxdo 用户已经通过 OAuth 验证，我们需要为他们创建一个 Supabase 会话
      // 这里使用 Supabase Admin API 来生成自定义令牌
      const { generateSupabaseSession } = await import('../services/linuxdoOAuth.js');
      const session = await generateSupabaseSession(supabaseUser.id, email);

      sendJson(context.res, 200, {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in || 3600,
        user: {
          id: supabaseUser.id,
          email: email,
          nickname: profile?.nickname || linuxdoUser.name || linuxdoUser.username,
        },
      });
      return;
    }

    // Google 和 GitHub 使用 Supabase 的标准流程
    const result = await exchangeOAuthCode(code, redirectUri, codeVerifier);
    if (!result.access_token || !result.refresh_token || !result.user) {
      throw new Error('OAuth callback failed');
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
    const status = error.status && Number.isInteger(error.status) ? error.status : 400;
    const message = error?.payload?.error_description || error?.payload?.message || error?.message || 'OAuth exchange failed';
    console.error('[OAuth Callback] Error:', { message, status, payload: error?.payload });
    sendError(context.res, status, message, 'INVALID_PARAMS');
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
