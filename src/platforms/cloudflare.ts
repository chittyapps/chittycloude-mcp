import axios from 'axios';
import { CloudPlatform, DeploymentConfig, DeploymentResult, PlatformAnalytics } from '../types.ts';

export class CloudflareAdapter {
  readonly platform = CloudPlatform.CLOUDFLARE;
  private api: any;
  private accountId: string = '';
  private apiToken: string = '';
  private authenticated = false;

  constructor() {
    this.api = axios.create({
      baseURL: 'https://api.cloudflare.com/v4',
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
      return config;
    });
  }

  async authenticate(credentials: Record<string, string>): Promise<boolean> {
    try {
      this.apiToken = credentials.apiToken;
      this.accountId = credentials.accountId;

      // Verify token by getting account info
      const response = await this.api.get(`/accounts/${this.accountId}`);
      
      if (response.data.success) {
        this.authenticated = true;
        return true;
      }
      return false;
    } catch (error) {
      this.authenticated = false;
      throw new Error(`Cloudflare authentication failed: ${error}`);
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated && !!this.apiToken && !!this.accountId;
  }

  async deploy(config: DeploymentConfig, userId?: string): Promise<DeploymentResult> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Cloudflare');
    }

    try {
      const startTime = Date.now();

      // For Cloudflare Pages deployment
      if (config.buildCommand || config.outputDirectory) {
        return await this.deployPages(config, startTime);
      }

      // For Cloudflare Workers deployment
      return await this.deployWorker(config, startTime);
    } catch (error) {
      throw new Error(`Cloudflare deployment failed: ${error}`);
    }
  }

  private async deployPages(config: DeploymentConfig, startTime: number): Promise<DeploymentResult> {
    // Create or get existing Pages project
    const project = await this.getOrCreatePagesProject(config.projectName);

    // Trigger deployment (this would typically involve uploading files)
    const deployment = await this.api.post(
      `/accounts/${this.accountId}/pages/projects/${project.name}/deployments`,
      {
        environment: config.environment || 'production'
      }
    );

    const buildTime = Date.now() - startTime;

    return {
      platform: CloudPlatform.CLOUDFLARE,
      deploymentId: deployment.data.result.id,
      url: deployment.data.result.url,
      status: 'building',
      buildTime,
      region: 'global',
      timestamp: new Date().toISOString()
    };
  }

  private async deployWorker(config: DeploymentConfig, startTime: number): Promise<DeploymentResult> {
    // Deploy Cloudflare Worker
    const workerScript = `
export default {
  async fetch(request) {
    return new Response('Hello from ${config.projectName}!', {
      headers: { 'content-type': 'text/plain' }
    });
  }
};`;

    await this.api.put(
      `/accounts/${this.accountId}/workers/scripts/${config.projectName}`,
      workerScript,
      {
        headers: {
          'Content-Type': 'application/javascript'
        }
      }
    );

    const buildTime = Date.now() - startTime;
    const subdomain = config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    return {
      platform: CloudPlatform.CLOUDFLARE,
      deploymentId: `${config.projectName}-${Date.now()}`,
      url: `https://${subdomain}.${this.accountId.slice(0, 8)}.workers.dev`,
      status: 'ready',
      buildTime,
      region: 'global',
      timestamp: new Date().toISOString()
    };
  }

  private async getOrCreatePagesProject(projectName: string) {
    try {
      // Try to get existing project
      const response = await this.api.get(`/accounts/${this.accountId}/pages/projects/${projectName}`);
      return response.data.result;
    } catch {
      // Create new project if it doesn't exist
      const response = await this.api.post(`/accounts/${this.accountId}/pages/projects`, {
        name: projectName,
        production_branch: 'main'
      });
      return response.data.result;
    }
  }

  async getStatus(deploymentId: string): Promise<DeploymentResult> {
    // For Workers, check if script exists and is active
    try {
      const response = await this.api.get(`/accounts/${this.accountId}/workers/scripts`);
      const scripts = response.data.result;
      
      // Simple status check - in reality you'd parse the deploymentId better
      const exists = scripts.some((script: any) => deploymentId.includes(script.id));
      
      return {
        platform: CloudPlatform.CLOUDFLARE,
        deploymentId,
        url: `https://worker.dev`, // Would be actual URL
        status: exists ? 'ready' : 'error',
        region: 'global',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get deployment status: ${error}`);
    }
  }

  async getDeployments(userId?: string): Promise<DeploymentResult[]> {
    try {
      // Get Workers
      const workersResponse = await this.api.get(`/accounts/${this.accountId}/workers/scripts`);
      const workers = workersResponse.data.result || [];

      // Get Pages projects
      const pagesResponse = await this.api.get(`/accounts/${this.accountId}/pages/projects`);
      const pages = pagesResponse.data.result || [];

      const deployments: DeploymentResult[] = [];

      // Convert workers to deployments
      workers.forEach((worker: any) => {
        deployments.push({
          platform: CloudPlatform.CLOUDFLARE,
          deploymentId: worker.id,
          url: `https://${worker.id}.workers.dev`,
          status: 'ready',
          region: 'global',
          timestamp: worker.created_on || new Date().toISOString()
        });
      });

      // Convert pages to deployments
      pages.forEach((page: any) => {
        deployments.push({
          platform: CloudPlatform.CLOUDFLARE,
          deploymentId: page.id,
          url: `https://${page.subdomain}.pages.dev`,
          status: 'ready',
          region: 'global',
          timestamp: page.created_on || new Date().toISOString()
        });
      });

      return deployments;
    } catch (error) {
      throw new Error(`Failed to get deployments: ${error}`);
    }
  }

  async getCost(deploymentId: string): Promise<number> {
    // Cloudflare Workers have generous free tier
    // This would integrate with Cloudflare's billing API if available
    return 0; // Free tier
  }

  async getAnalytics(projectName: string): Promise<PlatformAnalytics> {
    try {
      // Get basic analytics for the worker/page
      // This would use Cloudflare Analytics API
      return {
        platform: CloudPlatform.CLOUDFLARE,
        projectName,
        totalDeployments: 1, // Placeholder
        successRate: 0.99,
        averageBuildTime: 5000,
        totalCost: 0,
        performanceScore: 95
      };
    } catch (error) {
      console.warn(`Failed to get analytics: ${error}`);
      return {
        platform: CloudPlatform.CLOUDFLARE,
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
    // This would integrate with Cloudflare Teams API
    console.log(`Sharing deployment ${deploymentId} with team ${teamId}`);
  }

  async getTeamDeployments(teamId: string): Promise<DeploymentResult[]> {
    // This would filter deployments by team access
    return this.getDeployments();
  }

  // Cloudflare-specific methods
  async createWorker(name: string, script: string): Promise<string> {
    try {
      const response = await this.api.put(
        `/accounts/${this.accountId}/workers/scripts/${name}`,
        script,
        {
          headers: {
            'Content-Type': 'application/javascript'
          }
        }
      );

      return response.data.result.id;
    } catch (error) {
      throw new Error(`Failed to create worker: ${error}`);
    }
  }

  async updateWorkerScript(name: string, script: string): Promise<void> {
    try {
      await this.api.put(
        `/accounts/${this.accountId}/workers/scripts/${name}`,
        script,
        {
          headers: {
            'Content-Type': 'application/javascript'
          }
        }
      );
    } catch (error) {
      throw new Error(`Failed to update worker script: ${error}`);
    }
  }

  async deleteWorker(name: string): Promise<void> {
    try {
      await this.api.delete(`/accounts/${this.accountId}/workers/scripts/${name}`);
    } catch (error) {
      throw new Error(`Failed to delete worker: ${error}`);
    }
  }

  async getWorkerLogs(name: string, limit = 100): Promise<any[]> {
    try {
      // This would use Cloudflare's logs API (requires Enterprise)
      console.log(`Getting logs for worker ${name} (limit: ${limit})`);
      return [];
    } catch (error) {
      console.warn(`Failed to get worker logs: ${error}`);
      return [];
    }
  }

  async setEnvironmentVariables(scriptName: string, variables: Record<string, string>): Promise<void> {
    try {
      const bindings = Object.entries(variables).map(([name, value]) => ({
        type: 'plain_text',
        name,
        text: value
      }));

      await this.api.patch(`/accounts/${this.accountId}/workers/scripts/${scriptName}/bindings`, {
        bindings
      });
    } catch (error) {
      throw new Error(`Failed to set environment variables: ${error}`);
    }
  }
}