/**
 * Linuxdo OAuth 授权服务
 * 由于 Linuxdo 需要独立的授权流程，这里实现完整的 OAuth 2.0 流程
 */

import { env } from '../config';

// 使用 LinuxDo Connect 域名，避免主站 404
const LINUXDO_BASE_URL = 'https://connect.linux.do';
// Linux.do 官方文档使用 /oauth2 前缀
const LINUXDO_AUTHORIZE_URL = `${LINUXDO_BASE_URL}/oauth2/authorize`;
const LINUXDO_TOKEN_URL = `${LINUXDO_BASE_URL}/oauth2/token`;
const LINUXDO_USER_INFO_URL = `${LINUXDO_BASE_URL}/api/user`;

interface LinuxdoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface LinuxdoUserInfo {
  id: number;
  username: string;
  email: string;
  name?: string;
  avatar_template?: string;
}

/**
 * 构建 Linuxdo OAuth 授权 URL
 */
export function buildLinuxdoOAuthUrl(redirectUri: string, state?: string): string {
  const { linuxdoClientId } = env;
  
  if (!linuxdoClientId) {
    throw new Error('LINUXDO_CLIENT_ID is not configured');
  }

  // 注意：不在 redirect_uri 中添加额外参数，因为某些 OAuth 服务器不会保留这些参数
  // 前端通过 referrer 检测来识别 Linuxdo 登录

  const params = new URLSearchParams({
    client_id: linuxdoClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read',
    ...(state && { state }),
  });

  return `${LINUXDO_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 使用授权码交换访问令牌
 */
export async function exchangeLinuxdoCode(code: string, redirectUri: string): Promise<LinuxdoTokenResponse> {
  const { linuxdoClientId, linuxdoClientSecret } = env;

  if (!linuxdoClientId || !linuxdoClientSecret) {
    throw new Error('LINUXDO_CLIENT_ID or LINUXDO_CLIENT_SECRET is not configured');
  }

  // 使用传入的 redirect_uri，不添加额外参数
  // 注意：redirect_uri 必须与生成 OAuth URL 时完全一致
  
  console.log('[Linuxdo OAuth] 交换 token 请求参数:');
  console.log('[Linuxdo OAuth]   redirect_uri:', redirectUri);
  console.log('[Linuxdo OAuth]   client_id:', linuxdoClientId.substring(0, 10) + '...');
  console.log('[Linuxdo OAuth]   code:', code.substring(0, 20) + '...');

  const response = await fetch(LINUXDO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: linuxdoClientId,
      client_secret: linuxdoClientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Linuxdo OAuth] token 交换失败:', response.status, errorText);
    throw new Error(`Linuxdo 登录失败: ${response.status} - ${errorText || '授权码无效或已过期，请重新登录'}`);
  }

  const result = await response.json();
  console.log('[Linuxdo OAuth] token 交换成功');
  return result;
}

/**
 * 使用访问令牌获取用户信息
 */
export async function getLinuxdoUserInfo(accessToken: string): Promise<LinuxdoUserInfo> {
  const response = await fetch(LINUXDO_USER_INFO_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'PromptMate/1.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get user info: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * 检查 Linuxdo OAuth 是否已配置
 */
export function isLinuxdoConfigured(): boolean {
  const { linuxdoClientId, linuxdoClientSecret } = env;
  return !!(linuxdoClientId && linuxdoClientSecret);
}

/**
 * 在 Supabase 中创建或获取 Linuxdo 用户
 */
export async function createOrGetLinuxdoUser(
  linuxdoUser: LinuxdoUserInfo,
  email: string
): Promise<{ id: string; email: string }> {
  const { supabaseUrl, supabaseServiceKey } = env;

  // 使用 Supabase Admin API 查找或创建用户
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'GET',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to query users: ${response.status}`);
  }

  const users = await response.json();
  const existingUser = users.users?.find((u: any) => u.email === email);

  if (existingUser) {
    return {
      id: existingUser.id,
      email: existingUser.email,
    };
  }

  // 创建新用户
  const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: {
        provider: 'linuxdo',
        provider_id: String(linuxdoUser.id),
        username: linuxdoUser.username,
        name: linuxdoUser.name || linuxdoUser.username,
        avatar_template: linuxdoUser.avatar_template,
      },
      app_metadata: {
        provider: 'linuxdo',
        providers: ['linuxdo'],
      },
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create user: ${createResponse.status} ${errorText}`);
  }

  const newUser = await createResponse.json();
  return {
    id: newUser.id,
    email: newUser.email,
  };
}

/**
 * 为 Linuxdo 用户生成 Supabase 会话
 * 使用 Supabase Admin API 创建 magic link 并验证以获取令牌
 */
export async function generateSupabaseSession(userId: string, email: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { supabaseUrl, supabaseServiceKey } = env;

  console.log('[Linuxdo OAuth] 开始生成 Supabase 会话');
  console.log('[Linuxdo OAuth] userId:', userId);
  console.log('[Linuxdo OAuth] email:', email);

  // 使用正确的 Supabase Admin API 端点生成 magic link
  // API 文档：https://supabase.com/docs/reference/javascript/auth-admin-generatelink
  const linkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'magiclink',
      email: email,
    }),
  });

  if (!linkResponse.ok) {
    const errorText = await linkResponse.text();
    console.error('[Linuxdo OAuth] generate_link 失败:', linkResponse.status, errorText);
    throw new Error(`Failed to generate link: ${linkResponse.status} ${errorText}`);
  }

  const linkData = await linkResponse.json();
  console.log('[Linuxdo OAuth] generate_link 响应:', JSON.stringify(linkData, null, 2));
  
  // Supabase 返回的数据结构包含 properties.action_link 和 properties.hashed_token
  const actionLink = linkData.properties?.action_link;
  const hashedToken = linkData.properties?.hashed_token;
  
  if (!actionLink && !hashedToken) {
    console.error('[Linuxdo OAuth] generate_link 返回数据缺少必要字段:', linkData);
    throw new Error('No action link or hashed token returned from generate_link');
  }

  console.log('[Linuxdo OAuth] 获取到 action_link，开始验证...');

  // 方法1：使用 hashed_token 通过 verifyOtp 获取会话
  if (hashedToken) {
    console.log('[Linuxdo OAuth] 尝试使用 hashed_token 验证...');
    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        token_hash: hashedToken,
        email: email,
      }),
    });

    if (verifyResponse.ok) {
      const session = await verifyResponse.json();
      console.log('[Linuxdo OAuth] verify 成功，获取到会话');
      if (session.access_token) {
        return {
          access_token: session.access_token,
          refresh_token: session.refresh_token || '',
          expires_in: session.expires_in || 3600,
        };
      }
    } else {
      const errorText = await verifyResponse.text();
      console.log('[Linuxdo OAuth] verify 失败:', verifyResponse.status, errorText);
    }
  }

  // 方法2：从 action_link 中提取 token 并验证
  if (actionLink) {
    console.log('[Linuxdo OAuth] 尝试从 action_link 提取 token...');
    try {
      const url = new URL(actionLink);
      const token = url.searchParams.get('token');
      const tokenHash = url.hash ? new URLSearchParams(url.hash.slice(1)).get('token_hash') : null;
      
      console.log('[Linuxdo OAuth] 从 URL 提取的 token:', token ? token.substring(0, 20) + '...' : 'null');
      console.log('[Linuxdo OAuth] 从 URL 提取的 token_hash:', tokenHash ? tokenHash.substring(0, 20) + '...' : 'null');
      
      const verifyToken = tokenHash || token;
      if (verifyToken) {
        const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'magiclink',
            token_hash: verifyToken,
            email: email,
          }),
        });

        if (verifyResponse.ok) {
          const session = await verifyResponse.json();
          console.log('[Linuxdo OAuth] 通过 action_link token 验证成功');
          if (session.access_token) {
            return {
              access_token: session.access_token,
              refresh_token: session.refresh_token || '',
              expires_in: session.expires_in || 3600,
            };
          }
        } else {
          const errorText = await verifyResponse.text();
          console.log('[Linuxdo OAuth] action_link token 验证失败:', verifyResponse.status, errorText);
        }
      }
    } catch (urlError) {
      console.error('[Linuxdo OAuth] 解析 action_link URL 失败:', urlError);
    }
  }

  // 如果以上方法都不行，返回错误
  console.error('[Linuxdo OAuth] 所有验证方法都失败');
  throw new Error('Failed to generate Supabase session for Linuxdo user');
}

