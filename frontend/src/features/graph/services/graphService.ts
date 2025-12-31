import apiClient from '../../../shared/services/api';
import type {
  CloneRepoResponse,
  GraphResponse,
  ApiError,
} from '../../../shared/types';

class GraphService {
  /**
   * Clone a GitHub repository
   */
    async cloneRepository(repoUrl: string): Promise<CloneRepoResponse> {
    try {
      const response = await apiClient.post('/api/repo/clone', { repoUrl });
      
      // Backend returns: { message: '...', data: { owner, name, url, ... } }
      // Transform to expected format
      if (response.data && response.data.data) {
        return {
          success: true,
          repoInfo: response.data.data,
        };
      }
      
      return {
        success: false,
        error: 'Invalid response from server',
      };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message,
      };
    }
  }

  /**
   * Get dependency graph for a repository
   */
  async getGraph(owner: string, name: string): Promise<GraphResponse> {
    try {
      const response = await apiClient.get<GraphResponse>('/api/graph', {
        params: { owner, name },
      });
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      throw new Error(apiError.message);
    }
  }

  /**
   * Parse GitHub URL to extract owner and repo name
   */
  parseGitHubUrl(url: string): { owner: string; name: string } | null {
    // Support formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    const regex = /github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/;
    const match = url.match(regex);

    if (match) {
      return {
        owner: match[1],
        name: match[2],
      };
    }

    return null;
  }

  /**
   * Validate GitHub URL format
   */
  isValidGitHubUrl(url: string): boolean {
    return this.parseGitHubUrl(url) !== null;
  }
}

// Export singleton instance
export default new GraphService();
