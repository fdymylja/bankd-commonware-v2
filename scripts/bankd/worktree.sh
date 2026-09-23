#!/usr/bin/env bash
# Worktrees that share one cargo build dir, so each one doesn't cost 20-100G.
#
#   worktree.sh add <name>   new worktree at ../bankd-commonware-v2-wt/<name> on branch reece/v2-<name>
#   worktree.sh rm  <name>   remove the worktree (the branch stays)
#   worktree.sh clean        wipe the shared build dir
#
# The shared config lives in ../bankd-commonware-v2-wt/.cargo/config.toml. Cargo picks it up
# for every worktree under that dir (on top of the repo's own .cargo/config.toml), so nothing
# needs exporting. Builds in different worktrees wait on each other's cargo lock, which is
# fine since CPU is the bottleneck anyway.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WT_ROOT="${BANKD_WT_ROOT:-$(dirname "$ROOT")/$(basename "$ROOT")-wt}"
SHARED_TARGET="$WT_ROOT/target"

ensure_shared_config() {
  mkdir -p "$WT_ROOT/.cargo"
  local cfg="$WT_ROOT/.cargo/config.toml"
  [[ -f "$cfg" ]] && return
  cat >"$cfg" <<EOF
[build]
target-dir = "$SHARED_TARGET"
# incremental caches were ~half the target dir and don't help one-off agent builds
incremental = false
EOF
  echo "wrote $cfg"
}

# Submodules come from the main checkout's object store, never a fresh clone.
init_submodules() {
  local wt="$1" p
  for p in $(git -C "$wt" config -f .gitmodules --get-regexp '\.path$' | awk '{print $2}'); do
    [[ -d "$ROOT/.git/modules/$p" ]] || continue
    GIT_LFS_SKIP_SMUDGE=1 git -C "$wt" submodule update -q --init --reference "$ROOT/.git/modules/$p" "$p"
  done
  # git-lfs can't read chained alternates, so copy shieldd's LFS files from the main checkout.
  # They show as modified in the worktree's shieldd. Don't commit them.
  if [[ -d "$wt/shieldd" ]]; then
    git -C "$ROOT/shieldd" lfs ls-files -n | while read -r f; do cp "$ROOT/shieldd/$f" "$wt/shieldd/$f"; done
  fi
}

cmd="${1:-}"
case "$cmd" in
  add)
    name="${2:?usage: worktree.sh add <name>}"
    wt="$WT_ROOT/$name"
    ensure_shared_config
    git -C "$ROOT" worktree add -q -b "reece/v2-$name" "$wt" HEAD
    init_submodules "$wt"
    echo "worktree $wt on reece/v2-$name, builds go to $SHARED_TARGET"
    ;;
  rm)
    name="${2:?usage: worktree.sh rm <name>}"
    git -C "$ROOT" worktree remove --force "$WT_ROOT/$name"
    echo "removed $WT_ROOT/$name (branch reece/v2-$name kept)"
    ;;
  clean)
    rm -rf "$SHARED_TARGET"
    echo "removed $SHARED_TARGET"
    ;;
  *)
    sed -n '2,11p' "$0"
    exit 1
    ;;
esac
