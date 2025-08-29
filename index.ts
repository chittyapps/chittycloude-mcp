#!/usr/bin/env node --experimental-strip-types

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { pino } from 'pino';
import { tmpdir } from 'os';
import { join } from 'path';
import { createServer } from 'http';
import { readFileSync } from 'fs';

// Import platform adapters
import { CloudflareAdapter } from './src/platforms/cloudflare.ts';
import { VercelAdapter } from './src/platforms/vercel.ts';
import { RailwayAdapter } from './src/platforms/railway.ts';

// Import types
import { 
  CloudPlatform, 
  DeploymentConfig, 
  DeploymentConfigSchema,
  CostCompareInputSchema,
  PlatformRecommendation,
  CloudPlatformAdapter 
} from './src/types.ts';

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
        options: { destination: join(tmpdir(), 'chittycloud-mcp-error.log') },
        level: 'error'
      },
      {
        target: 'pino/file',
        options: { destination: join(tmpdir(), 'chittycloud-mcp.log') },
        level: 'info'
      }
    ]
  }
});

// Platform adapters
const platformAdapters = new Map<CloudPlatform, CloudPlatformAdapter>();
platformAdapters.set(CloudPlatform.CLOUDFLARE, new CloudflareAdapter());
platformAdapters.set(CloudPlatform.VERCEL, new VercelAdapter());
platformAdapters.set(CloudPlatform.RAILWAY, new RailwayAdapter());

// Authentication store (in production, this would be encrypted/secured)
const authStore = new Map<CloudPlatform, Record<string, string>>();

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

// Deploy tool - Deploy to any cloud platform
server.tool(
  'deploy',
  'Deploy a project to a specified cloud platform (Cloudflare, Vercel, Railway). Requires authentication for the target platform.',
  {
    config: DeploymentConfigSchema,
    authenticate: z.boolean().optional().describe('Whether to prompt for authentication if not already authenticated'),
  },
  async ({ config, authenticate = true }) => {
    logger.info(`Deploy request for ${config.projectName} on ${config.platform}`);

    try {
      const adapter = platformAdapters.get(config.platform);
      if (!adapter) {
        return {
          content: [{ type: 'text', text: `Platform ${config.platform} not supported` }],
          isError: true
        };
      }

      // Check authentication
      if (!adapter.isAuthenticated()) {
        if (!authenticate) {
          return {
            content: [{ type: 'text', text: `Not authenticated with ${config.platform}. Use the 'authenticate' tool first.` }],
            isError: true
          };
        }

        return {
          content: [{ 
            type: 'text', 
            text: `Authentication required for ${config.platform}. Please use the 'authenticate' tool first with your API credentials.` 
          }],
          isError: true
        };
      }

      // Perform deployment
      const result = await adapter.deploy(config);
      
      return {
        content: [{
          type: 'text',
          text: `🚀 Deployment initiated successfully!

Platform: ${result.platform}
Project: ${config.projectName}
Deployment ID: ${result.deploymentId}
URL: ${result.url}
Status: ${result.status}
Region: ${result.region}
Build Time: ${result.buildTime}ms

Use the 'deployment-status' tool to check progress.`
        }]
      };
    } catch (error) {
      logger.error(`Deployment failed: ${error}`);
      return {
        content: [{ type: 'text', text: `Deployment failed: ${error}` }],
        isError: true
      };
    }
  }
);

// Authentication tool
server.tool(
  'authenticate',
  'Authenticate with a cloud platform using API credentials',
  {
    platform: z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly']),
    credentials: z.record(z.string(), z.string()).describe('Platform-specific credentials (e.g., apiToken, accountId for Cloudflare)'),
  },
  async ({ platform, credentials }) => {
    logger.info(`Authentication request for ${platform}`);

    try {
      const adapter = platformAdapters.get(platform);
      if (!adapter) {
        return {
          content: [{ type: 'text', text: `Platform ${platform} not supported` }],
          isError: true
        };
      }

      const success = await adapter.authenticate(credentials);
      
      if (success) {
        authStore.set(platform, credentials);
        return {
          content: [{
            type: 'text',
            text: `✅ Successfully authenticated with ${platform}`
          }]
        };
      } else {
        return {
          content: [{ type: 'text', text: `❌ Authentication failed for ${platform}` }],
          isError: true
        };
      }
    } catch (error) {
      logger.error(`Authentication failed: ${error}`);
      return {
        content: [{ type: 'text', text: `Authentication failed: ${error}` }],
        isError: true
      };
    }
  }
);

