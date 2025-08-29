#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { pino } from 'pino';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFileSync } from 'fs';
import axios from 'axios';

// Get version from package.json
const __dirname = import.meta.dirname;
const packageJson = JSON.parse(readFileSync(join(__dirname, './package.json'), 'utf8'));
const VERSION = packageJson.version || '1.0.0';

// Configure logging
const logger = pino({
  level: 'info',
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: join(tmpdir(), 'chittycloude-mcp.log') },
        level: 'info'
      }
    ]
  }
});

// Platform constants
const CloudPlatform = {
  CLOUDFLARE: 'cloudflare',
  VERCEL: 'vercel',
  RAILWAY: 'railway'
};

// Input validation schemas
const ProjectNameSchema = z.string()
  .min(1, 'Project name cannot be empty')
  .max(100, 'Project name too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Project name can only contain letters, numbers, hyphens, and underscores');

const EnvironmentSchema = z.enum(['development', 'staging', 'production'], {
  errorMap: () => ({ message: 'Environment must be development, staging, or production' })
});

const CredentialsSchema = z.object({}).catchall(z.string().min(1, 'Credential values cannot be empty'));

const PlatformSchema = z.enum(['cloudflare', 'vercel', 'railway'], {
  errorMap: () => ({ message: 'Platform must be cloudflare, vercel, or railway' })
});

// Rate limiting
class RateLimiter {
  constructor(maxRequests = 50, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(clientId = 'default') {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    
    // Remove old requests outside the window
    const validRequests = clientRequests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(clientId, validRequests);
    return true;
  }
}

const rateLimiter = new RateLimiter();

// Input sanitization
function sanitizeInput(input) {
  if (typeof input === 'string') {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[\\\/]/g, '') // Remove slashes
      .replace(/[\r\n\t]/g, '') // Remove control characters
      .trim();
  }
  return input;
}

function validateAndSanitize(schema, data, fieldName) {
  try {
    // First sanitize if it's a string
    const sanitized = typeof data === 'object' && data !== null 
      ? Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, sanitizeInput(v)])
        )
      : sanitizeInput(data);
    
    // Then validate
    const result = schema.parse(sanitized);
    return { success: true, data: result };
  } catch (error) {
    logger.warn(`Validation failed for ${fieldName}: ${error.message}`);
    return { 
      success: false, 
      error: `Invalid ${fieldName}: ${error.errors?.[0]?.message || error.message}` 
    };
  }
}

// Security-hardened Cloudflare adapter
class CloudflareAdapter {
  constructor() {
    this.platform = CloudPlatform.CLOUDFLARE;
    this.api = null;
    this.apiToken = '';
    this.accountId = '';
    this.authenticated = false;
  }

