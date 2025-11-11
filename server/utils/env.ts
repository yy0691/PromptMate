import fs from 'fs';
import path from 'path';

export interface EnvConfig {
  port: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  corsOrigins: string[];
  auditAdminSecret?: string;
}

const defaultEnvPath = path.resolve(process.cwd(), 'server/.env');

function parseEnvFile(filePath: string) {
  const env: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!env[key]) {
      env[key] = value.replace(/^"|"$/g, '');
    }
  }
  return env;
}

function getEnvValue(key: string, source: Record<string, string | undefined>, fallback?: string): string {
  const value = source[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
}

export function loadEnv(): EnvConfig {
  let fileEnv: Record<string, string> = {};
  if (fs.existsSync(defaultEnvPath)) {
    try {
      fileEnv = parseEnvFile(defaultEnvPath);
    } catch (err) {
      console.warn('Failed to parse server/.env file:', err);
    }
  }
  const mergedEnv = { ...fileEnv, ...process.env } as Record<string, string | undefined>;

  return {
    port: Number.parseInt(mergedEnv.PORT ?? '8787', 10),
    supabaseUrl: getEnvValue('SUPABASE_URL', mergedEnv),
    supabaseAnonKey: getEnvValue('SUPABASE_ANON_KEY', mergedEnv),
    supabaseServiceKey: getEnvValue('SUPABASE_SERVICE_ROLE_KEY', mergedEnv),
    corsOrigins: (mergedEnv.CORS_ORIGINS ?? '*')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    auditAdminSecret: mergedEnv.AUDIT_ADMIN_SECRET,
  };
}
