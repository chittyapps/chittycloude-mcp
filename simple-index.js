#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { pino } from 'pino';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFileSync } from 'fs';

// Get version from package.json
const __dirname = import.meta.dirname;
const packageJson = JSON.parse(readFileSync(join(__dirname, './package.json'), 'utf8'));
const VERSION = packageJson.version || '1.0.0';

// Configure logging
const logger = pino({
  level: 'info'
});

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

// Simple ping tool
server.tool(
  'ping',
  'Test that the ChittyCloud MCP server is working',
  {},
  async () => {
    return {
      content: [{
        type: 'text',
        text: '🎉 ChittyCloud MCP is working! Ready to deploy to the cloud.'
      }]
    };
  }
);

// Hello world tool with platform selection
server.tool(
  'hello',
  'Say hello and show available platforms',
  {
    name: z.string().optional().describe('Your name (optional)'),
  },
  async ({ name = 'Developer' }) => {
    return {
      content: [{
        type: 'text',
        text: `👋 Hello ${name}!

🌩️ ChittyCloud Universal Deployment MCP is ready!

📋 Available Commands:
• ping - Test connection
• hello - This greeting

🚀 Supported Platforms (coming soon):
• Cloudflare Workers & Pages
• Vercel Deployments
• Railway Applications  

💡 Next: Use 'authenticate' to connect your cloud accounts, then 'deploy' your projects!`
      }]
    };
  }
);

// Start server
logger.info('Starting ChittyCloud MCP in stdio mode');
const transport = new StdioServerTransport();

server.connect(transport)
  .then(() => {
    logger.info(`ChittyCloud MCP server version ${VERSION} started successfully`);
  })
  .catch((error) => {
    logger.error(`Failed to start ChittyCloud MCP server: ${error.message}`);
    process.exit(1);
  });