// Deployment status tool
server.tool(
  'deployment-status',
  'Check the status of a deployment',
  {
    platform: z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly']),
    deploymentId: z.string(),
  },
  async ({ platform, deploymentId }) => {
    logger.info(`Status check for deployment ${deploymentId} on ${platform}`);

    try {
      const adapter = platformAdapters.get(platform);
      if (!adapter) {
        return {
          content: [{ type: 'text', text: `Platform ${platform} not supported` }],
          isError: true
        };
      }

      if (!adapter.isAuthenticated()) {
        return {
          content: [{ type: 'text', text: `Not authenticated with ${platform}` }],
          isError: true
        };
      }

      const status = await adapter.getStatus(deploymentId);
      
      const statusEmoji = {
        'pending': '⏳',
        'building': '🔨',
        'ready': '✅',
        'error': '❌',
        'canceled': '🚫'
      }[status.status];

      return {
        content: [{
          type: 'text',
          text: `${statusEmoji} Deployment Status

Platform: ${status.platform}
Deployment ID: ${status.deploymentId}
URL: ${status.url}
Status: ${status.status}
Region: ${status.region}
${status.buildTime ? `Build Time: ${status.buildTime}ms` : ''}
Last Updated: ${status.timestamp}`
        }]
      };
    } catch (error) {
      logger.error(`Status check failed: ${error}`);
      return {
        content: [{ type: 'text', text: `Status check failed: ${error}` }],
        isError: true
      };
    }
  }
);

// Cost comparison tool
server.tool(
  'cost-compare',
  'Compare deployment costs across different cloud platforms',
  CostCompareInputSchema,
  async ({ config, platforms = ['cloudflare', 'vercel', 'railway'] }) => {
    logger.info(`Cost comparison for ${config.projectName} across platforms`);

    try {
      const results = [];

      for (const platform of platforms) {
        const adapter = platformAdapters.get(platform);
        if (!adapter) continue;

        try {
          if (!adapter.isAuthenticated()) {
            results.push(`${platform}: ⚠️ Not authenticated`);
            continue;
          }

          const analytics = await adapter.getAnalytics(config.projectName);
          
          results.push(`${platform}:
  💰 Estimated Cost: $${analytics.totalCost.toFixed(2)}/month
  📊 Performance Score: ${analytics.performanceScore}/100
  ⚡ Avg Build Time: ${Math.round(analytics.averageBuildTime / 1000)}s
  ✅ Success Rate: ${Math.round(analytics.successRate * 100)}%`);
        } catch (error) {
          results.push(`${platform}: ❌ Error getting data - ${error}`);
        }
      }

      return {
        content: [{
          type: 'text',
          text: `💰 Cost Comparison for "${config.projectName}"

${results.join('\n\n')}

💡 Recommendations:
• Cloudflare: Best for static sites and edge computing (generous free tier)
• Vercel: Best for Next.js and React apps (excellent DX)
• Railway: Best for full-stack apps with databases (simple pricing)`
        }]
      };
    } catch (error) {
      logger.error(`Cost comparison failed: ${error}`);
      return {
        content: [{ type: 'text', text: `Cost comparison failed: ${error}` }],
        isError: true
      };
    }
  }
);

