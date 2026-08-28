#!/usr/bin/env bash
set -euo pipefail

# Moves every submodule to the tip of the branch it tracks and stages the new
# pointers, so the update becomes a commit of its own before ./install.sh
# builds and deploys it.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Checking out submodules..."
# --recursive reaches countrycodes, nested inside studentstats2025; a submodule
# this checkout has never initialised is initialised here rather than skipped
git submodule update --init --recursive

echo "==> Fetching the latest commit of every submodule..."
# only the top level is moved to its upstream tip: the nested ones stay at
# whatever that new commit pins, which is the submodule repo's business
git submodule update --remote --init
# Synchronize nested submodules from each top-level submodule's new commit.
# Running `git submodule update` from the superproject here would reset the
# top-level gitlink back to the pointer recorded in this repository.
git submodule foreach --recursive 'git submodule update --init --recursive'

echo "==> Staging the new pointers..."
git config --file .gitmodules --get-regexp '^submodule\..*\.path$' \
	| cut -d ' ' -f 2- \
	| while IFS= read -r submodule_path; do
		git add -- "$submodule_path"
	done

git submodule status --recursive

if git diff --cached --quiet; then
	echo "==> Already up to date, nothing staged."
else
	echo "==> Done. Commit the staged pointers, then ./install.sh to deploy."
fi
