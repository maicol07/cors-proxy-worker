# Troubleshooting Guide

## Common Issues and Solutions

### 1. GLIBC Compatibility Issue with `wrangler dev`

**Problem**: 
```
ERROR: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.32' not found
```

**Cause**: The workerd binary requires GLIBC 2.32+ but the system has an older version.

**Solutions**:

#### Option A: Use Remote Development (Recommended)
```bash
# Deploy to a preview environment instead of local development
npx wrangler deploy --env development
```

#### Option B: Use Docker for Local Development
```bash
# Create a simple Docker setup
docker run -it --rm -v $(pwd):/app -w /app node:18-bullseye bash
npm install
npx wrangler dev
```

#### Option C: Use GitHub Codespaces/GitPod
- GitHub Codespaces and GitPod have newer GLIBC versions
- Open the repository in Codespaces for seamless development

#### Option D: System Update (if possible)
```bash
# Update to Ubuntu 22.04+ or similar for GLIBC 2.32+
```

### 2. Missing Environment Variables

**Problem**: Worker returns "Configuration Error"

**Solution**: Ensure all required environment variables are set:

#### For Local Development (.dev.vars):
```env
TARGET_ENDPOINT=https://httpbin.org
ALLOWED_ORIGINS=["http://localhost:3000"]
ALLOWED_PATHS=["/get", "/post", "/api/*"]
```

#### For Production (Cloudflare Secrets):
```bash
echo "https://api.example.com" | npx wrangler secret put TARGET_ENDPOINT
echo '["https://myapp.com"]' | npx wrangler secret put ALLOWED_ORIGINS
echo '["/api/*"]' | npx wrangler secret put ALLOWED_PATHS
```

### 3. Path Matching Issues

**Problem**: Getting 404 errors for valid paths

**Common Issues**:
- Path patterns don't match: `/api/*` matches `/api/users` but not `/api/v1/users`
- Missing leading slash: use `/api/*` not `api/*`
- Case sensitivity: `/API/*` doesn't match `/api/users`

**Examples**:
```javascript
// Correct patterns
["/api/*"]          // Matches: /api/users, /api/posts
["/auth/*/callback"] // Matches: /auth/google/callback
["/exact/path"]     // Matches: /exact/path only

// Common mistakes
["api/*"]           // Missing leading slash
["/api/**"]         // Double asterisk not supported
["/API/*"]          // Wrong case
```

### 4. CORS Still Blocked

**Problem**: CORS errors even with the proxy

**Check These**:
1. **Origin Matching**: Ensure the request origin is in `ALLOWED_ORIGINS`
   ```javascript
   // Request from https://myapp.com
   ALLOWED_ORIGINS = ["https://myapp.com"] // ✅ Correct
   ALLOWED_ORIGINS = ["http://myapp.com"]  // ❌ Wrong protocol
   ALLOWED_ORIGINS = ["myapp.com"]         // ❌ Missing protocol
   ```

2. **Request URL**: Ensure you're calling the worker URL, not the original API
   ```javascript
   // Wrong
   fetch('https://api.example.com/data')
   
   // Correct
   fetch('https://your-worker.workers.dev/data')
   ```

### 5. GitHub Actions Deployment Failures

**Problem**: Deployment fails in CI/CD

**Common Issues**:

#### Missing Secrets
```
ERROR: CLOUDFLARE_API_TOKEN not found
```
**Solution**: Add all required secrets in GitHub repository settings:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` 
- `TARGET_ENDPOINT`
- `ALLOWED_ORIGINS`
- `ALLOWED_PATHS`

#### Invalid JSON in Secrets
```
ERROR: Invalid JSON in ALLOWED_ORIGINS
```
**Solution**: Ensure proper JSON formatting:
```json
["https://app.com", "https://admin.com"]
```

#### API Token Permissions
**Solution**: Ensure the API token has "Edit Cloudflare Workers" permissions.

### 6. Testing the Worker

#### Quick Test with curl
```bash
# Test a simple endpoint
curl -H "Origin: https://example.com" \
     https://your-worker.workers.dev/api/test

# Test with different methods
curl -X POST -H "Origin: https://example.com" \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}' \
     https://your-worker.workers.dev/api/data
```

#### Browser Testing
```javascript
// Open browser console and test
fetch('https://your-worker.workers.dev/api/test', {
  method: 'GET',
  headers: {
    'Origin': 'https://example.com'
  }
}).then(r => r.text()).then(console.log);
```

### 7. Worker Not Responding

**Check These**:
1. **Deployment Status**: Verify the worker deployed successfully
2. **Route Configuration**: Check if custom domains are configured correctly
3. **Worker Logs**: Use `wrangler tail` to see real-time logs
4. **Configuration Errors**: Check for typos in environment variables

### 8. Performance Issues

**Problem**: Slow response times

**Solutions**:
- Use `CORS_MAX_AGE` to cache preflight requests
- Keep `ALLOWED_PATHS` specific to avoid unnecessary processing
- Consider using `PAYLOAD_OVERRIDE` for simple responses

## Development Workflow

### Recommended Development Process
1. **Local Development**: Use `.dev.vars` for configuration
2. **Testing**: Deploy to development environment
3. **Staging**: Test with production-like data
4. **Production**: Deploy via GitHub Actions

### Environment Management
```bash
# Development
npx wrangler deploy --env development

# Staging  
npx wrangler deploy --env staging

# Production
npx wrangler deploy --env production
```

## Getting Help

1. **Check Logs**: `npx wrangler tail` for real-time debugging
2. **Validate Configuration**: Ensure all environment variables are set correctly
3. **Test Locally**: Use the provided `.dev.vars` template
4. **GitHub Issues**: Report bugs or request features

## Useful Commands

```bash
# Check current configuration
npx wrangler whoami

# List secrets
npx wrangler secret list

# View logs
npx wrangler tail

# Deploy specific environment
npx wrangler deploy --env production

# Test configuration
npx wrangler dev --local # (if GLIBC compatible)