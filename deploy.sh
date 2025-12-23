#!/bin/bash

# ===========================================
# SAT Backend - Production Deployment Script
# ===========================================

set -e

echo "🚀 SAT Backend Deployment Script"
echo "================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_info "Copy .env.example to .env and configure it first:"
    echo "    cp .env.example .env"
    exit 1
fi

print_success ".env file found"

# Check if required environment variables are set
required_vars=("DATABASE_URL" "CLERK_SECRET_KEY" "CLERK_PUBLISHABLE_KEY" "PORT")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=.*YOUR_.*_HERE" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing or invalid environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "    - $var"
    done
    exit 1
fi

print_success "Environment variables validated"

# Install dependencies
echo ""
print_info "Installing dependencies..."
npm ci --production=false

print_success "Dependencies installed"

# Generate Prisma Client
echo ""
print_info "Generating Prisma Client..."
npx prisma generate

print_success "Prisma Client generated"

# Run database migrations
echo ""
read -p "Run database migrations? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Running database migrations..."
    npx prisma migrate deploy
    print_success "Database migrations completed"
else
    print_warning "Skipped database migrations"
fi

# Build TypeScript
echo ""
print_info "Building TypeScript..."
npm run build

if [ $? -eq 0 ]; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    exit 1
fi

# Check if dist folder exists
if [ ! -d "dist" ]; then
    print_error "dist folder not found after build"
    exit 1
fi

print_success "Build artifacts verified"

# Verify server entry point
if [ ! -f "dist/server.js" ]; then
    print_error "dist/server.js not found"
    exit 1
fi

print_success "Server entry point verified"

echo ""
echo "================================="
print_success "Deployment preparation complete!"
echo "================================="
echo ""

# Show deployment options
echo "Choose deployment method:"
echo ""
echo "1. Start with Node.js (production)"
echo "   npm start"
echo ""
echo "2. Start with PM2 (recommended)"
echo "   pm2 start dist/server.js --name sat-backend"
echo ""
echo "3. Build Docker image"
echo "   docker build -t sat-backend:latest ."
echo ""
echo "4. Deploy with Docker Compose"
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""

read -p "Do you want to start the server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Starting server..."
    npm start
else
    print_info "You can start the server manually using one of the methods above"
fi
