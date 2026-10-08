#!/bin/sh
set -eu
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
export PORT=8080
export HOSTNAME=0.0.0.0
cd "${LAMBDA_TASK_ROOT:-/var/task}"
exec node bootstrap.mjs
