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
 * 使用 Supabase Admin API 创建用户并生成令牌
 */
export async function generateSupabaseSession(userId: string, email: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { supabaseUrl, supabaseServiceKey } = env;

  // 使用 Supabase Admin API 为用户生成邀请链接，然后提取令牌
  // 或者直接使用 Supabase 的 signInWithId
  
  // 更简单的方法：使用 Supabase 的 Admin API 创建用户时，Supabase 会自动生成会话
  // 但我们这里用户已经存在，所以我们需要使用其他方法
  
  // 最佳实践：使用 Supabase 的 generate_link API 生成 magic link
  // 然后从链接中提取令牌，或者让用户点击链接完成认证
  
  // 简化实现：直接使用 Supabase Admin API 的 createUser 返回的会话信息
  // 但由于用户已存在，我们需要使用 updateUser 或者重新创建
  
  // 实际方案：使用 Supabase 的 custom JWT 或者通过 Admin API 设置用户的认证状态
  // 然后返回一个可以用于客户端认证的令牌
  
  // 临时方案：返回用户 ID，让客户端使用 Supabase 客户端 SDK 的 signInWithId
  // 但这需要客户端配置，不太理想
  
  // 最终方案：使用 Supabase 的 Admin API 生成一个一次性令牌
  // 客户端可以使用这个令牌来获取完整的会话
  
  // 使用 generate_link 生成 magic link
  const linkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/generate_link`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'magiclink',
    }),
  });

  if (!linkResponse.ok) {
    const errorText = await linkResponse.text();
    throw new Error(`Failed to generate link: ${linkResponse.status} ${errorText}`);
  }

  const linkData = await linkResponse.json();
  const actionLink = linkData.properties?.action_link || linkData.action_link;
  
  if (!actionLink) {
    throw new Error('No action link returned from generate_link');
  }

  // 从链接中提取令牌
  // Supabase 的 magic link 格式通常是: https://...?token=...&type=magiclink
  const url = new URL(actionLink);
  const token = url.searchParams.get('token');
  
  if (!token) {
    throw new Error('No token found in action link');
  }

  // 使用令牌交换访问令牌和刷新令牌
  // 通过 Supabase 的 verify 端点
  const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify?token=${token}&type=magiclink`, {
    method: 'GET',
    headers: {
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json',
    },
  });

  if (!verifyResponse.ok) {
    // 如果 verify 不行，我们尝试使用 token 端点
    const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: token, // 使用 magic link token 作为临时密码
      }),
    });

    if (tokenResponse.ok) {
      const session = await tokenResponse.json();
      return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in || 3600,
      };
    }
  } else {
    const session = await verifyResponse.json();
    if (session.access_token) {
      return {
        access_token: session.access_token,
        refresh_token: session.refresh_token || '',
        expires_in: session.expires_in || 3600,
      };
    }
  }

  // 如果以上方法都不行，返回错误
  throw new Error('Failed to generate Supabase session for Linuxdo user');
}

