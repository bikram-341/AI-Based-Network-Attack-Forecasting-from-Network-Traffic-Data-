#!/bin/bash
# OmniSentinel Startup Script
# Run this ONCE to verify MongoDB, pre-warm PyTorch, and start all services.
# Usage: bash start.sh

set -e
PROJ="$(cd "$(dirname "$0")" && pwd)"
PYTHON="$PROJ/venv/bin/python"
cd "$PROJ"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   OmniSentinel – Starting Up...      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── STEP 0: Check and Start MongoDB ───────────────────────────────────────────
echo "[1/4] Checking MongoDB connection..."
MONGODB_URI_VAL="$(grep -E '^MONGODB_URI=' .env 2>/dev/null | cut -d '=' -f2- | tr -d '\"' | tr -d "'" || true)"
if [ -z "$MONGODB_URI_VAL" ]; then
    MONGODB_URI_VAL="mongodb://localhost:27017"
fi

if [[ "$MONGODB_URI_VAL" == *"localhost"* ]] || [[ "$MONGODB_URI_VAL" == *"127.0.0.1"* ]]; then
    if ! "$PYTHON" -c "import socket; s = socket.socket(); s.settimeout(1); s.connect(('127.0.0.1', 27017)); s.close()" 2>/dev/null; then
        echo "    Local MongoDB is not running. Attempting to start MongoDB..."
        PLIST_FILE="$(find /opt/homebrew/Cellar/mongodb-community -name "homebrew.mxcl.mongodb-community.plist" 2>/dev/null | head -n 1)"
        if [ -n "$PLIST_FILE" ]; then
            launchctl load -w "$PLIST_FILE" 2>/dev/null || true
        elif command -v mongod >/dev/null 2>&1; then
            mkdir -p /opt/homebrew/var/mongodb /opt/homebrew/var/log/mongodb 2>/dev/null || true
            mongod --config /opt/homebrew/etc/mongod.conf &
        fi
        sleep 2
    fi
fi

"$PYTHON" -c "
import asyncio, os
from dotenv import load_dotenv
load_dotenv(override=True)
uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    async def chk():
        kwargs = {'serverSelectionTimeoutMS': 2500}
        if 'mongodb+srv://' in uri:
            import certifi
            kwargs['tlsCAFile'] = certifi.where()
        c = AsyncIOMotorClient(uri, **kwargs)
        info = await c.server_info()
        print('    ✓ MongoDB connected successfully! (Version: ' + str(info.get('version', 'unknown')) + ')')
    asyncio.run(chk())
except Exception as e:
    print('    ⚠ Note: MongoDB offline or unreachable (' + str(e) + ').')
    print('      In-memory demo fallback storage will be activated automatically.')
"
echo ""

# ── STEP 1: Pre-warm PyTorch (compiles ARM kernels once, cached after) ────────
echo "[2/4] Pre-warming PyTorch..."
"$PYTHON" -c "
import torch, warnings
warnings.filterwarnings('ignore')
x = torch.randn(1, 10, 60)
print('    ✓ PyTorch', torch.__version__, 'ready on', ('Apple Silicon' if torch.backends.mps.is_available() else 'CPU'))
"
echo ""

# ── STEP 2: Start FastAPI backend ─────────────────────────────────────────────
echo "[3/4] Starting FastAPI backend on http://localhost:8000 ..."
"$PYTHON" -m uvicorn ml.serving.inference_server:app \
    --host 0.0.0.0 --port 8000 --log-level info &
BACKEND_PID=$!
echo "    Backend PID: $BACKEND_PID"

# Wait until /health responds (max 120 seconds)
echo "    Waiting for backend to be ready..."
for i in $(seq 1 60); do
    sleep 2
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "    ✓ Backend is UP!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "    ✗ Backend did not start in 120 seconds. Check for errors above."
        exit 1
    fi
    echo "    ... still loading ($((i*2))s)"
done
echo ""

# ── STEP 3: Start Traffic Simulator ───────────────────────────────────────────
echo "[4/4] Starting Traffic Simulator & Frontend..."
"$PYTHON" ml/serving/traffic_simulator.py &
SIM_PID=$!
echo "    Simulator PID: $SIM_PID"

# ── STEP 4: Start Frontend ────────────────────────────────────────────────────
cd "$PROJ/frontend"
npm run dev &
FRONTEND_PID=$!
cd "$PROJ"
echo "    Frontend PID: $FRONTEND_PID"
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✓ All services started!                                 ║"
echo "║                                                          ║"
echo "║  Dashboard:  http://localhost:5173                       ║"
echo "║  API:        http://localhost:8000                       ║"
echo "║  API Docs:   http://localhost:8000/docs                  ║"
echo "║                                                          ║"
echo "║  Demo Credentials:                                       ║"
echo "║    Email:    analyst@soc.example                         ║"
echo "║    Password: OmniSentinel2026!                           ║"
echo "║                                                          ║"
echo "║  Press Ctrl+C to stop all services                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Wait and forward Ctrl+C to all children
trap "echo ''; echo 'Stopping all services...'; kill $BACKEND_PID $SIM_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
