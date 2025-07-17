/**
 * API Discovery Service
 * 
 * This service is responsible for discovering the total available data
 * from the OCDS API and calculating optimal fetching strategies.
 */

export interface ApiDiscoveryResult {
  totalCount: number;
  totalPages: number;
  pageSize: number;
  optimalStrategy: FetchingStrategy;
  metadata: {
    dateRange: {
      from: string;
      to: string;
    };
    discoveryTime: number;
    apiResponseTime: number;
  };
}

export interface FetchingStrategy {
  recommendedConcurrency: number;
  batchSize: number;
  estimatedTotalTime: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface DiscoveryError {
  type: 'network' | 'api' | 'parsing' | 'timeout';
  message: string;
  retryable: boolean;
  retryAfter?: number;
}

export class ApiDiscoveryService {
  private readonly baseUrl = 'https://ocds-api.etenders.gov.za/api/OCDSReleases';
  private readonly defaultTimeout = 15000; // 15 seconds
  private readonly maxRetries = 3;

  /**
   * Discover total available data by fetching the first page
   * and extracting pagination information
   */
  async discoverTotalData(
    dateFrom: string = '2025-01-01',
    dateTo: string = '2025-03-31',
    pageSize: number = 50
  ): Promise<ApiDiscoveryResult> {
    const startTime = Date.now();
    
    try {
      console.log('Starting API discovery...', { dateFrom, dateTo, pageSize });
      
      const firstPageResult = await this.fetchFirstPageWithRetry(dateFrom, dateTo, pageSize);
      const discoveryTime = Date.now() - startTime;
      
      // Extract pagination information
      const totalCount = this.extractTotalCount(firstPageResult);
      const totalPages = Math.ceil(totalCount / pageSize);
      
      // Calculate optimal fetching strategy
      const optimalStrategy = this.calculateOptimalStrategy(totalCount, totalPages, pageSize);
      
      const result: ApiDiscoveryResult = {
        totalCount,
        totalPages,
        pageSize,
        optimalStrategy,
        metadata: {
          dateRange: { from: dateFrom, to: dateTo },
          discoveryTime,
          apiResponseTime: firstPageResult.responseTime,
        },
      };
      
      console.log('API discovery completed:', {
        totalCount,
        totalPages,
        strategy: optimalStrategy.recommendedConcurrency,
        discoveryTime,
      });
      
      return result;
    } catch (error) {
      console.error('API discovery failed:', error);
      throw this.handleDiscoveryError(error);
    }
  }

  /**
   * Fetch the first page with retry logic to determine total data size
   */
  private async fetchFirstPageWithRetry(
    dateFrom: string,
    dateTo: string,
    pageSize: number
  ): Promise<{ data: any; responseTime: number }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        const apiUrl = new URL(this.baseUrl);
        apiUrl.searchParams.set('PageNumber', '1');
        apiUrl.searchParams.set('PageSize', pageSize.toString());
        apiUrl.searchParams.set('dateFrom', dateFrom);
        apiUrl.searchParams.set('dateTo', dateTo);
        
        console.log(`Discovery attempt ${attempt}/${this.maxRetries}:`, apiUrl.toString());
        
        const response = await fetch(apiUrl.toString(), {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'OCDS-Discovery-Service/1.0',
          },
          signal: AbortSignal.timeout(this.defaultTimeout),
        });
        
        const responseTime = Date.now() - startTime;
        
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response structure');
        }
        
        return { data, responseTime };
      } catch (error) {
        lastError = error as Error;
        console.error(`Discovery attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Extract total count from API response
   * The OCDS API may provide total count in different ways
   */
  private extractTotalCount(result: { data: any }): number {
    const { data } = result;
    
    // Try different possible locations for total count
    if (data.totalCount && typeof data.totalCount === 'number') {
      return data.totalCount;
    }
    
    if (data.pagination?.totalCount && typeof data.pagination.totalCount === 'number') {
      return data.pagination.totalCount;
    }
    
    if (data.meta?.totalCount && typeof data.meta.totalCount === 'number') {
      return data.meta.totalCount;
    }
    
    // If no explicit total count, estimate based on releases length
    // This is a fallback - we'll need to implement pagination discovery
    if (data.releases && Array.isArray(data.releases)) {
      console.warn('No explicit total count found, using releases length as estimate');
      return data.releases.length;
    }
    
    throw new Error('Unable to determine total count from API response');
  }

  /**
   * Calculate optimal fetching strategy based on data size and performance
   */
  private calculateOptimalStrategy(
    totalCount: number,
    totalPages: number,
    pageSize: number
  ): FetchingStrategy {
    // Strategy calculation based on data size
    let recommendedConcurrency: number;
    let batchSize: number;
    let riskLevel: 'low' | 'medium' | 'high';
    let reasoning: string;
    
    if (totalCount <= 100) {
      // Small dataset - conservative approach
      recommendedConcurrency = 2;
      batchSize = 5;
      riskLevel = 'low';
      reasoning = 'Small dataset - using conservative concurrent requests';
    } else if (totalCount <= 500) {
      // Medium dataset - moderate concurrency
      recommendedConcurrency = 5;
      batchSize = 10;
      riskLevel = 'low';
      reasoning = 'Medium dataset - using moderate concurrent requests';
    } else if (totalCount <= 1000) {
      // Large dataset - higher concurrency
      recommendedConcurrency = 8;
      batchSize = 15;
      riskLevel = 'medium';
      reasoning = 'Large dataset - using higher concurrent requests with monitoring';
    } else {
      // Very large dataset - maximum safe concurrency
      recommendedConcurrency = 10;
      batchSize = 20;
      riskLevel = 'high';
      reasoning = 'Very large dataset - using maximum safe concurrent requests';
    }
    
    // Estimate total time (conservative estimate: 500ms per request + overhead)
    const estimatedTimePerBatch = 1000; // 1 second per batch including overhead
    const totalBatches = Math.ceil(totalPages / batchSize);
    const estimatedTotalTime = totalBatches * estimatedTimePerBatch;
    
    return {
      recommendedConcurrency,
      batchSize,
      estimatedTotalTime,
      riskLevel,
      reasoning,
    };
  }

  /**
   * Handle and classify discovery errors
   */
  private handleDiscoveryError(error: unknown): DiscoveryError {
    if (error instanceof Error) {
      // Network/timeout errors
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          type: 'timeout',
          message: 'Discovery request timed out',
          retryable: true,
          retryAfter: 5000,
        };
      }
      
      // Network errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return {
          type: 'network',
          message: 'Network error during discovery',
          retryable: true,
          retryAfter: 3000,
        };
      }
      
      // API errors
      if (error.message.includes('status')) {
        return {
          type: 'api',
          message: error.message,
          retryable: true,
          retryAfter: 2000,
        };
      }
      
      // Parsing errors
      if (error.message.includes('Invalid response') || error.message.includes('total count')) {
        return {
          type: 'parsing',
          message: error.message,
          retryable: false,
        };
      }
    }
    
    // Unknown error
    return {
      type: 'network',
      message: error instanceof Error ? error.message : 'Unknown discovery error',
      retryable: true,
      retryAfter: 5000,
    };
  }
}