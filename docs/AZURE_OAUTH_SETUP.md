# Azure Deployment OAuth Setup

## GitHub OAuth Configuration

### Current Deployment
- **Application URL**: https://m3w-app.politeforest-7085a748.eastasia.azurecontainerapps.io
- **GitHub OAuth Client ID**: Ov23lijFuDC0ritlJbn9

### Setup Steps

1. **Update GitHub OAuth App**
   - Go to: https://github.com/settings/developers
   - Select your OAuth App
   - Add the following to **Authorization callback URLs**:
     ```
     https://m3w-app.politeforest-7085a748.eastasia.azurecontainerapps.io/api/auth/callback/github
     ```
   - Click **Update application**

2. **Verify Environment Variables** (Already configured ✅)
   - NEXTAUTH_URL: `https://m3w-app.politeforest-7085a748.eastasia.azurecontainerapps.io`
   - NEXTAUTH_SECRET: ✅ Set
   - GITHUB_CLIENT_ID: ✅ Set
   - GITHUB_CLIENT_SECRET: ✅ Set

3. **Test Login**
   - Visit: https://m3w-app.politeforest-7085a748.eastasia.azurecontainerapps.io
   - Click "Sign in with GitHub"
   - Authorize the application
   - You should be redirected to the dashboard

## Troubleshooting

### Issue: "Redirect URI mismatch"
- Ensure the callback URL in GitHub matches exactly (including https://)
- Check for trailing slashes

### Issue: "Application error"
- Check Container App logs: `./azure/deploy.sh logs`
- Verify environment variables are set correctly

### Issue: Database connection errors
- Ensure PostgreSQL firewall rules allow Azure services
- Verify DATABASE_URL secret is set correctly

## Security Notes

⚠️ **Production Security Checklist**:
- [ ] Remove AllowAll firewall rule from PostgreSQL
- [ ] Add specific IP ranges or use private endpoints
- [ ] Rotate NEXTAUTH_SECRET regularly
- [ ] Enable Container Apps authentication (optional)
- [ ] Set up custom domain with SSL certificate
- [ ] Configure CORS policies if needed

## Useful Commands

```bash
# Check application status
./azure/deploy.sh status

# View logs
./azure/deploy.sh logs

# Update environment variables
az containerapp update \
  --name m3w-app \
  --resource-group m3w-rg \
  --set-env-vars "KEY=VALUE"

# List all environment variables
az containerapp show \
  --name m3w-app \
  --resource-group m3w-rg \
  --query properties.template.containers[0].env
```
