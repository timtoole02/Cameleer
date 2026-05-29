#!/usr/bin/env bash
set -euo pipefail

root="${1:-qa/evidence-bundles}"

if [[ ! -d "$root" ]]; then
  printf 'evidence bundle root not found: %s\n' "$root" >&2
  exit 1
fi

found=0
while IFS= read -r -d '' sums; do
  found=1
  bundle_dir=$(dirname "$sums")
  first_path=$(awk 'NF >= 2 { print $2; exit }' "$sums")

  printf 'checking %s\n' "$sums"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if ! git ls-files --error-unmatch "$sums" >/dev/null 2>&1; then
      printf 'skipping untracked checksum file: %s\n' "$sums"
      continue
    fi
    while IFS= read -r listed_path; do
      [[ -n "$listed_path" ]] || continue
      if [[ "$listed_path" == ./* ]]; then
        tracked_path="$bundle_dir/${listed_path#./}"
      elif [[ "$listed_path" == qa/evidence-bundles/* || "$listed_path" == "$root"/* ]]; then
        tracked_path="$listed_path"
      else
        tracked_path="$bundle_dir/$listed_path"
      fi
      if ! git ls-files --error-unmatch "$tracked_path" >/dev/null 2>&1; then
        printf 'checksum entry is not a tracked public artifact: %s -> %s\n' "$sums" "$listed_path" >&2
        exit 1
      fi
    done < <(awk 'NF >= 2 { print $2 }' "$sums")
  fi
  if [[ "$first_path" == qa/evidence-bundles/* || "$first_path" == "$root"/* ]]; then
    sha256sum -c "$sums" >/dev/null
  else
    (cd "$bundle_dir" && sha256sum -c SHA256SUMS >/dev/null)
  fi
done < <(find "$root" -name SHA256SUMS -print0 | sort -z)

if [[ "$found" -eq 0 ]]; then
  printf 'no SHA256SUMS files found under %s\n' "$root" >&2
  exit 1
fi
