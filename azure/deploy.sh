#!/bin/bash
# M3W Azure Deployment Script
# Single-environment deployment with auto-scaling and rollback support

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESOURCE_GROUP="m3w-rg"
LOCATION="eastasia"
APP_NAME="m3w-app"
BICEP_FILE="${SCRIPT_DIR}/main.bicep"
PARAM_FILE="${SCRIPT_DIR}/parameters.json"

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

check_az_cli() {
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI not installed"
        print_info "Install: brew install azure-cli"
        exit 1
    fi
}

check_login() {
    print_info "Checking Azure login..."
    if ! az account show &> /dev/null; then
        print_warning "Not logged in"
        az login
    fi
    
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
    print_info "Subscription: $SUBSCRIPTION_NAME"
}

create_infrastructure() {
    print_step "Creating Azure infrastructure..."
    
    # Create resource group
    print_info "Creating resource group: $RESOURCE_GROUP"
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
    
    # Deploy Bicep template
    print_info "Deploying resources (10-15 minutes)..."
    DEPLOYMENT_NAME="m3w-deploy-$(date +%Y%m%d-%H%M%S)"
    
    az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file "$BICEP_FILE" \
        --parameters "@${PARAM_FILE}" \
        --name "$DEPLOYMENT_NAME" \
        --output none
    
    print_info "✅ Infrastructure created successfully!"
    
    # Show outputs
    print_step "Deployment Outputs:"
    az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs \
        --output json
}

build_and_push() {
    print_step "Building and pushing Docker image..."
    
    # Get ACR details
    ACR_NAME=$(az acr list --resource-group "$RESOURCE_GROUP" --query '[0].name' -o tsv)
    ACR_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
    
    print_info "Registry: $ACR_SERVER"
    
    # Login to ACR
    az acr login --name "$ACR_NAME"
    
    # Build
    TAG="${1:-$(git rev-parse --short HEAD)}"
    IMAGE="${ACR_SERVER}/m3w:${TAG}"
    
    print_info "Building: $IMAGE"
    docker build -t "$IMAGE" -f "${PROJECT_ROOT}/docker/Dockerfile" "$PROJECT_ROOT"
    
    # Push
    print_info "Pushing image..."
    docker push "$IMAGE"
    
    # Tag as latest
    docker tag "$IMAGE" "${ACR_SERVER}/m3w:latest"
    docker push "${ACR_SERVER}/m3w:latest"
    
    print_info "✅ Image pushed: $TAG"
}

run_migrations() {
    print_step "Running database migrations..."
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not set"
        print_info "Export it first: export DATABASE_URL='postgresql://...'"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    npm run db:migrate:deploy
    
    print_info "✅ Migrations completed"
}

deploy_app() {
    print_step "Deploying application..."
    
    TAG="${1:-latest}"
    ACR_NAME=$(az acr list --resource-group "$RESOURCE_GROUP" --query '[0].name' -o tsv)
    ACR_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
    IMAGE="${ACR_SERVER}/m3w:${TAG}"
    
    print_info "Deploying: $IMAGE"
    
    az containerapp update \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$IMAGE" \
        --output none
    
    # Get URL
    APP_URL=$(az containerapp show \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query properties.configuration.ingress.fqdn -o tsv)
    
    print_info "✅ Deployed to: https://$APP_URL"
}

list_revisions() {
    print_step "Container App Revisions:"
    az containerapp revision list \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "[].{Name:name, Active:properties.active, Traffic:properties.trafficWeight, Created:properties.createdTime}" \
        --output table
}

rollback() {
    print_step "Rolling back to previous revision..."
    
    # Get previous active revision
    PREV_REVISION=$(az containerapp revision list \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "[?properties.active==\`true\`] | [1].name" \
        --output tsv)
    
    if [ -z "$PREV_REVISION" ]; then
        print_error "No previous revision found"
        list_revisions
        exit 1
    fi
    
    print_warning "Rolling back to: $PREV_REVISION"
    read -p "Continue? (yes/no): " confirm
    
    if [ "$confirm" == "yes" ]; then
        az containerapp revision activate \
            --name "$APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --revision "$PREV_REVISION" \
            --output none
        
        print_info "✅ Rollback completed"
    else
        print_info "Rollback cancelled"
    fi
}

show_logs() {
    print_step "Streaming logs (Ctrl+C to exit)..."
    az containerapp logs show \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --follow
}

show_cost() {
    print_step "Cost Analysis:"
    
    START_DATE=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d "30 days ago" +%Y-%m-%d)
    END_DATE=$(date +%Y-%m-%d)
    
    az consumption usage list \
        --start-date "$START_DATE" \
        --end-date "$END_DATE" \
        --query "[?contains(instanceName, 'm3w')].{Service:instanceName, Cost:pretaxCost, Currency:currency}" \
        --output table
}

