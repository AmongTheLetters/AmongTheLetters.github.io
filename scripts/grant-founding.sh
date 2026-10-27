#!/usr/bin/env bash
# Give complimentary founding (lifetime) memberships by email.
#   SUPABASE_ACCESS_TOKEN=... scripts/grant-founding.sh "note for the record" reader1@example.com reader2@example.com
# Each email gets a row in public.founding_grants. It applies at once if a confirmed account exists,
# otherwise when that email signs up and confirms. Safe to re-run. Never prints the token.
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-bwcqeyttbqkivrozbqxm}"
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN in the shell first}"
[ $# -ge 2 ] || { echo "usage: $0 \"note\" email [email ...]" >&2; exit 1; }
note="$1"; shift
sql=$(jq -rn --arg note "$note" --args '
  def lit: "'"'"'" + gsub("'"'"'"; "'"'"''"'"'") + "'"'"'";
  "select public.grant_founding(e, " + ($note | lit) + ") as result from unnest(array[" + ($ARGS.positional | map(lit) | join(",")) + "]::text[]) e"
' "$@")
curl -sS -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$sql" '{query:$q}')" | jq -r 'if type == "array" then .[].result else . end'
