#!/usr/bin/env bash
set -u
set -o pipefail

PROJECT_REF="rcpjaiaqjhcbcnpbknek"
DB_HOST="aws-1-us-west-2.pooler.supabase.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.${PROJECT_REF}"
BACKUP_GZ="${HOME}/Downloads/db_cluster-26-12-2025@16-20-57.backup.gz"
RESTORE_LOG="$(pwd)/supabase-restore-${PROJECT_REF}.log"

find_psql() {
  local candidates=(
    "psql"
    "${HOME}/.homebrew/opt/libpq/bin/psql"
    "/opt/homebrew/opt/libpq/bin/psql"
    "/opt/homebrew/bin/psql"
    "/usr/local/opt/libpq/bin/psql"
    "/usr/local/bin/psql"
  )

  for candidate in "${candidates[@]}"; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      command -v "${candidate}"
      return 0
    fi
    if [[ -x "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  return 1
}

if [[ ! -f "${BACKUP_GZ}" ]]; then
  echo "Backup file not found: ${BACKUP_GZ}" >&2
  exit 1
fi

PSQL_BIN="$(find_psql || true)"
if [[ -z "${PSQL_BIN}" ]]; then
  cat >&2 <<'MSG'
psql was not found.

Install it first, then rerun this script:
  /Users/luo/.homebrew/bin/brew install libpq

If Homebrew links libpq as keg-only, use:
  export PATH="/Users/luo/.homebrew/opt/libpq/bin:$PATH"
MSG
  exit 1
fi

echo "Project ref: ${PROJECT_REF}"
echo "Backup: ${BACKUP_GZ}"
echo "psql: ${PSQL_BIN}"
echo "Log: ${RESTORE_LOG}"
echo
printf 'Database password for the new Supabase project: '
IFS= read -r -s DB_PASSWORD
echo

echo "Restoring backup. Supabase says some 'object already exists' errors are expected."
echo "This can take a few minutes..."

PGPASSWORD="${DB_PASSWORD}" PGSSLMODE=require \
  gzip -dc "${BACKUP_GZ}" \
  | PGPASSWORD="${DB_PASSWORD}" PGSSLMODE=require "${PSQL_BIN}" \
      -h "${DB_HOST}" \
      -p "${DB_PORT}" \
      -U "${DB_USER}" \
      -d "${DB_NAME}" \
      -v ON_ERROR_STOP=0 \
      2>&1 | tee "${RESTORE_LOG}"

restore_status=${PIPESTATUS[1]}
if [[ ${restore_status} -ne 0 ]]; then
  echo
  echo "Restore command exited with status ${restore_status}. Check ${RESTORE_LOG}."
  exit "${restore_status}"
fi

echo
echo "Checking restored public tables..."
PGPASSWORD="${DB_PASSWORD}" PGSSLMODE=require "${PSQL_BIN}" \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -c "select schemaname, relname, n_live_tup from pg_stat_user_tables where schemaname = 'public' order by relname;"

echo
echo "Restore command completed. Review ${RESTORE_LOG} for expected restore warnings."
