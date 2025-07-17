/**
 * Concurrent API Request Manager
 * 
 * This service manages concurrent API requests with priority handling,
 * rate limiting compliance, and backoff strategies.
 */

export interface RequestQueueItem {
  pageNumber: number;
  priority: number;
  retryCount: number;
  dateFrom: string;
  dateTo: string;
  pageSize: number;
  id: string;
}

export interface PageResult {
  pageNumber: number;
  releases: any[];
  success: boolean;
  responseTime: number;
  error?: RequestError;
}

export interface BatchResult {
  results: PageResult[];
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  averageResponseTime: number;
  errors: RequestError[];
}

export interface RequestError {
  pageNumber: number;
  type: 'network' | 'api' | 'timeout' | 'rate_limit' | 'parsing';
  message: string;
  retryable: boolean;
  retryAfter?: number;
  statusCode?: number;
  retryCount: number;
}

export interface ConcurrentRequestConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  maxRetries: number;
  rateLimitDelay: number;
  backoffMultiplier: number;
  maxBackoffDelay: number;
}

export class ConcurrentRequestManager {
  private readonly baseUrl = 'https://ocds-api.etenders.gov.za/api/OCDSReleases';
  private readonly config: ConcurrentRequestConfig;
  private activeRequests: Map<string, Promise<PageResult>>;
  private requestQueue: RequestQueueItem[];
  private rateLimitUntil: number = 0;

  constructor(config: Partial<ConcurrentRequestConfig> = {}) {
    this.config = {
      maxConcurrentRequests: 8,
      requestTimeout: 20000, // 20 seconds
      maxRetries: 3,
      rateLimitDelay: 1000, // 1 second
      backoffMultiplier: 2,
      maxBackoffDelay: 10000, // 10 seconds
      ...config,
    };
    
    this.activeRequests = new Map();
    this.requestQueue = [];
  }

  /**
   * Process a batch of page requests concurrently
   */
  async processBatch(
    pageNumbers: number[],
    dateFrom: string,
    dateTo: string,
    pageSize: number
  ): Promise<BatchResult> {
    const startTime = Date.now();
    
    // Create queue items with priority (lower page numbers have higher priority)
    const queueItems: RequestQueueItem[] = pageNumbers.map(pageNumber => ({
      pageNumber,
      priority: pageNumber, // Lower numbers = higher priority
      retryCount: 0,
      dateFrom,
      dateTo,
      pageSize,
      id: `${pageNumber}-${Date.now()}`,
    }));
    
    // Sort by priority (ascending - lower page numbers first)
    queueItems.sort((a, b) => a.priority - b.priority);
    
    this.requestQueue = queueItems;
    
    console.log(`Processing batch of ${pageNumbers.length} requests with max concurrency: ${this.config.maxConcurrentRequests}`);
    
    const results: PageResult[] = [];
    const errors: RequestError[] = [];
    
    // Process queue until empty
    while (this.requestQueue.length > 0 || this.activeRequests.size > 0) {
      // Start new requests up to the concurrency limit
      while (
        this.activeRequests.size < this.config.maxConcurrentRequests &&
        this.requestQueue.length > 0
      ) {
        const item = this.requestQueue.shift()!;
        await this.startRequest(item);
      }
      
      // Wait for at least one request to complete
      if (this.activeRequests.size > 0) {
        const completedResult = await Promise.race(this.activeRequests.values());
        
        // Remove completed request from active requests
        for (const [id, promise] of this.activeRequests.entries()) {
          if (await Promise.resolve(promise) === completedResult) {
            this.activeRequests.delete(id);
            break;
          }
        }
        
        // Handle the result
        if (completedResult.success) {
          results.push(completedResult);
        } else {
          if (completedResult.error) {
            errors.push(completedResult.error);
            
            // Retry if retryable and under retry limit
            if (completedResult.error.retryable) {
              await this.handleRetry(completedResult);
            }
          }
        }
      }
    }
    
    const totalResponseTime = Date.now() - startTime;
    const successfulRequests = results.length;
    const failedRequests = errors.length;
    const totalRequests = successfulRequests + failedRequests;
    
    const batchResult: BatchResult = {
      results,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalResponseTime,
      averageResponseTime: results.length > 0 
        ? results.reduce((sum, r) => sum + r.responseTime, 0) / results.length 
        : 0,
      errors,
    };
    
    console.log('Batch processing completed:', {
      total: totalRequests,
      successful: successfulRequests,
      failed: failedRequests,
      totalTime: totalResponseTime,
      avgResponseTime: batchResult.averageResponseTime,
    });
    
    return batchResult;
  }

