#!/bin/bash
set -e

# Start backend server in background
echo "Starting backend on :3001 ..."
(cd backend && npm run dev) &
BACKEND_PID=$!

# Wait for backend to be ready
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "Backend is up."
    break
  fi
  sleep 1
done

# Start frontend server (exposed port)
echo "Starting frontend on :5173 ..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT

wait $FRONTEND_PID
