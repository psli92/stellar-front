#!/bin/sh
# Also safe when sourced: no exit and no changes to the caller's shell.
(
set -eu
stellar_front_main() {
    script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE:-$0}")" && pwd)
    root=$(CDPATH= cd -- "$script_dir/.." && pwd)
    [ "$#" -le 1 ] || { printf 'Usage: sh scripts/setup-front.sh [reseau-docker]\n' >&2; return 2; }
    [ -f "$root/.env" ] || { printf 'Créer .env depuis .env.example avant le déploiement.\n' >&2; return 2; }
    if [ "$#" -eq 1 ]; then SK_NETWORK=$1; export SK_NETWORK; fi
    cd "$root"
    docker compose config --quiet || return $?
    # Compose checks that the selected external network already exists.
    docker compose build --pull || return $?
    docker compose up -d --wait || return $?
}
stellar_front_main "$@"
)
