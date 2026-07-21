#!/bin/zsh

STUDIO_DIR=${0:A:h}
STUDIO_PORT=${PORT:-4173}

cd "$STUDIO_DIR" || exit 1

PORT="$STUDIO_PORT" HOST="0.0.0.0" node server.js &
STUDIO_SERVER_PID=$!

cleanup_studio_server() {
  kill "$STUDIO_SERVER_PID" 2>/dev/null
}

trap cleanup_studio_server EXIT INT TERM

for attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:${STUDIO_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

STUDIO_WIFI_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [[ -n "$STUDIO_WIFI_IP" ]]; then
  echo "Открыть конструктор с телефона: http://${STUDIO_WIFI_IP}:${STUDIO_PORT}/"
fi

if [[ -z "$ADMIN_PASSWORD" ]]; then
  echo "Локальный пароль: wedding"
fi

open "http://127.0.0.1:${STUDIO_PORT}/"
wait "$STUDIO_SERVER_PID"
