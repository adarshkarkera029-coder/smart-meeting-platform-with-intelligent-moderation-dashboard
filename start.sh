#!/bin/bash

# Cleanup function to kill background processes on exit
cleanup() {
    echo "Stopping services..."
    # kill 0 sends a TERM signal to all processes in the current process group
    kill 0
}
trap cleanup EXIT

echo "Starting backend..."
cd backend
npm run dev &
cd ..

echo "Starting frontend..."
cd frontend
npm run dev &
cd ..

echo "Services started! Press Ctrl+C to stop."
wait
