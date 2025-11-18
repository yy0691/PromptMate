/**
 * 模板市场控制器
 * 管理公共提示词市场的CRUD操作
 */

import { RequestContext } from '../types';
import {
  deleteFromTable,
  insertTable,
  queryTable,
  updateTable,
} from '../services/supabaseClient';
import { sendError, sendJson, sendNoContent } from '../utils/response';
import { assertArray, assertObject, assertString } from '../utils/validation';
import { fetchProfile } from '../services/supabaseClient';

/**
 * 检查用户是否为管理员
 */
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const profile = await fetchProfile(userId);
    // 假设管理员角色存储在profile的role字段中
    // 或者可以通过user_metadata判断
    const profileAny = profile as any;
    return profileAny?.role === 'admin' || profileAny?.role === 'administrator' || profileAny?.is_admin === true;
  } catch {
    return false;
  }
}

/**
 * 检查用户是否有权限操作指定的提示词
 */
async function canModifyPrompt(userId: string, promptId: string): Promise<boolean> {
  try {
    // 检查是否为管理员
    if (await isAdmin(userId)) {
      return true;
    }
    
    // 检查是否为提示词所有者
    const [prompt] = await queryTable('marketplace_prompts', {
      id: `eq.${promptId}`,
      user_id: `eq.${userId}`,
    });
    
    return prompt !== undefined;
  } catch {
    return false;
  }
}

/**
 * 获取市场提示词列表
 * 所有用户都可以查看，支持搜索和筛选
 */
export async function listMarketplacePrompts(context: RequestContext) {
  try {
    const filters: Record<string, string> = {};
    
    // 只显示已审核通过的提示词（普通用户）
    if (!context.user || !(await isAdmin(context.user.id))) {
      filters.status = `eq.approved`;
    }
    
    // 搜索关键词
    const search = context.query.get('search');
    if (search) {
      filters.or = `(title.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search}})`;
    }
    
    // 分类筛选
    const category = context.query.get('category');
    if (category) {
      filters.category = `eq.${category}`;
    }
    
    // 标签筛选
    const tag = context.query.get('tag');
    if (tag) {
      filters.tags = `cs.{${tag}}`;
    }
    
    // 用户筛选（只显示某个用户的提示词）
    const userId = context.query.get('user_id');
    if (userId) {
      filters.user_id = `eq.${userId}`;
    }
    
    // 排序
    const orderBy = context.query.get('order_by') || 'created_at';
    const ascending = context.query.get('ascending') === 'true';
    
    const data = await queryTable('marketplace_prompts', filters, {
      order: orderBy,
      ascending,
    });
    
    sendJson(context.res, 200, { data });
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to load marketplace prompts', 'INVALID_PARAMS');
  }
}

/**
 * 获取单个市场提示词详情
 */
export async function getMarketplacePrompt(context: RequestContext) {
  try {
    const { id } = context.params;
    if (!id) {
      sendError(context.res, 400, 'Prompt id is required', 'INVALID_PARAMS');
      return;
    }
    
    const filters: Record<string, string> = {
      id: `eq.${id}`,
    };
    
    // 普通用户只能查看已审核的提示词
    if (!context.user || !(await isAdmin(context.user.id))) {
      filters.status = `eq.approved`;
    }
    
    const [prompt] = await queryTable('marketplace_prompts', filters);
    
    if (!prompt) {
      sendError(context.res, 404, 'Prompt not found', 'NOT_FOUND');
      return;
    }
    
    sendJson(context.res, 200, prompt);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to load prompt', 'INVALID_PARAMS');
  }
}

/**
 * 上传提示词到市场
 * 需要登录，上传后状态为pending（待审核）
 */
