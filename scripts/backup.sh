#!/bin/sh
set -eu
stamp=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump -h db -U campuszeit -d campuszeit -Fc > "/backups/database-$stamp.dump.tmp"
mv "/backups/database-$stamp.dump.tmp" "/backups/database-$stamp.dump"
tar -czf "/backups/media-$stamp.tar.gz" -C /media .
find /backups -maxdepth 1 -type f -mtime +14 -name 'database-*.dump' -delete
find /backups -maxdepth 1 -type f -mtime +14 -name 'media-*.tar.gz' -delete
echo "Backup abgeschlossen: $stamp"
