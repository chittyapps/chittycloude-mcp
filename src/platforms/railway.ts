import axios from 'axios';
import { CloudPlatform, DeploymentConfig, DeploymentResult, PlatformAnalytics } from '../types.ts';

export class RailwayAdapter {
  readonly platform = CloudPlatform.RAILWAY;
  private api: any;
  private apiToken: string = '';
  private authenticated = false;

  constructor() {
    this.api = axios.create({
      baseURL: 'https://backboard.railway.app/graphql',
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

      // Verify token by getting user info
      const query = `
        query {
          me {
            id
            name
            email
          }
        }
      `;

      const response = await this.api.post('', { query });
      
      if (response.data.data.me) {
        this.authenticated = true;
        return true;
      }
      return false;
    } catch (error) {
      this.authenticated = false;
      throw new Error(`Railway authentication failed: ${error}`);
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated && !!this.apiToken;
  }

  async deploy(config: DeploymentConfig, userId?: string): Promise<DeploymentResult> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Railway');
    }

    try {
      const startTime = Date.now();

      // Create or get project
      const project = await this.getOrCreateProject(config.projectName);
      
      // Create service within project
      const service = await this.createService(project.id, config);
      
      // Deploy the service
      const deployment = await this.deployService(service.id, config);

      const buildTime = Date.now() - startTime;

      return {
        platform: CloudPlatform.RAILWAY,
        deploymentId: deployment.id,
        url: deployment.url || `https://${config.projectName}.up.railway.app`,
        status: 'building',
        buildTime,
        region: deployment.region || 'us-west1',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Railway deployment failed: ${error}`);
    }
  }

  private async getOrCreateProject(name: string): Promise<any> {
    try {
      // Try to find existing project
      const findQuery = `
        query {
          projects {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `;

      const findResponse = await this.api.post('', { query: findQuery });
      const projects = findResponse.data.data.projects.edges;
      
      const existingProject = projects.find((p: any) => p.node.name === name);
      if (existingProject) {
        return existingProject.node;
      }

      // Create new project
      const createQuery = `
        mutation ProjectCreate($input: ProjectCreateInput!) {
          projectCreate(input: $input) {
            id
            name
          }
        }
      `;

      const createResponse = await this.api.post('', {
        query: createQuery,
        variables: {
          input: {
            name,
            description: `ChittyCloud deployment: ${name}`
          }
        }
      });

      return createResponse.data.data.projectCreate;
    } catch (error) {
      throw new Error(`Failed to get/create project: ${error}`);
    }
  }

  private async createService(projectId: string, config: DeploymentConfig): Promise<any> {
    try {
      const mutation = `
        mutation ServiceCreate($input: ServiceCreateInput!) {
          serviceCreate(input: $input) {
            id
            name
          }
        }
      `;

      const variables = {
        input: {
          projectId,
          name: config.projectName,
          source: {
            repo: config.projectName // This would be actual repo URL in practice
          }
        }
      };

      const response = await this.api.post('', {
        query: mutation,
        variables
      });

      return response.data.data.serviceCreate;
    } catch (error) {
      throw new Error(`Failed to create service: ${error}`);
    }
  }

  private async deployService(serviceId: string, config: DeploymentConfig): Promise<any> {
    try {
      const mutation = `
        mutation ServiceInstanceDeploy($input: ServiceInstanceDeployInput!) {
          serviceInstanceDeploy(input: $input) {
            id
            status
            url
          }
        }
      `;

      const variables = {
        input: {
          serviceId,
          environmentId: config.environment === 'production' ? 'production' : 'staging'
        }
      };

      const response = await this.api.post('', {
        query: mutation,
        variables
      });

      return response.data.data.serviceInstanceDeploy;
    } catch (error) {
      throw new Error(`Failed to deploy service: ${error}`);
    }
  }

  async getStatus(deploymentId: string): Promise<DeploymentResult> {
    try {
      const query = `
        query ServiceInstance($id: String!) {
          serviceInstance(id: $id) {
            id
            status
            url
            createdAt
            updatedAt
          }
        }
      `;

      const response = await this.api.post('', {
        query,
        variables: { id: deploymentId }
      });

      const deployment = response.data.data.serviceInstance;

      return {
        platform: CloudPlatform.RAILWAY,
        deploymentId: deployment.id,
        url: deployment.url || '',
        status: this.mapRailwayStatus(deployment.status),
        region: 'us-west1',
        timestamp: deployment.createdAt
      };
    } catch (error) {
      throw new Error(`Failed to get deployment status: ${error}`);
    }
  }

  private mapRailwayStatus(railwayStatus: string): 'pending' | 'building' | 'ready' | 'error' | 'canceled' {
    switch (railwayStatus) {
      case 'INITIALIZING':
      case 'QUEUED':
        return 'pending';
      case 'BUILDING':
      case 'DEPLOYING':
        return 'building';
      case 'SUCCESS':
      case 'RUNNING':
        return 'ready';
      case 'FAILED':
      case 'CRASHED':
        return 'error';
      case 'REMOVED':
        return 'canceled';
      default:
        return 'pending';
    }
  }

  async getDeployments(userId?: string): Promise<DeploymentResult[]> {
    try {
      const query = `
        query {
          projects {
            edges {
              node {
                id
                name
                services {
                  edges {
                    node {
                      id
                      name
                      instances {
                        edges {
                          node {
                            id
                            status
                            url
                            createdAt
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await this.api.post('', { query });
      const projects = response.data.data.projects.edges;

      const deployments: DeploymentResult[] = [];

      projects.forEach((project: any) => {
        project.node.services.edges.forEach((service: any) => {
          service.node.instances.edges.forEach((instance: any) => {
            deployments.push({
              platform: CloudPlatform.RAILWAY,
              deploymentId: instance.node.id,
              url: instance.node.url || '',
              status: this.mapRailwayStatus(instance.node.status),
              region: 'us-west1',
              timestamp: instance.node.createdAt
            });
          });
        });
      });

      return deployments;
    } catch (error) {
      throw new Error(`Failed to get deployments: ${error}`);
    }
  }

  async getCost(deploymentId: string): Promise<number> {
    try {
      // Railway charges based on resource usage
      // This would integrate with Railway's billing API
      
      const query = `
        query ServiceInstance($id: String!) {
          serviceInstance(id: $id) {
            id
            usage {
              cpu
              memory
              network
            }
          }
        }
      `;

      const response = await this.api.post('', {
        query,
        variables: { id: deploymentId }
      });

      const usage = response.data.data.serviceInstance.usage;
      
      // Rough cost calculation based on Railway pricing
      const cpuCost = (usage.cpu || 0) * 0.000463; // $0.000463 per vCPU second
      const memoryCost = (usage.memory || 0) * 0.000231; // $0.000231 per GB second
      const networkCost = (usage.network || 0) * 0.10 / (1024 * 1024 * 1024); // $0.10 per GB

      return cpuCost + memoryCost + networkCost;
    } catch (error) {
      console.warn(`Failed to get cost data: ${error}`);
      return 0;
    }
  }

  async getAnalytics(projectName: string): Promise<PlatformAnalytics> {
    try {
      const deployments = await this.getDeployments();
      const projectDeployments = deployments.filter(d => d.deploymentId.includes(projectName));

      const totalDeployments = projectDeployments.length;
      const successfulDeployments = projectDeployments.filter(d => d.status === 'ready').length;
      const successRate = totalDeployments > 0 ? successfulDeployments / totalDeployments : 0;

      // Calculate average build time (if available)
      const buildTimes = projectDeployments
        .filter(d => d.buildTime)
        .map(d => d.buildTime!);
      
      const averageBuildTime = buildTimes.length > 0 
        ? buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length 
        : 0;

      return {
        platform: CloudPlatform.RAILWAY,
        projectName,
        totalDeployments,
        successRate,
        averageBuildTime,
        totalCost: await this.getCost(projectDeployments[0]?.deploymentId || ''),
        performanceScore: successRate * 90, // Railway generally has good performance
        lastDeployment: projectDeployments[0]?.timestamp
      };
    } catch (error) {
      console.warn(`Failed to get analytics: ${error}`);
      return {
        platform: CloudPlatform.RAILWAY,
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
    try {
      const mutation = `
        mutation ProjectInvite($input: ProjectInviteInput!) {
          projectInvite(input: $input) {
            id
          }
        }
      `;

      // This is simplified - in practice you'd need to get the project ID first
      await this.api.post('', {
        query: mutation,
        variables: {
          input: {
            projectId: 'project-id', // Would get this from deployment
            email: teamId // In practice this would be team member emails
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to share with team: ${error}`);
    }
  }

  async getTeamDeployments(teamId: string): Promise<DeploymentResult[]> {
    // Railway shows all deployments the user has access to
    return this.getDeployments();
  }

  // Railway-specific methods
  async getServices(projectId: string): Promise<any[]> {
    try {
      const query = `
        query Project($id: String!) {
          project(id: $id) {
            services {
              edges {
                node {
                  id
                  name
                  createdAt
                }
              }
            }
          }
        }
      `;

      const response = await this.api.post('', {
        query,
        variables: { id: projectId }
      });

      return response.data.data.project.services.edges.map((edge: any) => edge.node);
    } catch (error) {
      throw new Error(`Failed to get services: ${error}`);
    }
  }

  async getServiceLogs(serviceId: string, limit = 100): Promise<any[]> {
    try {
      const query = `
        query ServiceLogs($serviceId: String!, $limit: Int!) {
          serviceLogs(serviceId: $serviceId, limit: $limit) {
            edges {
              node {
                timestamp
                message
                severity
              }
            }
          }
        }
      `;

      const response = await this.api.post('', {
        query,
        variables: { serviceId, limit }
      });

      return response.data.data.serviceLogs.edges.map((edge: any) => edge.node);
    } catch (error) {
      throw new Error(`Failed to get service logs: ${error}`);
    }
  }

  async setEnvironmentVariables(serviceId: string, variables: Record<string, string>): Promise<void> {
    try {
      for (const [key, value] of Object.entries(variables)) {
        const mutation = `
          mutation VariableUpsert($input: VariableUpsertInput!) {
            variableUpsert(input: $input) {
              id
            }
          }
        `;

        await this.api.post('', {
          query: mutation,
          variables: {
            input: {
              serviceId,
              name: key,
              value
            }
          }
        });
      }
    } catch (error) {
      throw new Error(`Failed to set environment variables: ${error}`);
    }
  }

  async deleteService(serviceId: string): Promise<void> {
    try {
      const mutation = `
        mutation ServiceDelete($id: String!) {
          serviceDelete(id: $id)
        }
      `;

      await this.api.post('', {
        query: mutation,
        variables: { id: serviceId }
      });
    } catch (error) {
      throw new Error(`Failed to delete service: ${error}`);
    }
  }
}