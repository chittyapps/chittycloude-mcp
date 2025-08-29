import axios from 'axios';
import { CloudPlatform, DeploymentConfig, DeploymentResult, PlatformAnalytics } from '../types.ts';

export class VercelAdapter {
  readonly platform = CloudPlatform.VERCEL;
  private api: any;
  private apiToken: string = '';
  private teamId: string = '';
  private authenticated = false;

  constructor() {
    this.api = axios.create({
      baseURL: 'https://api.vercel.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChittyCloud-MCP/1.0.0'
      }
    });

    // Add auth interceptor
    this.api.interceptors.request.use((config) => {
      if (this.apiToken) {
        config.headers.Authorization = `Bearer ${this.apiToken}`;
      }
      if (this.teamId) {
        config.params = { ...config.params, teamId: this.teamId };
      }
      return config;
    });
  }

  async authenticate(credentials: Record<string, string>): Promise<boolean> {
    try {
      this.apiToken = credentials.apiToken;
      this.teamId = credentials.teamId || '';

      // Verify token by getting user info
      const response = await this.api.get('/v2/user');
      
      if (response.data) {
        this.authenticated = true;
        return true;
      }
      return false;
    } catch (error) {
      this.authenticated = false;
      throw new Error(`Vercel authentication failed: ${error}`);
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated && !!this.apiToken;
  }

  async deploy(config: DeploymentConfig, userId?: string): Promise<DeploymentResult> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Vercel');
    }

    try {
      const startTime = Date.now();

      // Create deployment
      const deploymentData = {
        name: config.projectName,
        files: [
          {
            file: 'package.json',
            data: JSON.stringify({
              name: config.projectName,
              version: '1.0.0',
              scripts: {
                build: config.buildCommand || 'echo "No build command"'
              }
            })
          },
          {
            file: 'index.html',
            data: `<!DOCTYPE html>
<html>
<head><title>${config.projectName}</title></head>
<body><h1>Hello from ${config.projectName}!</h1></body>
</html>`
          }
        ],
        projectSettings: {
          buildCommand: config.buildCommand,
          outputDirectory: config.outputDirectory,
          installCommand: 'npm install'
        },
        target: config.environment || 'production',
        env: config.environmentVariables || {}
      };

      const response = await this.api.post('/v13/deployments', deploymentData);
      const deployment = response.data;

      const buildTime = Date.now() - startTime;

      return {
        platform: CloudPlatform.VERCEL,
        deploymentId: deployment.id,
        url: `https://${deployment.url}`,
        status: 'building',
        buildTime,
        region: deployment.regions?.[0] || 'global',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Vercel deployment failed: ${error}`);
    }
  }

  async getStatus(deploymentId: string): Promise<DeploymentResult> {
    try {
      const response = await this.api.get(`/v13/deployments/${deploymentId}`);
      const deployment = response.data;

      return {
        platform: CloudPlatform.VERCEL,
        deploymentId: deployment.id,
        url: `https://${deployment.url}`,
        status: this.mapVercelStatus(deployment.readyState),
        buildTime: deployment.buildingAt ? 
          new Date(deployment.ready || Date.now()).getTime() - new Date(deployment.buildingAt).getTime() 
          : undefined,
        region: deployment.regions?.[0] || 'global',
        timestamp: deployment.createdAt
      };
    } catch (error) {
      throw new Error(`Failed to get deployment status: ${error}`);
    }
  }

  private mapVercelStatus(vercelStatus: string): 'pending' | 'building' | 'ready' | 'error' | 'canceled' {
    switch (vercelStatus) {
      case 'QUEUED':
      case 'INITIALIZING':
        return 'pending';
      case 'BUILDING':
        return 'building';
      case 'READY':
        return 'ready';
      case 'ERROR':
        return 'error';
      case 'CANCELED':
        return 'canceled';
      default:
        return 'pending';
    }
  }

  async getDeployments(userId?: string): Promise<DeploymentResult[]> {
    try {
      const response = await this.api.get('/v6/deployments', {
        params: { limit: 100 }
      });
      
      const deployments = response.data.deployments || [];

      return deployments.map((deployment: any) => ({
        platform: CloudPlatform.VERCEL,
        deploymentId: deployment.id,
        url: `https://${deployment.url}`,
        status: this.mapVercelStatus(deployment.readyState),
        buildTime: deployment.buildingAt ? 
          new Date(deployment.ready || Date.now()).getTime() - new Date(deployment.buildingAt).getTime() 
          : undefined,
        region: deployment.regions?.[0] || 'global',
        timestamp: deployment.createdAt
      }));
    } catch (error) {
      throw new Error(`Failed to get deployments: ${error}`);
    }
  }

  async getCost(deploymentId: string): Promise<number> {
    try {
      // Get usage data for the deployment
      // Vercel pricing is based on function executions, bandwidth, etc.
      const response = await this.api.get('/v1/usage', {
        params: {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          until: new Date().toISOString()
        }
      });

      // Calculate approximate cost based on usage
      const usage = response.data;
      const functionExecutions = usage.executions || 0;
      const bandwidth = usage.bandwidth || 0;

      // Rough cost calculation (Vercel pricing as of 2024)
      const executionCost = Math.max(0, (functionExecutions - 100000) * 0.0000004); // $0.40 per million after first 100k
      const bandwidthCost = Math.max(0, (bandwidth - 100 * 1024 * 1024 * 1024) * 0.15 / (1024 * 1024 * 1024)); // $0.15 per GB after first 100GB

      return executionCost + bandwidthCost;
    } catch (error) {
      console.warn(`Failed to get cost data: ${error}`);
      return 0; // Return 0 if unable to calculate
    }
  }

  async getAnalytics(projectName: string): Promise<PlatformAnalytics> {
    try {
      // Get project deployments for analytics
      const deploymentsResponse = await this.api.get('/v6/deployments', {
        params: { projectId: projectName, limit: 100 }
      });

      const deployments = deploymentsResponse.data.deployments || [];
      
      const totalDeployments = deployments.length;
      const successfulDeployments = deployments.filter((d: any) => d.readyState === 'READY').length;
      const successRate = totalDeployments > 0 ? successfulDeployments / totalDeployments : 0;

      // Calculate average build time
      const buildTimes = deployments
        .filter((d: any) => d.buildingAt && d.ready)
        .map((d: any) => new Date(d.ready).getTime() - new Date(d.buildingAt).getTime());
      
      const averageBuildTime = buildTimes.length > 0 
        ? buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length 
        : 0;

      return {
        platform: CloudPlatform.VERCEL,
        projectName,
        totalDeployments,
        successRate,
        averageBuildTime,
        totalCost: await this.getCost(''), // Get overall cost
        performanceScore: successRate * 100,
        lastDeployment: deployments[0]?.createdAt
      };
    } catch (error) {
      console.warn(`Failed to get analytics: ${error}`);
      return {
        platform: CloudPlatform.VERCEL,
        projectName,
        totalDeployments: 0,
        successRate: 0,
        averageBuildTime: 0,
        totalCost: 0,
        performanceScore: 0
      };
    }
  }

  async shareWithTeam(deploymentId: string, teamId: string): Promise<void> {
    // Vercel deployments are automatically shared within the team
    console.log(`Deployment ${deploymentId} is accessible to team ${teamId}`);
  }

  async getTeamDeployments(teamId: string): Promise<DeploymentResult[]> {
    // Set team context and get deployments
    const originalTeamId = this.teamId;
    this.teamId = teamId;
    
    try {
      const deployments = await this.getDeployments();
      return deployments;
    } finally {
      this.teamId = originalTeamId;
    }
  }

  // Vercel-specific methods
  async getProjects(): Promise<any[]> {
    try {
      const response = await this.api.get('/v9/projects');
      return response.data.projects || [];
    } catch (error) {
      throw new Error(`Failed to get projects: ${error}`);
    }
  }

  async createProject(name: string, framework?: string): Promise<any> {
    try {
      const response = await this.api.post('/v10/projects', {
        name,
        framework: framework || 'static'
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      await this.api.delete(`/v9/projects/${projectId}`);
    } catch (error) {
      throw new Error(`Failed to delete project: ${error}`);
    }
  }

  async getDomains(projectId?: string): Promise<any[]> {
    try {
      const url = projectId ? `/v9/projects/${projectId}/domains` : '/v6/domains';
      const response = await this.api.get(url);
      return response.data.domains || [];
    } catch (error) {
      throw new Error(`Failed to get domains: ${error}`);
    }
  }

  async addDomain(projectId: string, domain: string): Promise<any> {
    try {
      const response = await this.api.post(`/v10/projects/${projectId}/domains`, {
        name: domain
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to add domain: ${error}`);
    }
  }

  async getEnvironmentVariables(projectId: string, target?: string): Promise<any[]> {
    try {
      const params = target ? { target } : {};
      const response = await this.api.get(`/v9/projects/${projectId}/env`, { params });
      return response.data.envs || [];
    } catch (error) {
      throw new Error(`Failed to get environment variables: ${error}`);
    }
  }

  async setEnvironmentVariable(
    projectId: string, 
    key: string, 
    value: string, 
    target: string[] = ['production', 'preview', 'development']
  ): Promise<any> {
    try {
      const response = await this.api.post(`/v10/projects/${projectId}/env`, {
        key,
        value,
        target,
        type: 'encrypted'
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to set environment variable: ${error}`);
    }
  }

  async getLogs(deploymentId: string, limit = 100): Promise<any[]> {
    try {
      const response = await this.api.get(`/v2/deployments/${deploymentId}/events`, {
        params: { limit }
      });
      return response.data.events || [];
    } catch (error) {
      throw new Error(`Failed to get logs: ${error}`);
    }
  }
}