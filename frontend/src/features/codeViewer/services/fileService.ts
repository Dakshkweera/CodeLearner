import apiClient from '../../../shared/services/api';
import type { FileContentResponse, ApiError } from '../../../shared/types';

class FileService {
  /**
   * Get file content from repository
   */
  async getFileContent(
    owner: string,
    name: string,
    path: string
  ): Promise<FileContentResponse> {
    try {
      const response = await apiClient.get<FileContentResponse>('/api/file', {
        params: { owner, name, path },
      });
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      throw new Error(apiError.message);
    }
  }

  /**
   * Detect language from file path
   */
  detectLanguage(filePath: string): 'javascript' | 'typescript' {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      return 'typescript';
    }
    return 'javascript';
  }
}

// Export singleton instance
export default new FileService();