  /**
   * Start a single request and add it to active requests
   */
  private async startRequest(item: RequestQueueItem): Promise<void> {
    // Check rate limiting
    if (Date.now() < this.rateLimitUntil) {
      const delay = this.rateLimitUntil - Date.now();
      console.log(`Rate limited, waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const requestPromise = this.executeRequest(item);
    this.activeRequests.set(item.id, requestPromise);
  }

  /**
   * Execute a single API request
   */
  private async executeRequest(item: RequestQueueItem): Promise<PageResult> {
    const startTime = Date.now();
    
    try {
      const apiUrl = new URL(this.baseUrl);
      apiUrl.searchParams.set('PageNumber', item.pageNumber.toString());
      apiUrl.searchParams.set('PageSize', item.pageSize.toString());
      apiUrl.searchParams.set('dateFrom', item.dateFrom);
      apiUrl.searchParams.set('dateTo', item.dateTo);
      
      console.log(`Fetching page ${item.pageNumber} (attempt ${item.retryCount + 1})`);
      
      const response = await fetch(apiUrl.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'OCDS-Concurrent-Fetcher/1.0',
        },
        signal: AbortSignal.timeout(this.config.requestTimeout),
      });
      
      const responseTime = Date.now() - startTime;
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = this.parseRetryAfter(response.headers.get('Retry-After'));
        this.rateLimitUntil = Date.now() + retryAfter;
        
        throw new Error(`Rate limited, retry after ${retryAfter}ms`);
      }
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response structure');
      }
      
      const releases = data.releases || [];
      
      return {
        pageNumber: item.pageNumber,
        releases,
        success: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const requestError = this.classifyError(error, item.pageNumber);
      
      return {
        pageNumber: item.pageNumber,
        releases: [],
        success: false,
        responseTime,
        error: requestError,
      };
    }
  }

  /**
   * Handle retry logic for failed requests
   */
  private async handleRetry(result: PageResult): Promise<void> {
    if (!result.error || result.error.retryCount >= this.config.maxRetries) {
      return;
    }
    
    const retryItem: RequestQueueItem = {
      pageNumber: result.pageNumber,
      priority: result.pageNumber + 1000, // Lower priority for retries
      retryCount: result.error.retryCount + 1,
      dateFrom: '', // Will be set when processing
      dateTo: '',
      pageSize: 50,
      id: `retry-${result.pageNumber}-${Date.now()}`,
    };
    
    // Calculate backoff delay
    const backoffDelay = Math.min(
      this.config.rateLimitDelay * Math.pow(this.config.backoffMultiplier, retryItem.retryCount - 1),
      this.config.maxBackoffDelay
    );
    
    // Add custom retry delay if specified
    const totalDelay = Math.max(backoffDelay, result.error.retryAfter || 0);
    
    console.log(`Scheduling retry for page ${result.pageNumber} in ${totalDelay}ms (attempt ${retryItem.retryCount})`);
    
    // Schedule retry
    setTimeout(() => {
      this.requestQueue.unshift(retryItem); // Add to front for priority
    }, totalDelay);
  }

  /**
   * Parse Retry-After header value
   */
  private parseRetryAfter(retryAfterHeader: string | null): number {
    if (!retryAfterHeader) {
      return this.config.rateLimitDelay;
    }
    
    const seconds = parseInt(retryAfterHeader, 10);
    if (isNaN(seconds)) {
      return this.config.rateLimitDelay;
    }
    
    return Math.min(seconds * 1000, this.config.maxBackoffDelay);
  }

  /**
   * Classify and handle different types of errors
   */
  private classifyError(error: unknown, pageNumber: number): RequestError {
    if (error instanceof Error) {
      // Timeout errors
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          pageNumber,
          type: 'timeout',
          message: 'Request timed out',
          retryable: true,
          retryAfter: 2000,
          retryCount: 0,
        };
      }
      
      // Rate limiting
      if (error.message.includes('Rate limited')) {
        const retryAfter = this.extractRetryAfter(error.message);
        return {
          pageNumber,
          type: 'rate_limit',
          message: error.message,
          retryable: true,
          retryAfter,
          retryCount: 0,
        };
      }
      
      // API errors
      if (error.message.includes('status')) {
        const statusCode = this.extractStatusCode(error.message);
        return {
          pageNumber,
          type: 'api',
          message: error.message,
          retryable: statusCode >= 500, // Retry server errors, not client errors
          retryAfter: statusCode >= 500 ? 3000 : undefined,
          statusCode,
          retryCount: 0,
        };
      }
      
      // Network errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return {
          pageNumber,
          type: 'network',
          message: error.message,
          retryable: true,
          retryAfter: 2000,
          retryCount: 0,
        };
      }
      
      // Parsing errors
      if (error.message.includes('Invalid response')) {
        return {
          pageNumber,
          type: 'parsing',
          message: error.message,
          retryable: false,
          retryCount: 0,
        };
      }
    }
    
    // Unknown error
    return {
      pageNumber,
      type: 'network',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
      retryAfter: 3000,
      retryCount: 0,
    };
  }

  /**
   * Extract retry after value from error message
   */
  private extractRetryAfter(message: string): number {
    const match = message.match(/retry after (\d+)ms/);
    return match ? parseInt(match[1], 10) : this.config.rateLimitDelay;
  }

  /**
   * Extract status code from error message
   */
  private extractStatusCode(message: string): number {
    const match = message.match(/status: (\d+)/);
    return match ? parseInt(match[1], 10) : 500;
  }

  /**
   * Get current queue status for monitoring
   */
  getQueueStatus(): {
    queueLength: number;
    activeRequests: number;
    rateLimitedUntil: number;
  } {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      rateLimitedUntil: this.rateLimitUntil,
    };
  }
}