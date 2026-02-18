# Generalized CORS Proxy Cloudflare Worker

A configurable CORS proxy Cloudflare Worker that can forward requests to any target endpoint while adding the necessary CORS headers. This worker solves CORS issues by acting as a proxy between your frontend application and backend APIs that don't support CORS.

## ✨ Features

- **🔧 Fully Configurable**: All settings via environment variables/secrets
- **🎯 Wildcard Path Matching**: Support for patterns like `/api/*` and `/auth/*/callback`
- **🌐 Multiple Origin Support**: Allow requests from multiple domains
- **🔀 Dynamic HTTP Methods**: Automatically handles all HTTP methods based on request headers
- **📦 Payload Override**: Optional feature to replace response body for non-CORS endpoints
- **🚀 Multi-Environment**: Support for development, staging, and production deployments
- **⚡ GitHub Actions Integration**: Automated deployment with secret management

## 📋 Configuration

### Required Environment Variables/Secrets

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `TARGET_ENDPOINT` | Secret | The backend endpoint to proxy to | `https://api.example.com` |
| `ALLOWED_ORIGINS` | Secret | JSON array of allowed origins | `["https://myapp.com", "https://dev.myapp.com"]` |
| `ALLOWED_PATHS` | Secret | JSON array of path patterns | `["/api/*", "/auth", "/webhook/*"]` |

### Optional Environment Variables/Secrets

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PAYLOAD_OVERRIDE` | Secret | `null` | Override response payload for endpoints without CORS |
| `CORS_MAX_AGE` | Variable | `86400` | Cache duration for preflight requests (seconds) |
| `ADDITIONAL_HEADERS` | Secret | `{}` | JSON object for extra CORS headers |

## 🛠 Setup Instructions

### Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Cloudflare API Token**: Create with "Edit Cloudflare Workers" permissions
3. **Node.js**: Version 18 or higher
4. **Wrangler CLI**: Install globally with `npm install -g wrangler`

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd cors-proxy-cloudflare-worker
   ```

2. **Install dependencies**:
   ```bash
   npm install -g wrangler
   ```

3. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

4. **Set your secrets locally**:
   ```bash
   # Required secrets
   wrangler secret put TARGET_ENDPOINT
   wrangler secret put ALLOWED_ORIGINS
   wrangler secret put ALLOWED_PATHS
   
   # Optional secrets
   wrangler secret put PAYLOAD_OVERRIDE
   wrangler secret put ADDITIONAL_HEADERS
   ```

5. **Test locally**:
   ```bash
   wrangler dev
   ```

6. **Deploy manually**:
   ```bash
   # Deploy to development
   wrangler deploy --env development
   
   # Deploy to production
   wrangler deploy --env production
   ```

## 🚀 GitHub Actions Deployment

### 1. GitHub Secrets Setup

Add the following secrets to your GitHub repository (`Settings` → `Secrets and variables` → `Actions`):

#### Required Secrets
```
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
TARGET_ENDPOINT=https://your-api.example.com
ALLOWED_ORIGINS=["https://yourapp.com", "https://dev.yourapp.com"]
ALLOWED_PATHS=["/api/*", "/auth", "/federation"]
```

#### Optional Secrets
```
CLOUDFLARE_WORKER_NAME=my-cors-proxy
PAYLOAD_OVERRIDE={"message": "CORS proxy active"}
CORS_MAX_AGE=3600
ADDITIONAL_HEADERS={"X-Custom-Header": "value"}
```

### 2. Deployment Triggers

The workflow automatically deploys based on:

- **Push to `main`** → Production environment
- **Push to `staging`** → Staging environment  
- **Push to `develop`** → Development environment
- **Manual trigger** → Choose environment

### 3. Manual Deployment

You can trigger manual deployments from the GitHub Actions tab:

1. Go to your repository's `Actions` tab
2. Select "Deploy CORS Proxy Worker"
3. Click "Run workflow"
4. Choose your target environment
5. Click "Run workflow"

## 📖 Configuration Examples

### Basic CORS Proxy

```javascript
// Environment configuration
TARGET_ENDPOINT = "https://api.example.com"
ALLOWED_ORIGINS = ["https://myapp.com"]
ALLOWED_PATHS = ["/api/*"]
```

