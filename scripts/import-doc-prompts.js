#!/usr/bin/env node
/**
 * Import prompt templates from @docs/prompts into Supabase marketplace_prompts.
 * - Uses service role key, so keep server/.env present or pass env vars.
 * - Creates/uses a system owner account (by email) to own the imported prompts.
 * - Optionally auto-translates metadata/content snippets for bilingual display.
 */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DOCS_DIR = path.resolve(__dirname, '../@docs/prompts');
const MAX_TRANSLATE_CHARS = 2000;

function parseEnvFile(filePath) {
  try {
    const raw = require('fs').readFileSync(filePath, 'utf8');
    return raw.split(/\r?\n/).reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return acc;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '');
      if (!acc[key]) acc[key] = val;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function loadEnv() {
  const envFile = parseEnvFile(path.resolve(__dirname, '../server/.env'));
  const merged = { ...envFile, ...process.env };
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const key of required) {
    if (!merged[key]) {
      throw new Error(`Missing required env ${key}. Fill server/.env first.`);
    }
  }
  return {
    supabaseUrl: merged.SUPABASE_URL,
    supabaseServiceKey: merged.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    dryRun: args.includes('--dry-run'),
    translate: args.includes('--translate'),
    ownerEmail: 'prompts@promptmate.app',
    ownerNickname: 'PromptMate Library',
    status: 'approved',
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--owner-email' && args[i + 1]) {
      result.ownerEmail = args[i + 1];
      i++;
      continue;
    }
    if (arg === '--owner-nickname' && args[i + 1]) {
      result.ownerNickname = args[i + 1];
      i++;
      continue;
    }
    if (arg === '--status' && args[i + 1]) {
      result.status = args[i + 1];
      i++;
      continue;
    }
    if (arg.startsWith('--owner-email=')) {
      result.ownerEmail = arg.split('=').pop();
      continue;
    }
    if (arg.startsWith('--owner-nickname=')) {
      result.ownerNickname = arg.split('=').pop();
      continue;
    }
    if (arg.startsWith('--status=')) {
      result.status = arg.split('=').pop();
      continue;
    }
    // allow first positional to set ownerEmail (easier in npm run)
    if (!arg.startsWith('-') && result.ownerEmail === 'prompts@promptmate.app') {
      result.ownerEmail = arg;
    }
  }
  return result;
}

function detectLanguage(text) {
  if (/[\\u4e00-\\u9fff]/.test(text)) return 'zh';
  return 'en';
}

