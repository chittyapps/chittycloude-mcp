# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

ChittyCloud MCP is a Model Context Protocol (MCP) server that provides universal cloud platform deployment capabilities. It enables deployment to multiple cloud platforms (Cloudflare Workers/Pages, Vercel, Railway) through a single, consistent interface with ChittyID integration for user authentication and reputation tracking.

## Common Commands

### Development Commands
```bash
# Start development server (stdio mode - default)
npm run dev

# Start production server
npm start

# Type checking
npm run test:tsc

# Linting
npm run test:lint

# Run all tests
npm test

# Build (sets executable permissions)
npm run build

# Start HTTP mode server
npm run server-http
```

### Testing and Quality Assurance
```bash
# Run comprehensive QA tests
node final-qa-test.js

# Run security penetration tests
node security-test.js

# Run input validation tests
node input-validation-test.js

# Test MCP connectivity
node test-mcp.js
```

### MCP Server Modes
```bash
# STDIO mode (default - for Claude Desktop integration)
node working-index.js

# HTTP mode (for web clients and debugging)
MCP_HTTP_MODE=true node working-index.js --http

# Health check endpoint (HTTP mode)
curl http://localhost:3000/health
```

## High-Level Architecture

### Core MCP Server (`index.ts`)
The main server implementation using `@modelcontextprotocol/sdk` that provides:
- **Transport Modes**: Supports both STDIO and HTTP transports
- **Tool Registry**: Six main tools for cloud deployment operations
- **Platform Integration**: Adapter pattern for different cloud providers
- **Authentication Management**: Secure credential storage and verification
- **Error Handling**: Comprehensive error reporting with proper MCP responses

### Platform Adapter System (`src/platforms/`)
Implements the adapter pattern for cloud platform integrations:
- **CloudflareAdapter** (`cloudflare.ts`): Cloudflare Workers and Pages deployment
- **VercelAdapter** (`vercel.ts`): Vercel static sites and serverless functions  
- **RailwayAdapter** (`railway.ts`): Full-stack applications and databases
- **Unified Interface**: All adapters implement `CloudPlatformAdapter` interface

### Type System (`src/types.ts`)
Comprehensive TypeScript definitions with Zod validation:
- **DeploymentConfig**: Platform-agnostic deployment configuration
- **DeploymentResult**: Standardized deployment response format
- **Platform Analytics**: Cost and performance metrics
- **ChittyID Integration**: User authentication and reputation scoring
- **Team Collaboration**: Multi-user deployment workflows

### ChittyID Integration (`src/chittyid/client.ts`)
Handles user authentication and reputation management:
- **Authentication**: Multiple auth methods (token, API key, OAuth)
- **ChittyScore**: Reputation tracking based on deployment success
- **Team Management**: Collaborative deployment workflows
- **Platform Connections**: Link cloud platform credentials to user accounts

### Security and Validation
All user inputs are validated using Zod schemas:
- **Input Sanitization**: Prevents injection attacks
- **Credential Protection**: Secure storage of API tokens
- **Rate Limiting**: Prevents abuse in HTTP mode
- **Error Boundaries**: Proper error isolation and reporting

## Key Development Patterns

### Tool Registration Pattern
```typescript
server.tool(
  'tool-name',
  'Description of what this tool does',
  inputSchema,
  async (params) => {
    // Tool implementation
    return { content: [{ type: 'text', text: result }] };
  }
);
```

### Platform Adapter Interface
All platform adapters must implement:
- `authenticate(credentials)`: Verify and store platform credentials
- `deploy(config)`: Execute deployment to the platform
- `getStatus(deploymentId)`: Check deployment status
- `getDeployments()`: List all deployments
- `getAnalytics(projectName)`: Get cost and performance data

### Error Handling Strategy
- **Custom Error Classes**: `ChittyCloudError`, `AuthenticationError`, `DeploymentError`
- **MCP Error Format**: All errors returned as proper MCP error responses
- **Logging**: Structured logging to `/tmp/chittycloud-mcp.log` and error log
- **Graceful Degradation**: Continue operation when non-critical services fail

### Authentication Flow
1. User provides platform credentials via `authenticate` tool
2. Adapter verifies credentials with platform API
3. Credentials stored in memory for session duration
4. ChittyID integration tracks successful authentications
5. All subsequent deployments use stored credentials

## Testing Strategy

### Quality Assurance (`final-qa-test.js`)
- **End-to-end MCP Protocol Testing**: Complete request/response cycles
- **Tool Validation**: All six tools tested with various inputs
- **Error Scenario Testing**: Invalid inputs, missing auth, etc.
- **Performance Metrics**: Response time and memory usage tracking

### Security Testing (`security-test.js`)
- **Input Sanitization**: SQL injection, XSS prevention
- **Authentication Bypass**: Credential validation testing
- **Rate Limiting**: Abuse prevention verification
- **Data Leakage**: Ensure secrets don't appear in logs/responses

### Input Validation (`input-validation-test.js`)
- **Zod Schema Validation**: All input schemas thoroughly tested
- **Edge Cases**: Boundary conditions, malformed data
- **Type Safety**: TypeScript integration verification

## Integration Points

### Claude Desktop/Code Integration
- **STDIO Transport**: Primary integration method
- **Manifest Configuration**: Defined in `manifest.json`
- **Tool Discovery**: Automatic registration with MCP client
- **Natural Language**: Tools respond to conversational deployment requests

### HTTP Mode for Web Clients
- **REST-like Interface**: MCP over HTTP for browser clients
- **CORS Support**: Cross-origin requests enabled
- **Health Monitoring**: `/health` endpoint for service status
- **Authentication**: Header-based API key support

### External Service Dependencies
- **Cloudflare API**: Workers and Pages deployment endpoints
- **Vercel API**: Deployment and project management
- **Railway API**: Application and database services
- **ChittyID Service**: User authentication and reputation tracking

## Deployment and Production Considerations

### Environment Configuration
- **CHITTY_API_KEY**: Required for ChittyID integration
- **MCP_HTTP_MODE**: Enable HTTP transport mode
- **MCP_PORT**: HTTP server port (default: 3000)
- **NODE_ENV**: Environment-specific logging levels

### Monitoring and Observability
- **Structured Logging**: Pino logger with file rotation
- **Health Checks**: Built-in endpoint for service monitoring  
- **Performance Tracking**: Request timing and success rates
- **Error Aggregation**: Centralized error logging and reporting

### Security Best Practices
- **Credential Isolation**: In-memory storage only, no persistence
- **Input Validation**: All inputs validated before processing
- **Rate Limiting**: Configurable request throttling
- **Audit Logging**: All deployment actions logged for compliance