show_status() {
    print_step "Application Status:"
    
    APP_URL=$(az containerapp show \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query properties.configuration.ingress.fqdn -o tsv)
    
    REPLICAS=$(az containerapp replica list \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "length([])" -o tsv)
    
    echo "URL: https://$APP_URL"
    echo "Active Replicas: $REPLICAS"
    echo ""
    
    list_revisions
}

get_secrets() {
    print_step "Connection Strings & Secrets:"
    
    DEPLOYMENT=$(az deployment group list \
        --resource-group "$RESOURCE_GROUP" \
        --query "[0].name" -o tsv)
    
    if [ -z "$DEPLOYMENT" ]; then
        print_error "No deployment found"
        exit 1
    fi
    
    az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT" \
        --query properties.outputs \
        --output json | jq -r '
            "Container App URL: " + .containerAppUrl.value,
            "Registry Server: " + .containerRegistryLoginServer.value,
            "Registry Username: " + .containerRegistryUsername.value,
            "Registry Password: " + .containerRegistryPassword.value[:20] + "...",
            "PostgreSQL Server: " + .postgresServerFqdn.value,
            "Storage Account: " + .storageAccountName.value,
            "",
            "Export these for local use:",
            "export DATABASE_URL=\"" + .databaseUrl.value + "\"",
            "export AZURE_REGISTRY_LOGIN_SERVER=\"" + .containerRegistryLoginServer.value + "\"",
            "export AZURE_REGISTRY_USERNAME=\"" + .containerRegistryUsername.value + "\"",
            "export AZURE_REGISTRY_PASSWORD=\"" + .containerRegistryPassword.value + "\""
        '
}

cleanup() {
    print_warning "⚠️  This will DELETE all resources in $RESOURCE_GROUP!"
    print_warning "This action CANNOT be undone!"
    echo ""
    read -p "Type 'DELETE' to confirm: " confirm
    
    if [ "$confirm" == "DELETE" ]; then
        print_info "Deleting resource group..."
        az group delete --name "$RESOURCE_GROUP" --yes --no-wait
        print_info "✅ Deletion started (running in background)"
    else
        print_info "Cleanup cancelled"
    fi
}

show_help() {
    cat << EOF
${BLUE}M3W Azure Deployment${NC}

${GREEN}Infrastructure Commands:${NC}
  create           Create all Azure resources
  secrets          Show connection strings and credentials
  cleanup          Delete all resources

${GREEN}Application Commands:${NC}
  build [tag]      Build and push Docker image
  migrate          Run database migrations
  deploy [tag]     Deploy application to Container Apps
  full [tag]       Build + Migrate + Deploy (complete deployment)

${GREEN}Management Commands:${NC}
  revisions        List all revisions
  rollback         Rollback to previous revision
  logs             Stream application logs
  status           Show application status
  cost             Show cost breakdown

${GREEN}Examples:${NC}
  ./deploy.sh create
  ./deploy.sh full v1.0.0
  ./deploy.sh rollback
  ./deploy.sh logs
  ./deploy-budget.sh logs

${YELLOW}Prerequisites:${NC}
  - Azure CLI installed (brew install azure-cli)
  - Logged in to Azure (az login)
  - Docker installed

${YELLOW}Environment Variables:${NC}
  DATABASE_URL     Required for migrations

EOF
}

# Main
case "${1:-help}" in
    create)
        check_az_cli
        check_login
        create_infrastructure
        get_secrets
        ;;
    build)
        check_az_cli
        check_login
        build_and_push "${2:-latest}"
        ;;
    migrate)
        run_migrations
        ;;
    deploy)
        check_az_cli
        check_login
        deploy_app "${2:-latest}"
        ;;
    full)
        check_az_cli
        check_login
        build_and_push "${2:-latest}"
        run_migrations
        deploy_app "${2:-latest}"
        show_status
        ;;
    revisions)
        check_az_cli
        check_login
        list_revisions
        ;;
    rollback)
        check_az_cli
        check_login
        rollback
        ;;
    logs)
        check_az_cli
        check_login
        show_logs
        ;;
    status)
        check_az_cli
        check_login
        show_status
        ;;
    cost)
        check_az_cli
        check_login
        show_cost
        ;;
    secrets)
        check_az_cli
        check_login
        get_secrets
        ;;
    cleanup)
        check_az_cli
        check_login
        cleanup
        ;;
    help|*)
        show_help
        ;;
esac
