#!/bin/bash
# M3W Azure Deployment Script
# This script helps manage Azure infrastructure and application deployments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESOURCE_GROUP="m3w-rg"
LOCATION="eastasia"
BICEP_FILE="${SCRIPT_DIR}/main.bicep"

# Functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_az_cli() {
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first:"
        print_info "macOS: brew install azure-cli"
        print_info "Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
        exit 1
    fi
    print_info "Azure CLI version: $(az --version | head -n 1)"
}

check_login() {
    print_info "Checking Azure login status..."
    if ! az account show &> /dev/null; then
        print_warning "Not logged in to Azure. Starting login..."
        az login
    fi
    
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
    print_info "Using subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
}

create_resource_group() {
    local env=${1:-production}
    local rg_name="${RESOURCE_GROUP}"
    
    if [ "$env" != "production" ]; then
        rg_name="${RESOURCE_GROUP}-${env}"
    fi
    
    print_info "Creating resource group: $rg_name"
    
    if az group show --name "$rg_name" &> /dev/null; then
        print_warning "Resource group $rg_name already exists"
    else
        az group create --name "$rg_name" --location "$LOCATION"
        print_info "Resource group created successfully"
    fi
}

deploy_infrastructure() {
    local env=${1:-production}
    local rg_name="${RESOURCE_GROUP}"
    local param_file="${SCRIPT_DIR}/parameters.json"
    
    if [ "$env" != "production" ]; then
        rg_name="${RESOURCE_GROUP}-${env}"
        param_file="${SCRIPT_DIR}/parameters.${env}.json"
    fi
    
    print_info "Deploying infrastructure to $rg_name environment..."
    
    # Check if parameter file exists
    if [ ! -f "$param_file" ]; then
        print_error "Parameter file not found: $param_file"
        exit 1
    fi
    
    # Validate Bicep template
    print_info "Validating Bicep template..."
    az deployment group validate \
        --resource-group "$rg_name" \
        --template-file "$BICEP_FILE" \
        --parameters "@${param_file}"
    
    # Deploy infrastructure
    print_info "Starting deployment (this may take 10-15 minutes)..."
    az deployment group create \
        --resource-group "$rg_name" \
        --template-file "$BICEP_FILE" \
        --parameters "@${param_file}" \
        --name "m3w-deployment-$(date +%Y%m%d-%H%M%S)"
    
    print_info "Infrastructure deployment completed successfully!"
    
    # Get outputs
    print_info "Deployment outputs:"
    az deployment group show \
        --resource-group "$rg_name" \
        --name "$(az deployment group list --resource-group "$rg_name" --query '[0].name' -o tsv)" \
        --query properties.outputs
}

build_and_push_image() {
    local env=${1:-production}
    local tag=${2:-latest}
    
    print_info "Building and pushing Docker image..."
    
    # Get ACR login server
    local acr_name=$(az acr list --resource-group "$RESOURCE_GROUP" --query '[0].name' -o tsv)
    local acr_server=$(az acr show --name "$acr_name" --query loginServer -o tsv)
    
    print_info "Container Registry: $acr_server"
    
    # Login to ACR
    print_info "Logging in to Azure Container Registry..."
    az acr login --name "$acr_name"
    
    # Build and push
    print_info "Building Docker image..."
    docker build -t "${acr_server}/m3w:${tag}" -f "${PROJECT_ROOT}/docker/Dockerfile" "$PROJECT_ROOT"
    
    print_info "Pushing image to registry..."
    docker push "${acr_server}/m3w:${tag}"
    
    # Also tag as latest for production
    if [ "$env" == "production" ]; then
        docker tag "${acr_server}/m3w:${tag}" "${acr_server}/m3w:latest"
        docker push "${acr_server}/m3w:latest"
    fi
    
    print_info "Image pushed successfully: ${acr_server}/m3w:${tag}"
}

run_migrations() {
    local env=${1:-production}
    
    print_info "Running database migrations..."
    
    # This should be run with proper DATABASE_URL from secrets
    print_warning "Make sure DATABASE_URL is set in your environment"
    
    cd "$PROJECT_ROOT"
    npm run db:migrate:deploy
    
    print_info "Migrations completed successfully"
}

deploy_app() {
    local env=${1:-production}
    local tag=${2:-latest}
    local rg_name="${RESOURCE_GROUP}"
    
    if [ "$env" != "production" ]; then
        rg_name="${RESOURCE_GROUP}-${env}"
    fi
    
    local app_name="m3w-app-${env}"
    local acr_name=$(az acr list --resource-group "$RESOURCE_GROUP" --query '[0].name' -o tsv)
    local acr_server=$(az acr show --name "$acr_name" --query loginServer -o tsv)
    local image="${acr_server}/m3w:${tag}"
    
    print_info "Deploying application to Container Apps..."
    print_info "Image: $image"
    
    az containerapp update \
        --name "$app_name" \
        --resource-group "$rg_name" \
        --image "$image" \
        --revision-suffix "$(date +%Y%m%d-%H%M%S)"
    
    print_info "Application deployed successfully!"
    
    # Get app URL
    local app_url=$(az containerapp show \
        --name "$app_name" \
        --resource-group "$rg_name" \
        --query properties.configuration.ingress.fqdn -o tsv)
    
    print_info "Application URL: https://$app_url"
}

