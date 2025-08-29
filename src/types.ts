import { z } from 'zod';

// ChittyID Integration Types
export const ChittyIDUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  chittyScore: z.number().min(0).max(100),
  verified: z.boolean(),
  teams: z.array(z.string()),
  platformConnections: z.record(z.string(), z.any())
});

export type ChittyIDUser = z.infer<typeof ChittyIDUserSchema>;

// Platform Types
export const CloudPlatform = {
  CLOUDFLARE: 'cloudflare',
  VERCEL: 'vercel',
  RAILWAY: 'railway',
  NETLIFY: 'netlify',
  RENDER: 'render',
  FLY: 'fly'
} as const;

export type CloudPlatform = typeof CloudPlatform[keyof typeof CloudPlatform];

export const DeploymentConfigSchema = z.object({
  platform: z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly']),
  projectName: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  buildCommand: z.string().optional(),
  outputDirectory: z.string().optional(),
  environmentVariables: z.record(z.string(), z.string()).optional(),
  domains: z.array(z.string()).optional(),
  region: z.string().optional()
});

export type DeploymentConfig = z.infer<typeof DeploymentConfigSchema>;

export const DeploymentResultSchema = z.object({
  platform: z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly']),
  deploymentId: z.string(),
  url: z.string(),
  status: z.enum(['pending', 'building', 'ready', 'error', 'canceled']),
  buildTime: z.number().optional(),
  cost: z.number().optional(),
  region: z.string().optional(),
  timestamp: z.string(),
  chittyScoreImpact: z.number().optional()
});

export type DeploymentResult = z.infer<typeof DeploymentResultSchema>;

// Platform Adapter Interface
export type CloudPlatformAdapter = {
  readonly platform: CloudPlatform;
  
  // Core Operations
  deploy(config: DeploymentConfig, chittyId?: string): Promise<DeploymentResult>;
  getStatus(deploymentId: string): Promise<DeploymentResult>;
  getDeployments(chittyId?: string): Promise<DeploymentResult[]>;
  
  // Cost & Analytics
  getCost(deploymentId: string): Promise<number>;
  getAnalytics(projectName: string): Promise<PlatformAnalytics>;
  
  // Team & Collaboration
  shareWithTeam(deploymentId: string, teamId: string): Promise<void>;
  getTeamDeployments(teamId: string): Promise<DeploymentResult[]>;
  
  // Authentication
  authenticate(credentials: Record<string, string>): Promise<boolean>;
  isAuthenticated(): boolean;
};

export const PlatformAnalyticsSchema = z.object({
  platform: z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly']),
  projectName: z.string(),
  totalDeployments: z.number(),
  successRate: z.number(),
  averageBuildTime: z.number(),
  totalCost: z.number(),
  performanceScore: z.number(),
  lastDeployment: z.string().optional()
});

export type PlatformAnalytics = z.infer<typeof PlatformAnalyticsSchema>;

// ChittyScore Integration
export const ReputationUpdateSchema = z.object({
  chittyId: z.string(),
  platform: z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly']),
  action: z.enum(['deploy', 'success', 'failure', 'optimize', 'collaborate']),
  impact: z.number(),
  metadata: z.record(z.string(), z.any()).optional()
});

export type ReputationUpdate = z.infer<typeof ReputationUpdateSchema>;

// Team Collaboration
export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(z.string()), // ChittyID user IDs
  platforms: z.array(z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly'])),
  sharedConfigs: z.array(DeploymentConfigSchema),
  permissions: z.record(z.string(), z.array(z.string()))
});

export type Team = z.infer<typeof TeamSchema>;

// Cross-Platform Intelligence
export const PlatformRecommendationSchema = z.object({
  recommendedPlatform: z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly']),
  confidence: z.number().min(0).max(1),
  reasoning: z.array(z.string()),
  estimatedCost: z.number(),
  estimatedPerformance: z.number(),
  chittyScoreBonus: z.number()
});

export type PlatformRecommendation = z.infer<typeof PlatformRecommendationSchema>;

// MCP Tool Input Schemas
export const DeployToolInputSchema = z.object({
  config: DeploymentConfigSchema,
  teamId: z.string().optional()
});

export const CostCompareInputSchema = z.object({
  config: DeploymentConfigSchema.omit({ platform: true }),
  platforms: z.array(z.enum(['cloudflare', 'vercel', 'railway', 'netlify', 'render', 'fly'])).optional()
});

export const TeamSyncInputSchema = z.object({
  teamId: z.string(),
  action: z.enum(['join', 'leave', 'share', 'sync']),
  data: z.any().optional()
});

export const ReputationInputSchema = z.object({
  chittyId: z.string().optional(),
  action: z.enum(['get', 'update', 'leaderboard'])
});

export const OptimizeConfigInputSchema = z.object({
  currentConfig: DeploymentConfigSchema,
  goals: z.array(z.enum(['cost', 'performance', 'reliability', 'chittyscore'])),
  constraints: z.record(z.string(), z.any()).optional()
});

// Error Types
export class ChittyCloudError extends Error {
  public readonly platform?: CloudPlatform;
  public readonly code?: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    platform?: CloudPlatform,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ChittyCloudError';
    this.platform = platform;
    this.code = code;
    this.details = details;
  }
}

export class AuthenticationError extends ChittyCloudError {
  constructor(platform: CloudPlatform, message = 'Authentication failed') {
    super(message, platform, 'AUTH_FAILED');
    this.name = 'AuthenticationError';
  }
}

export class DeploymentError extends ChittyCloudError {
  constructor(platform: CloudPlatform, deploymentId?: string, message = 'Deployment failed') {
    super(message, platform, 'DEPLOY_FAILED', { deploymentId });
    this.name = 'DeploymentError';
  }
}