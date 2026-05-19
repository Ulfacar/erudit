#!/bin/bash
# PostgreSQL backup script for ERUDIT
# Run via cron: 0 2 * * * /root/erudit/scripts/backup.sh

set -euo pipefail

BACKUP_DIR="/root/backups/erudit"
DB_URL="${DATABASE_URL:-postgresql://erudit:erudit@localhost:5434/erudit}"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
pg_dump "$DB_URL" | gzip > "$BACKUP_DIR/erudit_${DATE}.sql.gz"

# Remove backups older than retention
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: erudit_${DATE}.sql.gz"