show_logs() {
    local env=${1:-production}
    local rg_name="${RESOURCE_GROUP}"
    
    if [ "$env" != "production" ]; then
        rg_name="${RESOURCE_GROUP}-${env}"
    fi
    
    local app_name="m3w-app-${env}"
    
    print_info "Fetching logs from $app_name..."
    az containerapp logs show \
        --name "$app_name" \
        --resource-group "$rg_name" \
        --follow
}

get_secrets() {
    local env=${1:-production}
    local rg_name="${RESOURCE_GROUP}"
    
    if [ "$env" != "production" ]; then
        rg_name="${RESOURCE_GROUP}-${env}"
    fi
    
    print_info "Retrieving connection strings and secrets..."
    
    # PostgreSQL
    local postgres_server=$(az postgres flexible-server list \
        --resource-group "$rg_name" \
        --query '[0].fullyQualifiedDomainName' -o tsv)
    print_info "PostgreSQL Server: $postgres_server"
    
    # Redis
    local redis_name=$(az redis list \
        --resource-group "$rg_name" \
        --query '[0].name' -o tsv)
    local redis_key=$(az redis list-keys \
        --name "$redis_name" \
        --resource-group "$rg_name" \
        --query primaryKey -o tsv)
    local redis_host=$(az redis show \
        --name "$redis_name" \
        --resource-group "$rg_name" \
        --query hostName -o tsv)
    print_info "Redis URL: rediss://:${redis_key:0:10}...@$redis_host:6380"
    
    # Storage
    local storage_name=$(az storage account list \
        --resource-group "$rg_name" \
        --query '[0].name' -o tsv)
    local storage_key=$(az storage account keys list \
        --account-name "$storage_name" \
        --resource-group "$rg_name" \
        --query '[0].value' -o tsv)
    print_info "Storage Account: $storage_name"
    
    # Container Registry
    local acr_name=$(az acr list \
        --resource-group "$rg_name" \
        --query '[0].name' -o tsv)
    local acr_server=$(az acr show \
        --name "$acr_name" \
        --query loginServer -o tsv)
    print_info "Container Registry: $acr_server"
}

cleanup() {
    local env=${1:-production}
    local rg_name="${RESOURCE_GROUP}"
    
    if [ "$env" != "production" ]; then
        rg_name="${RESOURCE_GROUP}-${env}"
    fi
    
    print_warning "This will DELETE all resources in $rg_name!"
    read -p "Are you sure? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" == "yes" ]; then
        print_info "Deleting resource group $rg_name..."
        az group delete --name "$rg_name" --yes --no-wait
        print_info "Deletion started. Resources will be removed in the background."
    else
        print_info "Cleanup cancelled"
    fi
}

# Main menu
show_help() {
    cat << EOF
M3W Azure Deployment Script

Usage: ./deploy.sh [command] [options]

Commands:
    setup [env]              - Create resource group (default: production)
    create-infra [env]       - Deploy all Azure infrastructure
    build-image [env] [tag]  - Build and push Docker image
    migrate [env]            - Run database migrations
    deploy-app [env] [tag]   - Deploy application to Container Apps
    logs [env]               - Stream application logs
    secrets [env]            - Show connection strings and secrets
    full-deploy [env] [tag]  - Run complete deployment (build + migrate + deploy)
    cleanup [env]            - Delete all resources (WARNING: destructive!)
    help                     - Show this help message

Environments:
    production  (default)
    staging
    development

Examples:
    ./deploy.sh setup production
    ./deploy.sh create-infra production
    ./deploy.sh build-image production v1.0.0
    ./deploy.sh deploy-app staging latest
    ./deploy.sh logs production

EOF
}

# Main script execution
case "${1:-help}" in
    setup)
        check_az_cli
        check_login
        create_resource_group "${2:-production}"
        ;;
    create-infra)
        check_az_cli
        check_login
        create_resource_group "${2:-production}"
        deploy_infrastructure "${2:-production}"
        get_secrets "${2:-production}"
        ;;
    build-image)
        check_az_cli
        check_login
        build_and_push_image "${2:-production}" "${3:-latest}"
        ;;
    migrate)
        run_migrations "${2:-production}"
        ;;
    deploy-app)
        check_az_cli
        check_login
        deploy_app "${2:-production}" "${3:-latest}"
        ;;
    logs)
        check_az_cli
        check_login
        show_logs "${2:-production}"
        ;;
    secrets)
        check_az_cli
        check_login
        get_secrets "${2:-production}"
        ;;
    full-deploy)
        check_az_cli
        check_login
        build_and_push_image "${2:-production}" "${3:-latest}"
        run_migrations "${2:-production}"
        deploy_app "${2:-production}" "${3:-latest}"
        ;;
    cleanup)
        check_az_cli
        check_login
        cleanup "${2:-production}"
        ;;
    help|*)
        show_help
        ;;
esac
