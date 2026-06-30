set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== EdgeMarket dev startup ==="

# ── Load .env if it exists ─────────────────────────────────────────────────
ENV_FILE="$ROOT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  echo "[env] Loading secrets from .env ..."
  # Export each non-comment, non-blank line as an env variable
  set -o allexport
  # shellcheck source=.env
  source "$ENV_FILE"
  set +o allexport
fi

if [ -z "$JAVA_HOME" ]; then
  echo "WARNING: JAVA_HOME is not set. Spring Boot needs Java 21."
  echo "  Add: JAVA_HOME=C:/Program Files/Java/jdk-21.0.10  to your .env"
fi

if [ -z "$DB_PASSWORD" ]; then
  echo "WARNING: DB_PASSWORD is not set. Spring Boot cannot connect to Neon Postgres."
fi

if [ -z "$JWT_SECRET" ]; then
  echo "WARNING: JWT_SECRET is not set. Spring Boot will refuse to start."
fi

# ── Stripe CLI path (Windows exe in Program Files) ─────────────────────────
# Adds C:/Program Files to PATH so bash can find stripe.exe
export PATH="$PATH:/c/Program Files"

# 1. Spring Boot API (port 8080)
echo "[1/3] Starting Spring Boot API on :8080 ..."
(
  cd "$ROOT_DIR/spring-server"
  ./mvnw spring-boot:run
) &
SPRING_PID=$!

# 2. Expo frontend (port 8081)
# --localhost ensures Metro binds to 127.0.0.1, which the Android emulator
# reaches via the built-in 10.0.2.2 alias — no adb reverse needed.
echo "[2/3] Starting Expo frontend on :8081 ..."
(
  cd "$ROOT_DIR"
  npx expo start --localhost --android
) &
EXPO_PID=$!

# 3. Stripe webhook forwarder (optional — skip if stripe not installed or key not set)
STRIPE_PID=""
if command -v stripe &>/dev/null; then
  if [ -n "$STRIPE_SECRET_KEY" ]; then
    echo "[3/3] Starting Stripe webhook forwarder → :8080/api/subscription/webhook ..."
    stripe listen --forward-to http://localhost:8080/api/subscription/webhook &
    STRIPE_PID=$!
  else
    echo "[3/3] Skipping Stripe forwarder — STRIPE_SECRET_KEY not set in .env"
  fi
else
  echo "[3/3] Skipping Stripe forwarder — stripe CLI not found (install from https://stripe.com/docs/stripe-cli)"
fi

trap "echo 'Stopping services...'; kill $SPRING_PID $EXPO_PID ${STRIPE_PID:-} 2>/dev/null" EXIT INT TERM

wait
