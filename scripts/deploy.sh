#!/usr/bin/env bash
# Build + deploy the charity-match contract to Stellar testnet, write the main
# contract id into .env.local.
#
# Constructor: (charity, sponsor, title, match_cap, deadline)
# Defaults: charity = deployer, sponsor = deployer, title = "School Lunches",
# match_cap = 1000 XLM, deadline = now + 14 days.
#
# Usage:
#   scripts/deploy.sh [stellar-key-name]
#   TITLE="..." MATCH_CAP_XLM=500 DEADLINE_SECS=86400 scripts/deploy.sh alice

set -euo pipefail

cd "$(dirname "$0")/.."

SOURCE="${1:-alice}"
NETWORK="testnet"
ENV_FILE=.env.local

ADMIN=$(stellar keys address "$SOURCE")
echo "==> deployer: $ADMIN"
echo "==> resolving native xlm sac"
XLM=$(stellar contract id asset --asset native --network "$NETWORK")
[[ "$XLM" =~ ^C[A-Z0-9]{55}$ ]] || { echo "couldn't resolve native xlm sac: $XLM"; exit 1; }
echo "    -> $XLM"


TITLE=${TITLE:-"School Lunches"}
MATCH_CAP_XLM=${MATCH_CAP_XLM:-1000}
DEADLINE_SECS=${DEADLINE_SECS:-1209600}
MATCH_CAP=$(( MATCH_CAP_XLM * 10000000 ))
DEADLINE=$(( $(date +%s) + DEADLINE_SECS ))
CHARITY=${CHARITY:-$ADMIN}
SPONSOR=${SPONSOR:-$ADMIN}

echo "==> title    : $TITLE"
echo "==> charity  : $CHARITY"
echo "==> sponsor  : $SPONSOR"
echo "==> cap      : $MATCH_CAP_XLM XLM"
echo "==> deadline : $DEADLINE (unix)"

write_env() {
  local key="$1" value="$2"
  if [ -f "$ENV_FILE" ] && grep -q "^$key=" "$ENV_FILE"; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^$key=.*|$key=$value|" "$ENV_FILE"
    else
      sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
    fi
  else
    echo "$key=$value" >> "$ENV_FILE"
  fi
}

echo "==> building main"
stellar contract build --manifest-path contract/main/Cargo.toml >/dev/null
MAIN_WASM=contract/target/wasm32v1-none/release/main_contract.wasm

echo "==> deploying main"
MAIN=$(stellar contract deploy \
  --wasm "$MAIN_WASM" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- --charity "$CHARITY" --sponsor "$SPONSOR" --title "$TITLE" \
     --match_cap "$MATCH_CAP" --deadline "$DEADLINE" \
  --xlm "$XLM" \
  2>&1 | tail -1)
[[ "$MAIN" =~ ^C[A-Z0-9]{55}$ ]] || { echo "main deploy failed: $MAIN"; exit 1; }
echo "    -> $MAIN"

write_env NEXT_PUBLIC_MAIN_CONTRACT_ID "$MAIN"
write_env NEXT_PUBLIC_XLM_CONTRACT_ID "$XLM"
write_env NEXT_PUBLIC_SPONSOR_ADDRESS "$SPONSOR"

echo "==> wrote ids to $ENV_FILE"
echo
echo "main: https://stellar.expert/explorer/testnet/contract/$MAIN"