// List deployments tool
server.tool(
  'list-deployments',
  'List all deployments across platforms or for a specific platform',
  {
    platform: z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly']).optional().describe('Optional: filter by specific platform'),
    limit: z.number().min(1).max(100).optional().describe('Maximum number of deployments to return (default: 20)'),
  },
  async ({ platform, limit = 20 }) => {
    logger.info(`Listing deployments${platform ? ` for ${platform}` : ' across all platforms'}`);

    try {
      const allDeployments = [];
      const platformsToCheck = platform ? [platform] : Array.from(platformAdapters.keys());

      for (const platformName of platformsToCheck) {
        const adapter = platformAdapters.get(platformName);
        if (!adapter) continue;

        if (!adapter.isAuthenticated()) {
          allDeployments.push({
            platform: platformName,
            error: 'Not authenticated'
          });
          continue;
        }

        try {
          const deployments = await adapter.getDeployments();
          allDeployments.push(...deployments);
        } catch (error) {
          allDeployments.push({
            platform: platformName,
            error: error
          });
        }
      }

      // Sort by timestamp (newest first)
      const validDeployments = allDeployments.filter(d => !('error' in d));
      const errorDeployments = allDeployments.filter(d => 'error' in d);
      
      validDeployments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const deployments = validDeployments.slice(0, limit);

      if (deployments.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No deployments found${platform ? ` on ${platform}` : ''}.\n${errorDeployments.length > 0 ? '\nErrors:\n' + errorDeployments.map(e => `${e.platform}: ${e.error}`).join('\n') : ''}`
          }]
        };
      }

      const deploymentsList = deployments.map(d => {
        const statusEmoji = {
          'pending': '⏳',
          'building': '🔨',
          'ready': '✅',
          'error': '❌',
          'canceled': '🚫'
        }[d.status];

        const timeAgo = new Date(Date.now() - new Date(d.timestamp).getTime()).toISOString().substr(11, 8);
        
        return `${statusEmoji} ${d.platform.toUpperCase()} | ${d.deploymentId.slice(0, 8)}... | ${d.url} | ${timeAgo} ago`;
      }).join('\n');

      return {
        content: [{
          type: 'text',
          text: `🚀 Recent Deployments (${deployments.length}/${allDeployments.length})

${deploymentsList}

${errorDeployments.length > 0 ? '\n⚠️ Platform Errors:\n' + errorDeployments.map(e => `${e.platform}: ${e.error}`).join('\n') : ''}`
        }]
      };
    } catch (error) {
      logger.error(`List deployments failed: ${error}`);
      return {
        content: [{ type: 'text', text: `Failed to list deployments: ${error}` }],
        isError: true
      };
    }
  }
);

// Platform analytics tool
server.tool(
  'platform-analytics',
  'Get detailed analytics for a project across all platforms',
  {
    projectName: z.string(),
    platforms: z.array(z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly'])).optional().describe('Platforms to analyze (default: all authenticated platforms)'),
  },
  async ({ projectName, platforms }) => {
    logger.info(`Getting analytics for project ${projectName}`);

    try {
      const platformsToCheck = platforms || Array.from(platformAdapters.keys());
      const analytics = [];

      for (const platform of platformsToCheck) {
        const adapter = platformAdapters.get(platform);
        if (!adapter || !adapter.isAuthenticated()) continue;

        try {
          const data = await adapter.getAnalytics(projectName);
          analytics.push(data);
        } catch (error) {
          logger.warn(`Failed to get analytics for ${platform}: ${error}`);
        }
      }

      if (analytics.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No analytics data found for project "${projectName}". Make sure you're authenticated with the platforms and have deployments.`
          }]
        };
      }

      const analyticsReport = analytics.map(data => `
📊 ${data.platform.toUpperCase()}
• Total Deployments: ${data.totalDeployments}
• Success Rate: ${Math.round(data.successRate * 100)}%
• Avg Build Time: ${Math.round(data.averageBuildTime / 1000)}s
• Monthly Cost: $${data.totalCost.toFixed(2)}
• Performance Score: ${data.performanceScore}/100
${data.lastDeployment ? `• Last Deploy: ${new Date(data.lastDeployment).toLocaleDateString()}` : ''}
      `).join('\n');

      // Calculate totals
      const totalDeployments = analytics.reduce((sum, a) => sum + a.totalDeployments, 0);
      const totalCost = analytics.reduce((sum, a) => sum + a.totalCost, 0);
      const avgSuccessRate = analytics.reduce((sum, a) => sum + a.successRate, 0) / analytics.length;

      return {
        content: [{
          type: 'text',
          text: `📈 Analytics Report for "${projectName}"

${analyticsReport}

🏆 SUMMARY
• Total Deployments: ${totalDeployments}
• Average Success Rate: ${Math.round(avgSuccessRate * 100)}%
• Total Monthly Cost: $${totalCost.toFixed(2)}
• Platforms Active: ${analytics.length}

💡 Best Performing Platform: ${analytics.sort((a, b) => b.performanceScore - a.performanceScore)[0]?.platform.toUpperCase() || 'N/A'}`
        }]
      };
    } catch (error) {
      logger.error(`Analytics failed: ${error}`);
      return {
        content: [{ type: 'text', text: `Analytics failed: ${error}` }],
        isError: true
      };
    }
  }
);

// Determine transport mode
const useHttp = process.env['MCP_HTTP_MODE'] === 'true' || process.argv.includes('--http');
const port = parseInt(process.env['MCP_PORT'] || '3000', 10);

if (useHttp) {
  // HTTP mode
  logger.info(`Starting ChittyCloud MCP HTTP server on port ${port}`);

  const httpServer = createServer(async (req, res) => {
    // Basic CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        service: 'chittycloud-mcp',
        version: VERSION,
        timestamp: new Date().toISOString(),
        platforms: {
          cloudflare: platformAdapters.get(CloudPlatform.CLOUDFLARE)?.isAuthenticated() || false,
          vercel: platformAdapters.get(CloudPlatform.VERCEL)?.isAuthenticated() || false,
          railway: platformAdapters.get(CloudPlatform.RAILWAY)?.isAuthenticated() || false,
        }
      }));
      return;
    }

    // Handle MCP requests
    if (req.url === '/' && req.method === 'POST') {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => `session-${Date.now()}`
      });
      
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  httpServer.listen(port, () => {
    logger.info(`ChittyCloud MCP server version ${VERSION} started on port ${port}`);
    logger.info(`Health check: http://localhost:${port}/health`);
  });
} else {
  // Stdio mode (default)
  logger.info('Starting ChittyCloud MCP in stdio mode');
  const transport = new StdioServerTransport();
  
  server.connect(transport)
    .then(() => {
      logger.info(`ChittyCloud MCP server version ${VERSION} started successfully`);
    })
    .catch((error: Error) => {
      logger.error(`Failed to start ChittyCloud MCP server: ${error.message}`);
      process.exit(1);
    });
}