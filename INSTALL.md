# 🚀 ChittyCloude™e™ MCP Installation Guide

## Quick Install for Claude Code

### Method 1: NPX (Recommended)
```bash
# Test the extension directly
npx @chittyapps/chittycloude-mcp@latest

# Add to Claude Code permanently  
claude mcp add chittycloud -- npx @chittyapps/chittycloude-mcp@latest
```

### Method 2: Local Installation
```bash
# Clone and install locally
git clone <repo-url>
cd chittycloud
npm install
chmod +x working-index.js

# Add to Claude Code
claude mcp add chittycloud -- node /path/to/chittycloud/working-index.js
```

### Method 3: Manual MCP Configuration

Add to your Claude Code MCP configuration file:

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

## 🔧 Platform Setup

### Cloudflare Setup
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)  
2. Create API token with permissions:
   - `Zone:Read`
   - `Account:Read` 
   - `Cloudflare Workers:Edit`
3. Note your Account ID from any domain sidebar

### Vercel Setup
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Create new token with deployment permissions
3. Copy the token

### Railway Setup (Coming Soon)
1. Go to [Railway Account](https://railway.app/account/tokens)
2. Create API token
3. Copy the token

## 🧪 Testing the Installation

### Basic Test
```bash
# If using npx
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "ping", "arguments": {}}}' | npx @chittyapps/chittycloude-mcp@latest

# Should return: {"result":{"content":[{"type":"text","text":"🎉 ChittyCloude™ MCP is working! Ready to deploy to the cloud."}]}...
```

### In Claude Code
After installation, you can use natural language:

- "Test ChittyCloude™ connection with ping"
- "Show me ChittyCloude™ help"
- "Authenticate with Cloudflare using token abc123 and account def456"
- "Deploy my portfolio-site to Vercel"

## 🔍 Troubleshooting

### Common Issues

**"Command not found"**
- Ensure Node.js 22+ is installed
- Try: `node --version`

**"Permission denied"**  
- Run: `chmod +x working-index.js`
- Or use npx method instead

**"Module not found"**
- Run: `npm install` in the project directory
- Check that all dependencies are installed

**"Authentication failed"**
- Verify API tokens are correct and active
- Check token permissions match requirements
- Ensure Account IDs are correct (Cloudflare)

### Debug Mode
```bash
# Enable debug logging
DEBUG=chittycloud:* npx @chittyapps/chittycloude-mcp@latest

# Check log file
tail -f /tmp/chittycloud-mcp.log
```

## 📚 Usage Examples

### Authentication Examples
```bash
# Cloudflare
"Authenticate with Cloudflare using API token sk-abc123 and account ID def456"

# Vercel  
"Authenticate with Vercel using API token xyz789"
```

### Deployment Examples
```bash
# Simple deployment
"Deploy my blog-site to Cloudflare"

# With environment
"Deploy my api-server to Vercel in staging environment"

# Check status
"Check status of deployment abc123 on Vercel"
```

## 🎯 What's Working

✅ **Core Tools**
- ping (connection test)
- help (documentation)
- authenticate (Cloudflare, Vercel)
- deploy (real deployments!)
- deployment-status (check progress)

✅ **Real Integrations**
- Cloudflare Workers API
- Vercel Deployments API
- Proper error handling
- Logging and debugging

✅ **Production Ready**
- MCP protocol compliant
- Works with Claude Code, Cursor, VS Code
- Extensible architecture
- Marketplace ready

Ready to deploy to the cloud! ☁️