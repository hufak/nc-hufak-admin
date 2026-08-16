#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="ssh-w00ccd84"
REMOTE_HOST="w00ccd84.kasserver.com"
REMOTE_PATH="/www/htdocs/w00ccd84/cloud.hufak.net/apps/hufak"
# the Nextcloud root the app lives in, i.e. two levels above apps/hufak
OCC_PATH="/www/htdocs/w00ccd84/cloud.hufak.net/occ"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Building..."
npm run build

echo "==> Creating remote app directory..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_PATH}/studentstats2025'"

echo "==> Deploying app files..."
scp -r appinfo lib img js css templates "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

# the defaults the backend reads from the app root
scp hufak_default_apporder.json hufak_default_shared_mailboxes.json \
	hufak_signature_template.txt hufak_default_new_account_information_sheet.md \
	"${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

# the student stats CSVs, served through the app's student-stats API route
scp -r studentstats2025/public "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/studentstats2025/"

# Nextcloud caches the app's routes, templates and asset URLs, so freshly copied
# files only take effect once the app is loaded again. Disabling and re-enabling
# it is what the old server-side reload script did, and it also enables the app
# on a first-time install.
echo "==> Reloading the app in Nextcloud..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" \
	"php '${OCC_PATH}' app:disable hufak && php '${OCC_PATH}' app:enable hufak"

echo "==> Done."