function buildDeterministicId(input) {
  const hex = crypto.createHash('sha1').update(input).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function translateText(text, targetLang) {
  if (!text) return '';
  const clipped = text.slice(0, MAX_TRANSLATE_CHARS);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(
    clipped,
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Translate failed (${res.status})`);
  }
  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
  return data[0].map(part => part[0]).join('');
}

async function ensureOwnerUser(env, email, nickname) {
  const headers = {
    apikey: env.supabaseServiceKey,
    Authorization: `Bearer ${env.supabaseServiceKey}`,
    'Content-Type': 'application/json',
  };

  // Find existing by email
  const searchUrl = `${env.supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const searchRes = await fetch(searchUrl, { headers });
  if (!searchRes.ok) {
    const body = await searchRes.text();
    throw new Error(`Failed to search user: ${searchRes.status} ${body}`);
  }
  const searchData = await searchRes.json();
  const existing =
    Array.isArray(searchData?.users) && searchData.users.length > 0
      ? searchData.users[0]
      : searchData?.user || searchData?.[0];
  if (existing?.id) {
    await upsertProfile(env, existing.id, nickname);
    return existing.id;
  }

  // Create new admin user
  const password = crypto.randomBytes(12).toString('hex');
  const createRes = await fetch(`${env.supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { nickname },
    }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Failed to create owner user: ${createRes.status} ${body}`);
  }
  const created = await createRes.json();
  const userId = created?.user?.id || created?.id;
  if (!userId) {
    throw new Error(`Owner user creation returned no id; response: ${JSON.stringify(created)}`);
  }
  await upsertProfile(env, userId, nickname);
  return userId;
}

async function upsertProfile(env, userId, nickname) {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseServiceKey,
      Authorization: `Bearer ${env.supabaseServiceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([{ id: userId, nickname, role: 'admin', is_admin: true }]),
  });
  if (!res.ok) {
    throw new Error(`Failed to upsert profile: ${res.status} ${await res.text()}`);
  }
}

async function readPromptFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw.split(/\\r?\\n/);
  let title = path.basename(filePath, path.extname(filePath));
  let description = '';

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\\s+(.+)/);
    if (headingMatch) {
      title = headingMatch[1].trim();
      continue;
    }
    const trimmed = line.trim();
    if (!description && trimmed && !trimmed.startsWith('By ') && !trimmed.startsWith('http')) {
      description = trimmed;
    }
    if (title && description) break;
  }

  return { title: title.trim(), description: description.trim(), content: raw.trim() };
}

async function fetchExistingPrompt(env, id) {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/marketplace_prompts?id=eq.${id}`, {
    headers: {
      apikey: env.supabaseServiceKey,
      Authorization: `Bearer ${env.supabaseServiceKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch existing prompt: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : undefined;
}

async function upsertMarketplacePrompt(env, payload) {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/marketplace_prompts?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseServiceKey,
      Authorization: `Bearer ${env.supabaseServiceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([payload]),
  });
  if (!res.ok) {
    throw new Error(`Failed to upsert prompt: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : payload;
}

async function main() {
  const args = parseArgs();
  const env = args.dryRun ? null : loadEnv();
  console.log(`Scanning ${DOCS_DIR}`);

  const files = await fs.readdir(DOCS_DIR);
  const mdFiles = files.filter(f => f.toLowerCase().endsWith('.md'));
  if (mdFiles.length === 0) {
    console.log('No markdown prompt templates found.');
    return;
  }

  let ownerId = 'dry-run-owner';
  if (!args.dryRun) {
    console.log(`Ensuring owner user (${args.ownerEmail}) exists...`);
    ownerId = await ensureOwnerUser(env, args.ownerEmail, args.ownerNickname);
    console.log(`Owner user id: ${ownerId}`);
  }

  const results = [];
  for (const file of mdFiles) {
    const fullPath = path.join(DOCS_DIR, file);
    const data = await readPromptFile(fullPath);
    const lang = detectLanguage(data.content);
    const targetLang = lang === 'zh' ? 'en' : 'zh';

    let translatedTitle = '';
    let translatedDesc = '';
    let translatedSnippet = '';
    if (args.translate) {
      try {
        translatedTitle = await translateText(data.title, targetLang);
        translatedDesc = data.description ? await translateText(data.description, targetLang) : '';
        translatedSnippet = await translateText(data.content, targetLang);
      } catch (err) {
        console.warn(`Translate failed for ${file}: ${err.message}`);
      }
    }

    const bilingualTitle = translatedTitle
      ? lang === 'zh'
        ? `${data.title} / ${translatedTitle}`
        : `${data.title} / ${translatedTitle}`
      : data.title;

    const bilingualDesc = translatedDesc
      ? `${data.description} / ${translatedDesc}`
      : data.description;

    const bilingualContent = translatedSnippet
      ? `## Original (${lang === 'zh' ? '中文' : 'English'})\\n${data.content}\\n\\n---\\n\\n## ${
          targetLang === 'zh' ? '中文翻译（自动）' : 'English translation (auto)'
        }\\n${translatedSnippet}`
      : data.content;

    const id = buildDeterministicId(fullPath);
    const existing = args.dryRun ? undefined : await fetchExistingPrompt(env, id);
    const payload = {
      id,
      user_id: ownerId,
      title: bilingualTitle,
      content: bilingualContent,
      description: bilingualDesc,
      category: 'other',
      tags: existing?.tags ?? [],
      status: args.status,
      view_count: existing?.view_count ?? 0,
      download_count: existing?.download_count ?? 0,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    results.push({ file, id, title: payload.title, status: existing ? 'update' : 'insert' });

    if (!args.dryRun) {
      await upsertMarketplacePrompt(env, payload);
    }
  }

  console.log(`Processed ${results.length} prompts from @docs/prompts.`);
  const inserts = results.filter(r => r.status === 'insert').length;
  const updates = results.length - inserts;
  console.log(`Would ${args.dryRun ? 'perform' : 'completed'} ${inserts} inserts, ${updates} updates.`);
  if (args.dryRun) {
    console.log('Sample:', results.slice(0, 5));
  }
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