export async function createMarketplacePrompt(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    
    const body = assertObject(context.body, 'body');
    const title = assertString(body.title, 'title');
    const content = assertString(body.content, 'content');
    const description = body.description ? assertString(body.description, 'description') : '';
    const category = body.category ? assertString(body.category, 'category') : 'other';
    const tags = body.tags ? assertArray(body.tags, 'tags') : [];
    
    // 管理员上传的提示词自动审核通过
    const isUserAdmin = await isAdmin(context.user.id);
    const status = isUserAdmin ? 'approved' : 'pending';
    
    const [prompt] = await insertTable('marketplace_prompts', {
      user_id: context.user.id,
      title,
      content,
      description,
      category,
      tags,
      status,
      view_count: 0,
      download_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    sendJson(context.res, 201, prompt);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to create marketplace prompt', 'INVALID_PARAMS');
  }
}

/**
 * 更新市场提示词
 * 只能更新自己的提示词，管理员可以更新任何提示词
 */
export async function updateMarketplacePrompt(context: RequestContext) {
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
    
    // 检查权限
    if (!(await canModifyPrompt(context.user.id, id))) {
      sendError(context.res, 403, 'Permission denied', 'FORBIDDEN');
      return;
    }
    
    const body = assertObject(context.body, 'body');
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (body.title !== undefined) {
      payload.title = assertString(body.title, 'title');
    }
    if (body.content !== undefined) {
      payload.content = assertString(body.content, 'content');
    }
    if (body.description !== undefined) {
      payload.description = body.description ? assertString(body.description, 'description') : '';
    }
    if (body.category !== undefined) {
      payload.category = assertString(body.category, 'category');
    }
    if (body.tags !== undefined) {
      payload.tags = assertArray(body.tags, 'tags');
    }
    
    // 管理员可以修改状态
    if (body.status !== undefined && await isAdmin(context.user.id)) {
      payload.status = assertString(body.status, 'status');
    }
    
    const [updated] = await updateTable('marketplace_prompts', {
      id: `eq.${id}`,
    }, payload);
    
    sendJson(context.res, 200, updated);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to update marketplace prompt', 'INVALID_PARAMS');
  }
}

/**
 * 删除市场提示词
 * 只能删除自己的提示词，管理员可以删除任何提示词
 */
export async function deleteMarketplacePrompt(context: RequestContext) {
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
    
    // 检查权限
    if (!(await canModifyPrompt(context.user.id, id))) {
      sendError(context.res, 403, 'Permission denied', 'FORBIDDEN');
      return;
    }
    
    await deleteFromTable('marketplace_prompts', {
      id: `eq.${id}`,
    });
    
    sendNoContent(context.res);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to delete marketplace prompt', 'INVALID_PARAMS');
  }
}

/**
 * 审核提示词（仅管理员）
 */
export async function reviewMarketplacePrompt(context: RequestContext) {
  try {
    if (!context.user) {
      sendError(context.res, 401, 'Not authenticated', 'UNAUTHORIZED');
      return;
    }
    
    if (!(await isAdmin(context.user.id))) {
      sendError(context.res, 403, 'Admin access required', 'FORBIDDEN');
      return;
    }
    
    const { id } = context.params;
    if (!id) {
      sendError(context.res, 400, 'Prompt id is required', 'INVALID_PARAMS');
      return;
    }
    
    const body = assertObject(context.body, 'body');
    const status = assertString(body.status, 'status');
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      sendError(context.res, 400, 'Invalid status', 'INVALID_PARAMS');
      return;
    }
    
    const payload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    
    // 可以添加审核备注
    if (body.review_comment !== undefined) {
      payload.review_comment = assertString(body.review_comment, 'review_comment');
    }
    
    const [updated] = await updateTable('marketplace_prompts', {
      id: `eq.${id}`,
    }, payload);
    
    sendJson(context.res, 200, updated);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to review marketplace prompt', 'INVALID_PARAMS');
  }
}

/**
 * 下载提示词（增加下载计数）
 */
export async function downloadMarketplacePrompt(context: RequestContext) {
  try {
    const { id } = context.params;
    if (!id) {
      sendError(context.res, 400, 'Prompt id is required', 'INVALID_PARAMS');
      return;
    }
    
    // 获取提示词
    const [prompt] = await queryTable('marketplace_prompts', {
      id: `eq.${id}`,
      status: `eq.approved`, // 只能下载已审核的提示词
    });
    
    if (!prompt) {
      sendError(context.res, 404, 'Prompt not found', 'NOT_FOUND');
      return;
    }
    
    // 增加下载计数
    await updateTable('marketplace_prompts', {
      id: `eq.${id}`,
    }, {
      download_count: (prompt.download_count || 0) + 1,
    });
    
    sendJson(context.res, 200, prompt);
  } catch (error: any) {
    sendError(context.res, 400, error.message ?? 'Failed to download marketplace prompt', 'INVALID_PARAMS');
  }
}

