#!/bin/sh
set -e

# 如果挂载的目录为空（首次克隆，未构建 dist），从备份恢复
if [ ! -f /usr/share/nginx/html/index.html ]; then
    echo "Restoring built frontend from backup (no dist/ found on host)..."
    cp -r /usr/share/nginx/html-orig/* /usr/share/nginx/html/
fi

exec "$@"
