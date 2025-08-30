import axios, { AxiosInstance } from 'axios';
import { ChittyIDUser, ReputationUpdate, Team, AuthenticationError } from '../types.js';

export class ChittyIDClient {
  private api: AxiosInstance;
  private currentUser: ChittyIDUser | null = null;
  private authToken: string | null = null;

  constructor(
    private readonly apiUrl: string = process.env.CHITTYID_API_URL || 'https://id.chitty.cc',
    private readonly apiKey: string = process.env.CHITTY_API_KEY || ''
  ) {
    this.api = axios.create({
      baseURL: this.apiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChittyCloud-MCP/1.0.0'
      }
    });

    // Add auth interceptor
    this.api.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      } else if (this.apiKey) {
        config.headers['X-API-Key'] = this.apiKey;
      }
      return config;
    });

    // Add error interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.currentUser = null;
          this.authToken = null;
          throw new AuthenticationError('chittyid' as any, 'ChittyID authentication expired');
        }
        throw error;
      }
    );
  }

  /**
   * Authenticate with ChittyID using various methods
   */
  async authenticate(credentials: {
    method: 'token' | 'apikey' | 'oauth';
    token?: string;
    apiKey?: string;
    code?: string;
  }): Promise<ChittyIDUser> {
    try {
      let response;

      switch (credentials.method) {
        case 'token':
          this.authToken = credentials.token!;
          response = await this.api.get('/user/me');
          break;
        case 'apikey':
          response = await this.api.post('/auth/apikey', {
            apiKey: credentials.apiKey
          });
          this.authToken = response.data.token;
          break;
        case 'oauth':
          response = await this.api.post('/auth/oauth/exchange', {
            code: credentials.code
          });
          this.authToken = response.data.token;
          break;
        default:
          throw new Error('Invalid authentication method');
      }

      this.currentUser = response.data.user || response.data;
      return this.currentUser;
    } catch (error) {
      throw new AuthenticationError('chittyid' as any, `ChittyID authentication failed: ${error}`);
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): ChittyIDUser | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.authToken !== null;
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<ChittyIDUser> {
    try {
      const response = await this.api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get user ${userId}: ${error}`);
    }
  }

  /**
   * Update ChittyScore based on platform actions
   */
  async updateReputation(update: ReputationUpdate): Promise<void> {
    try {
      await this.api.post('/reputation/update', update);
    } catch (error) {
      console.warn(`Failed to update reputation: ${error}`);
      // Don't throw - reputation updates should be best-effort
    }
  }

  /**
   * Get user's current ChittyScore
   */
  async getChittyScore(userId?: string): Promise<number> {
    try {
      const targetUserId = userId || this.currentUser?.id;
      if (!targetUserId) {
        throw new Error('No user ID provided and no authenticated user');
      }

      const response = await this.api.get(`/reputation/${targetUserId}`);
      return response.data.chittyScore;
    } catch (error) {
      console.warn(`Failed to get ChittyScore: ${error}`);
      return 0; // Default score if API fails
    }
  }

  /**
   * Get ChittyScore leaderboard
   */
  async getLeaderboard(limit = 10, platform?: string): Promise<Array<{
    user: ChittyIDUser;
    chittyScore: number;
    rank: number;
  }>> {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (platform) params.set('platform', platform);

      const response = await this.api.get(`/reputation/leaderboard?${params}`);
      return response.data;
    } catch (error) {
      console.warn(`Failed to get leaderboard: ${error}`);
      return [];
    }
  }

  /**
   * Team Management
   */
  async getTeam(teamId: string): Promise<Team> {
    try {
      const response = await this.api.get(`/teams/${teamId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get team ${teamId}: ${error}`);
    }
  }

  async getUserTeams(): Promise<Team[]> {
    try {
      const response = await this.api.get('/teams/user');
      return response.data;
    } catch (error) {
      console.warn(`Failed to get user teams: ${error}`);
      return [];
    }
  }

  async createTeam(team: Omit<Team, 'id'>): Promise<Team> {
    try {
      const response = await this.api.post('/teams', team);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create team: ${error}`);
    }
  }

  async inviteToTeam(teamId: string, userIds: string[]): Promise<void> {
    try {
      await this.api.post(`/teams/${teamId}/invite`, { userIds });
    } catch (error) {
      throw new Error(`Failed to invite users to team: ${error}`);
    }
  }

  /**
   * Platform Connection Management
   */
  async connectPlatform(platform: string, credentials: Record<string, string>): Promise<void> {
    try {
      await this.api.post('/platforms/connect', {
        platform,
        credentials
      });
      
      // Refresh current user to get updated platform connections
      if (this.currentUser) {
        const updatedUser = await this.api.get('/user/me');
        this.currentUser = updatedUser.data;
      }
    } catch (error) {
      throw new Error(`Failed to connect platform ${platform}: ${error}`);
    }
  }

  async disconnectPlatform(platform: string): Promise<void> {
    try {
      await this.api.delete(`/platforms/${platform}`);
      
      // Refresh current user to get updated platform connections
      if (this.currentUser) {
        const updatedUser = await this.api.get('/user/me');
        this.currentUser = updatedUser.data;
      }
    } catch (error) {
      throw new Error(`Failed to disconnect platform ${platform}: ${error}`);
    }
  }

  /**
   * Usage Analytics for ChittyScore calculation
   */
  async trackUsage(action: string, platform: string, metadata?: Record<string, any>): Promise<void> {
    try {
      await this.api.post('/analytics/track', {
        action,
        platform,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn(`Failed to track usage: ${error}`);
      // Don't throw - analytics tracking should be best-effort
    }
  }

  /**
   * Get user's platform usage statistics
   */
  async getPlatformStats(userId?: string): Promise<Record<string, {
    deployments: number;
    successRate: number;
    averageBuildTime: number;
    chittyScoreContribution: number;
  }>> {
    try {
      const targetUserId = userId || this.currentUser?.id;
      if (!targetUserId) {
        throw new Error('No user ID provided and no authenticated user');
      }

      const response = await this.api.get(`/analytics/platforms/${targetUserId}`);
      return response.data;
    } catch (error) {
      console.warn(`Failed to get platform stats: ${error}`);
      return {};
    }
  }

  /**
   * Logout and clear authentication
   */
  async logout(): Promise<void> {
    try {
      if (this.authToken) {
        await this.api.post('/auth/logout');
      }
    } catch (error) {
      console.warn(`Logout failed: ${error}`);
    } finally {
      this.currentUser = null;
      this.authToken = null;
    }
  }
}