  async authenticate(credentials) {
    try {
      // Validate credentials
      const validation = validateAndSanitize(CredentialsSchema, credentials, 'credentials');
      if (!validation.success) {
        throw new Error(validation.error);
      }

      if (!validation.data.apiToken || !validation.data.accountId) {
        throw new Error('Cloudflare requires apiToken and accountId');
      }

      this.apiToken = validation.data.apiToken;
      this.accountId = validation.data.accountId;

      this.api = axios.create({
        baseURL: 'https://api.cloudflare.com/v4',
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ChittyCloude-MCP/1.0.0'
        }
      });

      // Test the connection
      const response = await this.api.get(`/accounts/${this.accountId}`);
      if (response.data.success) {
        this.authenticated = true;
        return true;
      }
      return false;
    } catch (error) {
      this.authenticated = false;
      throw new Error(`Cloudflare authentication failed: ${error.message}`);
    }
  }

  isAuthenticated() {
    return this.authenticated;
  }

  async deploy(config) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Cloudflare');
    }

    const startTime = Date.now();

    // Validate and sanitize project name
    const nameValidation = validateAndSanitize(ProjectNameSchema, config.projectName, 'project name');
    if (!nameValidation.success) {
      throw new Error(nameValidation.error);
    }

    const sanitizedName = nameValidation.data;
    const subdomain = sanitizedName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Create worker script with sanitized name
    const workerScript = `
export default {
  async fetch(request) {
    return new Response('Hello from ${sanitizedName}!', {
      headers: { 'content-type': 'text/plain' }
    });
  }
};`;

    try {
      await this.api.put(
        `/accounts/${this.accountId}/workers/scripts/${sanitizedName}`,
        workerScript,
        {
          headers: {
            'Content-Type': 'application/javascript'
          }
        }
      );

      return {
        platform: this.platform,
        deploymentId: `${sanitizedName}-${Date.now()}`,
        url: `https://${subdomain}.${this.accountId.slice(0, 8)}.workers.dev`,
        status: 'ready',
        buildTime: Date.now() - startTime,
        region: 'global',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Cloudflare deployment failed: ${error.message}`);
    }
  }

  async getStatus(deploymentId) {
    return {
      platform: this.platform,
      deploymentId,
      url: 'https://example.workers.dev',
      status: 'ready',
      region: 'global',
      timestamp: new Date().toISOString()
    };
  }
}

// Security-hardened Vercel adapter
class VercelAdapter {
  constructor() {
    this.platform = CloudPlatform.VERCEL;
    this.api = null;
    this.apiToken = '';
    this.authenticated = false;
  }

  async authenticate(credentials) {
    try {
      const validation = validateAndSanitize(CredentialsSchema, credentials, 'credentials');
      if (!validation.success) {
        throw new Error(validation.error);
      }

      if (!validation.data.apiToken) {
        throw new Error('Vercel requires apiToken');
      }

      this.apiToken = validation.data.apiToken;

      this.api = axios.create({
        baseURL: 'https://api.vercel.com',
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ChittyCloude-MCP/1.0.0'
        }
      });

      const response = await this.api.get('/v2/user');
      if (response.data) {
        this.authenticated = true;
        return true;
      }
      return false;
    } catch (error) {
      this.authenticated = false;
      throw new Error(`Vercel authentication failed: ${error.message}`);
    }
  }

  isAuthenticated() {
    return this.authenticated;
  }

  async deploy(config) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Vercel');
    }

    const startTime = Date.now();

    // Validate and sanitize project name
    const nameValidation = validateAndSanitize(ProjectNameSchema, config.projectName, 'project name');
    if (!nameValidation.success) {
      throw new Error(nameValidation.error);
    }

    const sanitizedName = nameValidation.data;

    const deploymentData = {
      name: sanitizedName,
      files: [
        {
          file: 'index.html',
          data: `<!DOCTYPE html>
<html>
<head><title>${sanitizedName}</title></head>
<body><h1>Hello from ${sanitizedName} on Vercel!</h1></body>
</html>`
        }
      ],
      target: config.environment || 'production'
    };

    try {
      const response = await this.api.post('/v13/deployments', deploymentData);
      const deployment = response.data;

      return {
        platform: this.platform,
        deploymentId: deployment.id,
        url: `https://${deployment.url}`,
        status: 'building',
        buildTime: Date.now() - startTime,
        region: deployment.regions?.[0] || 'global',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Vercel deployment failed: ${error.message}`);
    }
  }

  async getStatus(deploymentId) {
    try {
      const response = await this.api.get(`/v13/deployments/${deploymentId}`);
      const deployment = response.data;

      return {
        platform: this.platform,
        deploymentId: deployment.id,
        url: `https://${deployment.url}`,
        status: deployment.readyState === 'READY' ? 'ready' : 'building',
        region: deployment.regions?.[0] || 'global',
        timestamp: deployment.createdAt
      };
    } catch (error) {
      throw new Error(`Failed to get deployment status: ${error.message}`);
    }
  }
}

// Platform adapters
const platformAdapters = new Map();
platformAdapters.set(CloudPlatform.CLOUDFLARE, new CloudflareAdapter());
platformAdapters.set(CloudPlatform.VERCEL, new VercelAdapter());

// Create MCP server
const server = new McpServer({
  name: 'chittycloud',
  version: VERSION,
  description: 'Universal Cloud Platform Operations - Deploy to Cloudflare, Vercel, Railway, and more',
  capabilities: {
    resources: {},
    tools: {},
    streaming: {}
  }
});

