#!/usr/bin/env bash
# ==============================================================================
# FlowML Studio Desktop Application Launcher (Offline Mode)
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$DIR/Source Code/backend"
FRONTEND_DIR="$DIR/Source Code/frontend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python"
UVICORN_BIN="$BACKEND_DIR/venv/bin/uvicorn"
ELECTRON_BIN="$FRONTEND_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"

echo "=========================================================="
echo " Starting FlowML Studio Desktop (Offline Mode)..."
echo "=========================================================="

export DEV_AUTH=1
export OFFLINE_MODE=1
export MPLCONFIGDIR="${HOME:-/tmp}/.matplotlib"
export FLOWML_STORAGE_DIR="$BACKEND_DIR/storage"
export STORAGE_ROOT="$BACKEND_DIR/storage"

mkdir -p "$MPLCONFIGDIR"
mkdir -p "$STORAGE_ROOT"

# 1. Start local FastAPI ML backend if not already listening on port 8000
if lsof -i :8000 >/dev/null 2>&1; then
    echo "[✓] FastAPI backend is active on http://127.0.0.1:8000"
else
    echo "[+] Booting FastAPI ML Engine on http://127.0.0.1:8000..."
    if [ -f "$UVICORN_BIN" ]; then
        (cd "$BACKEND_DIR" && "$UVICORN_BIN" app:app --host 127.0.0.1 --port 8000 --app-dir "$BACKEND_DIR" >/dev/null 2>&1 &)
    elif [ -f "$VENV_PYTHON" ]; then
        (cd "$BACKEND_DIR" && "$VENV_PYTHON" -m uvicorn app:app --host 127.0.0.1 --port 8000 --app-dir "$BACKEND_DIR" >/dev/null 2>&1 &)
    else
        (cd "$BACKEND_DIR" && python3 -m uvicorn app:app --host 127.0.0.1 --port 8000 --app-dir "$BACKEND_DIR" >/dev/null 2>&1 &)
    fi
    BACKEND_PID=$!
    echo "[✓] Backend started (PID: $BACKEND_PID)"
fi

# 2. Launch Native Electron Desktop Window
cd "$FRONTEND_DIR"

if [ -f "$ELECTRON_BIN" ]; then
    echo "[+] Launching native FlowML Electron Desktop Window..."
    exec "$ELECTRON_BIN" "$FRONTEND_DIR/electron/main.cjs"
elif [ -f "$FRONTEND_DIR/node_modules/.bin/electron" ]; then
    echo "[+] Launching native FlowML Electron via bin..."
    exec "$FRONTEND_DIR/node_modules/.bin/electron" "$FRONTEND_DIR/electron/main.cjs"
else
    echo "[+] Launching npm run desktop..."
    exec npm run desktop
fi
