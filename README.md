# ChittyCloude™ Universal Deployment MCP

A Model Context Protocol (MCP) server that provides universal cloud platform deployment capabilities. Deploy to Cloudflare Workers/Pages, Vercel, Railway, and more with a single interface.

## 🚀 Features

- **Universal Deployment**: Deploy to multiple cloud platforms with consistent interface
- **Real API Integration**: Uses official platform APIs (Cloudflare, Vercel, Railway)
- **Cost Comparison**: Compare costs and performance across platforms
- **Deployment Tracking**: Monitor deployment status and analytics
- **Multi-Platform Analytics**: Get insights across your entire deployment ecosystem

## 🏗️ Supported Platforms

| Platform | Services | Status |
|----------|----------|--------|
| **Cloudflare** | Workers, Pages, R2, KV | ✅ Production Ready |
| **Vercel** | Static Sites, Edge Functions, Serverless | ✅ Production Ready |  
| **Railway** | Full-stack Apps, Databases | ✅ Production Ready |

## 📦 Installation & Setup

### Option 1: Use with Claude Desktop/Code

1. Install the extension:
```bash
claude mcp add chittycloude-mcp -- npx @chittyapps/chittycloude-mcp@latest
```

2. Or add manually to your MCP configuration:
```json
{
  "mcpServers": {
    "chittycloud": {
      "command": "npx",
      "args": ["@chittyapps/chittycloude-mcp@latest"]
    }
  }
}
```

### Option 2: HTTP Mode

1. Start the server:
```bash
MCP_HTTP_MODE=true npx @chittyapps/chittycloude-mcp@latest --http
```

2. Add to your MCP client:
```json
{
  "mcpServers": {
    "chittycloud": {
      "type": "http",
      "url": "http://localhost:3000"
    }
  }
}
```

### Option 3: Development Setup

1. Clone and install:
```bash
git clone <repo-url>
cd chittycloud
npm install
```

2. Run development server:
```bash
npm run dev
```

## 🔧 Authentication Setup

Before deploying, authenticate with your chosen platforms:

### Cloudflare
```
Use the 'authenticate' tool with:
- platform: "cloudflare"
- credentials: {
    "apiToken": "your-cloudflare-api-token",
    "accountId": "your-account-id"
  }
```

Get your credentials:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Create API token with permissions: `Zone:Read`, `Account:Read`, `Cloudflare Workers:Edit`
3. Get Account ID from the right sidebar of any domain

### Vercel
```
Use the 'authenticate' tool with:
- platform: "vercel"  
- credentials: {
    "apiToken": "your-vercel-token"
  }
```

Get your token:
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Create new token with appropriate scopes

### Railway
```
Use the 'authenticate' tool with:
- platform: "railway"
- credentials: {
    "apiToken": "your-railway-token"
  }
```

Get your token:
1. Go to [Railway Account Settings](https://railway.app/account/tokens)
2. Create new token

## 🛠️ Available Tools

### `authenticate`
Authenticate with a cloud platform
```typescript
{
  platform: "cloudflare" | "vercel" | "railway",
  credentials: Record<string, string>
}
```

### `deploy`  
Deploy a project to any platform
```typescript
{
  config: {
    platform: "cloudflare" | "vercel" | "railway",
    projectName: string,
    environment?: "development" | "staging" | "production",
    buildCommand?: string,
    outputDirectory?: string,
    environmentVariables?: Record<string, string>,
    domains?: string[],
    region?: string
  }
}
```

### `deployment-status`
Check deployment status
```typescript
{
  platform: "cloudflare" | "vercel" | "railway", 
  deploymentId: string
}
```

### `cost-compare`
Compare costs across platforms
```typescript
{
  config: {
    projectName: string,
    buildCommand?: string,
    outputDirectory?: string,
    // ... other deployment config without platform
  },
  platforms?: ["cloudflare", "vercel", "railway"] // optional filter
}
```

### `list-deployments`
List all deployments
```typescript
{
  platform?: "cloudflare" | "vercel" | "railway", // optional filter
  limit?: number // default 20, max 100
}
```

### `platform-analytics`
Get detailed analytics for a project
```typescript
{
  projectName: string,
  platforms?: ["cloudflare", "vercel", "railway"] // optional filter
}
```

## 💡 Usage Examples

### Basic Deployment Flow

1. **Authenticate with a platform:**
```
"Authenticate with Cloudflare using my API token abc123 and account ID def456"
```

2. **Deploy your project:**
```
"Deploy my 'portfolio-site' to Cloudflare with build command 'npm run build' and output directory 'dist'"
```

3. **Check deployment status:**
```
"Check the status of my portfolio-site deployment"
```

4. **Compare costs across platforms:**
```
"Compare the cost of deploying my portfolio-site across Cloudflare, Vercel, and Railway"
```

### Advanced Usage

**Multi-platform strategy:**
```
"Deploy my app to Railway for the backend API and Vercel for the frontend, then compare their performance"
```

**Analytics and optimization:**
```
"Show me analytics for my 'ecommerce-app' across all platforms and suggest optimizations"
```

**Team workflows:**
```
"List all deployments from the last week and show me which ones failed"
```

## 📊 Platform-Specific Features

### Cloudflare
- ✅ Workers deployment
- ✅ Pages deployment  
- ✅ Global edge network
- ✅ Environment variables
- ✅ Custom domains
- ⏳ R2 storage integration (coming soon)
- ⏳ KV namespace management (coming soon)

### Vercel
- ✅ Static site deployment
- ✅ Serverless functions
- ✅ Edge functions
- ✅ Environment variables  
- ✅ Custom domains
- ✅ Framework detection
- ✅ Build logs

### Railway
- ✅ Full-stack applications
- ✅ Database services
- ✅ Environment variables
- ✅ Service networking
- ✅ Build logs
- ✅ Resource monitoring

## 🚨 Troubleshooting

### Common Issues

**Authentication Errors:**
- Verify API tokens have correct permissions
- Check account/team IDs are correct
- Ensure tokens haven't expired

**Deployment Failures:**
- Check build commands are correct
- Verify output directory exists after build
- Review platform-specific requirements

**Cost Calculation Issues:**
- Some platforms may not provide real-time usage data
- Costs are estimates based on current pricing
- Free tier usage may show as $0.00

### Debug Mode

Enable detailed logging:
```bash
DEBUG=chittycloud:* npx @chittycorp/chittycloude-mcp@latest
```

Check log files:
- Info: `/tmp/chittycloude-mcp.log`
- Errors: `/tmp/chittycloude-mcp-error.log`

## 🛣️ Roadmap

### v1.1 - Extended Platform Support
- [ ] Netlify integration
- [ ] Render.com integration  
- [ ] Fly.io integration

### v1.2 - Advanced Features
- [ ] Automatic platform recommendations
- [ ] Deployment rollback capabilities
- [ ] Team collaboration features
- [ ] CI/CD pipeline integration

### v1.3 - Enterprise Features
- [ ] SSO authentication
- [ ] Audit logging
- [ ] Cost budgets and alerts
- [ ] Custom deployment strategies

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Test with: `npm test`
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://docs.chitty.cc/cloud)
- 🐛 [Report Issues](https://github.com/chittyapps/chittycloude-mcp/issues)
- 💬 [Discussions](https://github.com/chittyapps/chittycloude-mcp/discussions)
- 📧 Email: support@chitty.cc

---

**ChittyCloude™ MCP** - Universal cloud deployment, unified experience. ☁️