### AWS Federation Proxy (Original Use Case)

```javascript
TARGET_ENDPOINT = "https://signin.aws.amazon.com/federation"
ALLOWED_ORIGINS = ["https://myapp.github.io", "https://localhost:3000"]
ALLOWED_PATHS = ["/federation"]
```

### Multi-Service API Gateway

```javascript
TARGET_ENDPOINT = "https://gateway.example.com"
ALLOWED_ORIGINS = [
  "https://app.example.com",
  "https://admin.example.com", 
  "https://staging.example.com"
]
ALLOWED_PATHS = [
  "/api/v1/*",
  "/api/v2/*", 
  "/auth/*",
  "/webhooks/stripe",
  "/health"
]
```

### With Payload Override

```javascript
TARGET_ENDPOINT = "https://legacy-api.example.com"
ALLOWED_ORIGINS = ["https://newapp.com"]
ALLOWED_PATHS = ["/legacy/*"]
PAYLOAD_OVERRIDE = '{"message": "Request processed via CORS proxy"}'
```

### With Custom Headers

```javascript
TARGET_ENDPOINT = "https://api.example.com"
ALLOWED_ORIGINS = ["https://app.com"]
ALLOWED_PATHS = ["/api/*"]
ADDITIONAL_HEADERS = {
  "X-Proxy-Version": "1.0",
  "X-Custom-Header": "cors-proxy"
}
CORS_MAX_AGE = 7200
```

## 🎯 Path Matching Examples

The worker supports simple wildcard patterns:

| Pattern | Matches | Doesn't Match |
|---------|---------|---------------|
| `/api/*` | `/api/users`, `/api/posts` | `/api`, `/api/v1/users` |
| `/auth/*/callback` | `/auth/google/callback`, `/auth/github/callback` | `/auth/callback`, `/auth/google/token` |
| `/exact/path` | `/exact/path` only | `/exact/path/more` |
| `/*` | Any single-level path | Multi-level paths |

## 🔧 Usage Examples

### Frontend JavaScript

```javascript
// Before (CORS error)
fetch('https://api.example.com/data')
  .then(response => response.json())
  .catch(error => console.error('CORS Error:', error));

// After (using CORS proxy)
fetch('https://your-worker.workers.dev/api/data')
  .then(response => response.json())
  .then(data => console.log('Success:', data));
```

### With Custom Headers

```javascript
fetch('https://your-worker.workers.dev/api/secure', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token123'
  },
  body: JSON.stringify({ key: 'value' })
});
```

## 🐛 Troubleshooting

### Common Issues

1. **404 Errors**
   - Check that your request path matches one of the `ALLOWED_PATHS` patterns
   - Verify wildcard patterns are correct (`/api/*` not `/api/**`)

2. **CORS Still Blocked**
   - Ensure the request origin is listed in `ALLOWED_ORIGINS`
   - Check that origins match exactly (including protocol and port)

3. **Deployment Failures**
   - Verify all required GitHub secrets are set
   - Check Cloudflare API token has correct permissions
   - Ensure `CLOUDFLARE_ACCOUNT_ID` is correct

4. **Secret Setting Errors**
   - Make sure JSON arrays/objects are properly formatted
   - Check for trailing commas in JSON configuration

### Debug Mode

Enable debug logging by adding console logs to your worker:

```javascript
// Add to worker.js for debugging
console.log('Request path:', url.pathname);
console.log('Allowed paths:', config.allowedPaths);
console.log('Origin:', request.headers.get('Origin'));
console.log('Allowed origins:', config.allowedOrigins);
```

## 📁 Project Structure

```
cors-proxy-cloudflare-worker/
├── worker.js                 # Main worker code
├── wrangler.toml             # Wrangler configuration
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions workflow
├── README.md                 # This file
└── package.json              # Optional: if you have dependencies
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## 💡 Tips

- Use the development environment for testing configuration changes
- Monitor worker logs in the Cloudflare dashboard for debugging
- Set up multiple workers for different services/environments
- Consider using custom domains for production deployments
- Regular backup of your configuration as JSON files

---

🚀 **Ready to deploy?** Follow the setup instructions above and start proxying those CORS-blocked requests!