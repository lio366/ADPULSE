#!/bin/sh
set -eu

: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
MYSQL_HOST="${MYSQL_HOST:-mysql}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

while true; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="$BACKUP_DIR/${MYSQL_DATABASE}-${stamp}.sql.gz"
  echo "Starting database backup: $target"
  if MYSQL_PWD="$MYSQL_PASSWORD" mysqldump \
      --host="$MYSQL_HOST" --user="$MYSQL_USER" \
      --single-transaction --routines --triggers --events \
      --default-character-set=utf8mb4 "$MYSQL_DATABASE" | gzip > "$target"; then
    echo "Backup completed: $target"
    find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
  else
    rm -f "$target"
    echo "Backup failed" >&2
  fi
  sleep 86400
done