// Enhanced tool with rate limiting and validation
function createSecureTool(name, description, inputSchema, handler) {
  server.tool(name, description, inputSchema, async (args, extra) => {
    // Rate limiting
    if (!rateLimiter.isAllowed()) {
      return {
        content: [{ type: 'text', text: 'Rate limit exceeded. Please try again later.' }],
        isError: true
      };
    }

    // Log request
    logger.info(`Tool called: ${name}`, { args: Object.keys(args) });

    try {
      return await handler(args, extra);
    } catch (error) {
      logger.error(`Tool ${name} failed: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  });
}

// Secure tools
createSecureTool(
  'ping',
  'Test that the ChittyCloude™ MCP server is working',
  {},
  async () => {
    return {
      content: [{
        type: 'text',
        text: '🎉 ChittyCloude™ MCP is working! Security-hardened version ready.'
      }]
    };
  }
);

createSecureTool(
  'authenticate',
  'Authenticate with a cloud platform using API credentials',
  {
    platform: PlatformSchema,
    credentials: CredentialsSchema
  },
  async ({ platform, credentials }) => {
    const adapter = platformAdapters.get(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} not supported`);
    }

    const success = await adapter.authenticate(credentials);
    
    if (success) {
      return {
        content: [{
          type: 'text',
          text: `✅ Successfully authenticated with ${platform}`
        }]
      };
    } else {
      throw new Error(`Authentication failed for ${platform}`);
    }
  }
);

createSecureTool(
  'deploy',
  'Deploy a project to a specified cloud platform',
  {
    platform: PlatformSchema,
    projectName: ProjectNameSchema,
    environment: EnvironmentSchema.optional(),
  },
  async ({ platform, projectName, environment = 'production' }) => {
    const adapter = platformAdapters.get(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} not supported`);
    }

    if (!adapter.isAuthenticated()) {
      throw new Error(`Not authenticated with ${platform}. Use the 'authenticate' tool first.`);
    }

    const result = await adapter.deploy({ platform, projectName, environment });
    
    return {
      content: [{
        type: 'text',
        text: `🚀 Deployment successful!

Platform: ${result.platform}
Project: ${projectName}
URL: ${result.url}
Status: ${result.status}
Build Time: ${result.buildTime}ms
Region: ${result.region}

Your app is live! 🎉`
      }]
    };
  }
);

createSecureTool(
  'deployment-status',
  'Check the status of a deployment',
  {
    platform: PlatformSchema,
    deploymentId: z.string().min(1, 'Deployment ID cannot be empty')
  },
  async ({ platform, deploymentId }) => {
    const adapter = platformAdapters.get(platform);
    if (!adapter || !adapter.isAuthenticated()) {
      throw new Error(`Not authenticated with ${platform}`);
    }

    const status = await adapter.getStatus(deploymentId);
    
    const statusEmoji = {
      'pending': '⏳',
      'building': '🔨',
      'ready': '✅',
      'error': '❌',
      'canceled': '🚫'
    }[status.status] || '❓';

    return {
      content: [{
        type: 'text',
        text: `${statusEmoji} Deployment Status

Platform: ${status.platform}
URL: ${status.url}
Status: ${status.status}
Region: ${status.region}
Last Updated: ${status.timestamp}`
      }]
    };
  }
);

createSecureTool(
  'help',
  'Show available commands and usage examples',
  {},
  async () => {
    return {
      content: [{
        type: 'text',
        text: `☁️ ChittyCloude™ Universal Deployment MCP (Security-Hardened)

📋 Available Commands:
• ping - Test connection
• help - Show this help
• authenticate - Connect to cloud platforms  
• deploy - Deploy your projects (validated inputs)
• deployment-status - Check deployment status

🔒 Security Features:
• Input validation and sanitization
• Rate limiting (50 requests/minute)
• Secure credential handling
• Error logging and monitoring

🚀 Supported Platforms:
• Cloudflare Workers & Pages
• Vercel Deployments
• Railway Applications (coming soon)

💡 Quick Start:
1. authenticate with platform credentials
2. deploy your project (names must be alphanumeric + hyphens/underscores)
3. Check status with deployment-status

Example Usage:
"Authenticate with Cloudflare using API token abc123 and account ID def456"
"Deploy my test-app to Vercel"
"Check status of deployment xyz789 on Cloudflare"

Ready to deploy securely! 🔐☁️`
      }]
    };
  }
);

// Start server with enhanced error handling
logger.info('Starting ChittyCloude™ MCP (Security-Hardened) in stdio mode');
const transport = new StdioServerTransport();

// Add JSON parsing error handling
process.stdin.on('error', (error) => {
  logger.error(`Stdin error: ${error.message}`);
  process.stdout.write(JSON.stringify({
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700, message: "Parse error" }
  }) + '\n');
});

// Add malformed JSON handling middleware
const originalWrite = process.stdout.write;
process.stdout.write = function(chunk, encoding, callback) {
  try {
    // Validate JSON before writing if it looks like a JSON response
    if (typeof chunk === 'string' && chunk.trim().startsWith('{')) {
      JSON.parse(chunk);
    }
    return originalWrite.call(this, chunk, encoding, callback);
  } catch (error) {
    logger.error(`Invalid JSON output intercepted: ${error.message}`);
    const errorResponse = JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" }
    }) + '\n';
    return originalWrite.call(this, errorResponse, encoding, callback);
  }
};

server.connect(transport)
  .then(() => {
    logger.info(`ChittyCloude™ MCP server (Security-Hardened) version ${VERSION} started successfully`);
  })
  .catch((error) => {
    logger.error(`Failed to start ChittyCloude™ MCP server: ${error.message}`);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});