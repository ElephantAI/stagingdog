import axios, { type AxiosError, type AxiosResponse } from 'axios';

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  /**
   * Check if the server is healthy
   */
  public async checkHealth(): Promise<HealthCheckResponse> {
    try {
      const response: AxiosResponse<HealthCheckResponse> = await axios.get(
        `${this.baseUrl}/health`
      );
      return response.data;
    } catch (error) {
      this.handleRequestError(error as AxiosError);
      throw error;
    }
  }

  /**
   * Handle API request errors
   */
  private handleRequestError(error: AxiosError): void {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error: No response received', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error:', error.message);
    }
  }
}

// Example usage
if (import.meta.url.endsWith(process.argv[1])) {
  (async () => {
    const client = new ApiClient();
    
    try {
      console.log('Checking server health...');
      const health = await client.checkHealth();
      console.log('Server health:', health);
    } catch (error) {
      console.error('Failed to check server health:', error);
      process.exit(1);
    }
  })();
}

export default ApiClient;
