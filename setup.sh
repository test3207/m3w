#!/bin/bash
# Cross-platform setup script for M3W project (Bash version)
# Works on Linux, macOS, and Windows (Git Bash/WSL)

set -e

USE_DOCKERHUB=false
SKIP_ENV=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --use-dockerhub)
            USE_DOCKERHUB=true
            shift
            ;;
        --skip-env)
            SKIP_ENV=true
            shift
            ;;
        --help)
            cat <<EOF
M3W Project Setup Script
========================

Usage: ./setup.sh [options]

Options:
  --use-dockerhub    Use Docker Hub images instead of GHCR (requires proxy in China)
  --skip-env         Skip environment variable setup
  --help             Show this help message

Examples:
  ./setup.sh                    # Default: Use GHCR images
  ./setup.sh --use-dockerhub    # Use Docker Hub images
  ./setup.sh --skip-env         # Skip .env.local setup

EOF
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BLUE='\033[0;34m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 M3W Project Setup${NC}"
echo -e "${GREEN}===================${NC}"
echo ""

# Detect OS
OS="Unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="Windows (Git Bash)"
fi

echo -e "${CYAN}📋 Detected OS: ${YELLOW}$OS${NC}"
echo ""

# Check prerequisites
echo -e "${CYAN}🔍 Checking prerequisites...${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓ Node.js: $NODE_VERSION${NC}"
else
    echo -e "  ${RED}✗ Node.js not found. Please install Node.js 20+${NC}"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "  ${GREEN}✓ npm: $NPM_VERSION${NC}"
else
    echo -e "  ${RED}✗ npm not found${NC}"
    exit 1
fi

# Check Podman or Docker
CONTAINER_TOOL=""
if command -v podman &> /dev/null; then
    CONTAINER_TOOL="podman"
    echo -e "  ${GREEN}✓ Podman detected${NC}"
    
    # Check podman-compose
    if command -v podman-compose &> /dev/null; then
        echo -e "  ${GREEN}✓ podman-compose detected${NC}"
    else
        echo -e "  ${RED}✗ podman-compose not found${NC}"
        echo -e "    ${YELLOW}Please install: pip install podman-compose${NC}"
        exit 1
    fi
    
    # Check Podman Machine (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if podman machine list 2>&1 | grep -q "Currently running"; then
            echo -e "  ${GREEN}✓ Podman Machine is running${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Podman Machine not running${NC}"
            echo -e "    ${GRAY}Starting Podman Machine...${NC}"
            podman machine start
            echo -e "  ${GREEN}✓ Podman Machine started${NC}"
        fi
    fi
elif command -v docker &> /dev/null; then
    CONTAINER_TOOL="docker"
    echo -e "  ${GREEN}✓ Docker detected${NC}"
else
    echo -e "  ${RED}✗ Neither Podman nor Docker found${NC}"
    echo -e "    ${YELLOW}Please install Podman Desktop: https://podman-desktop.io/${NC}"
    echo -e "    ${YELLOW}Then run: pip install podman-compose${NC}"
    exit 1
fi

echo ""

# Install dependencies
echo -e "${CYAN}📦 Installing npm dependencies...${NC}"
npm install
echo -e "  ${GREEN}✓ Dependencies installed${NC}"
echo ""

# Setup environment variables
if [ "$SKIP_ENV" = false ]; then
    echo -e "${CYAN}🔐 Setting up environment variables...${NC}"
    if [ ! -f ".env.local" ]; then
        cp ".env.example" ".env.local"
        echo -e "  ${GREEN}✓ Created .env.local from template${NC}"
        echo -e "  ${YELLOW}⚠️  Please edit .env.local and add your GitHub OAuth credentials${NC}"
        echo -e "     ${GRAY}Visit: https://github.com/settings/developers${NC}"
    else
        echo -e "  ${BLUE}ℹ️  .env.local already exists${NC}"
    fi
    echo ""
fi

# Select compose file
COMPOSE_FILE="docker-compose.yml"
if [ "$USE_DOCKERHUB" = true ]; then
    COMPOSE_FILE="docker-compose.dockerhub.yml"
    echo -e "  ${YELLOW}Using Docker Hub images${NC}"
else
    echo -e "  ${GREEN}Using GHCR images (better for China)${NC}"
fi
echo ""

# Start containers
echo -e "${CYAN}🐳 Starting containers...${NC}"
if [ "$CONTAINER_TOOL" = "podman" ]; then
    podman-compose -f "$COMPOSE_FILE" up -d
else
    docker-compose -f "$COMPOSE_FILE" up -d
fi
echo -e "  ${GREEN}✓ Containers started${NC}"
echo ""

# Wait for database
echo -e "${CYAN}⏳ Waiting for PostgreSQL to be ready...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if $CONTAINER_TOOL exec m3w-postgres pg_isready -U postgres &> /dev/null; then
        echo -e "  ${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "  ${RED}✗ PostgreSQL failed to start${NC}"
    exit 1
fi
echo ""

# Run Prisma migrations
echo -e "${CYAN}🗄️  Running database migrations...${NC}"
npx prisma generate
if npx prisma migrate dev --name init; then
    echo -e "  ${GREEN}✓ Migrations completed${NC}"
else
    echo -e "  ${YELLOW}⚠️  Migration failed - this is normal for first run${NC}"
fi
echo ""

# Success message
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "  ${NC}1. Edit .env.local and add GitHub OAuth credentials${NC}"
echo -e "  ${NC}2. Run: npm run dev${NC}"
echo -e "  ${NC}3. Visit: http://localhost:3000${NC}"
echo ""
echo -e "${CYAN}Useful commands:${NC}"
echo -e "  ${NC}npm run dev              - Start development server${NC}"
echo -e "  ${NC}npm run db:studio        - Open Prisma Studio${NC}"
echo -e "  ${NC}npm run podman:down      - Stop containers${NC}"
echo -e "  ${NC}npm run podman:logs      - View container logs${NC}"
echo ""
