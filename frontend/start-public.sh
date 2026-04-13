#!/bin/bash
# =============================================
# PQlyMarket Frontend + Cloudflare Tunnel Launcher
# =============================================
# This script starts the frontend server and
# exposes it via cloudflared for public access
# without phishing warnings (Web3 wallet friendly!).
#
# Custom domain setup (Free via Cloudflare Zero Trust):
#   1. Go to https://dash.cloudflare.com/argotunnel
#   2. Create a tunnel and name it 'pqlymarket'
#   3. Connect it to your custom domain
#   4. Replace the cloudflared quick tunnel command below with your token:
#      cloudflared tunnel --no-autoupdate run --token <YOUR_TOKEN>
# =============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}  PQlyMarket - Public Server Launcher      ${NC}"
echo -e "${CYAN}=========================================${NC}"

# Check if cloudflared is installed
if ! command -v cloudflared >/dev/null 2>&1; then
  echo -e "${RED}Error: cloudflared is not installed. Run: brew install cloudflared${NC}"
  exit 1
fi

# Kill any existing processes
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

# Start the frontend dev server in the background
echo -e "${YELLOW}[1/2] Starting frontend server on port 3000...${NC}"
npm run dev > /tmp/pqlymarket_frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for the frontend to be ready
echo -e "${YELLOW}      Waiting for server to start...${NC}"
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}      Frontend server is ready!${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}      Timeout waiting for frontend server.${NC}"
    kill $FRONTEND_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done

# Start Local RPC Proxy
echo -e "${YELLOW}[2/3] Starting Local RPC Proxy (Spoof Node Host)...${NC}"
node rpc-proxy.js > /tmp/pqlymarket_rpc_proxy.log 2>&1 &
RPC_PROXY_PID=$!
sleep 1

# Start cloudflared Custom Tunnel
echo -e "${YELLOW}[3/3] Starting Cloudflare tunnel...${NC}"

# Load token from environment or .env file
CF_TUNNEL_TOKEN="${CF_TUNNEL_TOKEN:-}"
if [ -z "$CF_TUNNEL_TOKEN" ]; then
  # Try loading from .env file
  if [ -f ".env" ]; then
    CF_TUNNEL_TOKEN=$(grep '^CF_TUNNEL_TOKEN=' .env | cut -d'=' -f2-)
  fi
  if [ -f "../.env" ]; then
    CF_TUNNEL_TOKEN=$(grep '^CF_TUNNEL_TOKEN=' ../.env | cut -d'=' -f2-)
  fi
fi

if [ -z "$CF_TUNNEL_TOKEN" ]; then
  echo -e "${RED}Error: CF_TUNNEL_TOKEN not set. Set it via:${NC}"
  echo -e "  export CF_TUNNEL_TOKEN=your_token_here"
  echo -e "  OR add CF_TUNNEL_TOKEN=your_token to .env file"
  kill $FRONTEND_PID $RPC_PROXY_PID 2>/dev/null
  exit 1
fi

rm -f /tmp/cf_tunnel.log
cloudflared tunnel --no-autoupdate run --token "$CF_TUNNEL_TOKEN" > /tmp/cf_tunnel.log 2>&1 &
CLOUDFLARED_PID=$!
sleep 2

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  ✅ PQlyMarket is now PUBLIC!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "  ${CYAN}Public DApp URL:${NC}  https://pqlymarket.com"
echo -e "  ${CYAN}Public RPC URL:${NC}   https://rpc.pqlymarket.com"
echo -e "  ${CYAN}Local DApp URL:${NC}   http://localhost:3000"
echo -e "  ${CYAN}Local RPC Proxy:${NC}  http://localhost:8546"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all servers.${NC}"
echo ""

# Trap Ctrl+C to cleanly shut down both processes
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $FRONTEND_PID $RPC_PROXY_PID $CLOUDFLARED_PID 2>/dev/null
  pkill -f "cloudflared tunnel" 2>/dev/null
  pkill -f "node rpc-proxy.js" 2>/dev/null
  echo -e "${GREEN}Done.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

wait $FRONTEND_PID $RPC_PROXY_PID $CLOUDFLARED_PID