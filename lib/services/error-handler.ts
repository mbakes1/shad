/**
 * Comprehensive Error Handling and Recovery Service
 * 
 * This service provides error classification, retry mechanisms with exponential backoff,
 * partial failure handling with graceful degradation, and user-friendly error responses.
 */

export interface ErrorContext {
  operation: string;
  timestamp: number;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableErrors: ErrorType[];
}

export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'partial' | 'abort';
  config?: any;
  priority: number;
  description: string;
}

export interface ErrorClassification {
  type: ErrorType;
  severity: ErrorSeverity;
  category: ErrorCategory;
  retryable: boolean;
  userFriendly: boolean;
  recoveryStrategies: RecoveryStrategy[];
}

export interface PartialFailureResult<T> {
  success: boolean;
  data: T | null;
  partialData?: Partial<T>;
  errors: ClassifiedError[];
  recoveryAttempts: RecoveryAttempt[];
  userMessage: string;
  technicalDetails?: string;
}

export interface RecoveryAttempt {
  strategy: RecoveryStrategy;
  timestamp: number;
  success: boolean;
  error?: Error;
  duration: number;
}

export interface ClassifiedError {
  id: string;
  originalError: Error;
  classification: ErrorClassification;
  context: ErrorContext;
  timestamp: number;
  retryCount: number;
  recoveryAttempts: RecoveryAttempt[];
  userMessage: string;
  technicalMessage: string;
}

export enum ErrorType {
  NETWORK = 'network',
  API = 'api',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  PARSING = 'parsing',
  VALIDATION = 'validation',
  CACHE = 'cache',
  MEMORY = 'memory',
  CONFIGURATION = 'configuration',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  TRANSIENT = 'transient',
  PERMANENT = 'permanent',
  CONFIGURATION = 'configuration',
  USER_INPUT = 'user_input',
  SYSTEM = 'system',
}

export class ComprehensiveErrorHandler {
  private retryConfig: RetryConfig;
  private errorHistory: Map<string, ClassifiedError[]> = new Map();
  private recoveryStrategies: Map<ErrorType, RecoveryStrategy[]> = new Map();

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      retryableErrors: [
        ErrorType.NETWORK,
        ErrorType.TIMEOUT,
        ErrorType.RATE_LIMIT,
        ErrorType.API,
      ],
      ...retryConfig,
    };

    this.setupRecoveryStrategies();
  }

  /**
   * Classify an error and determine recovery strategies
   */
  classifyError(error: Error, context: ErrorContext): ClassifiedError {
    const errorId = this.generateErrorId();
    const classification = this.determineClassification(error);
    
    const classifiedError: ClassifiedError = {
      id: errorId,
      originalError: error,
      classification,
      context,
      timestamp: Date.now(),
      retryCount: 0,
      recoveryAttempts: [],
      userMessage: this.generateUserMessage(error, classification),
      technicalMessage: this.generateTechnicalMessage(error, context),
    };

    // Store in error history
    const contextKey = `${context.operation}-${context.requestId || 'unknown'}`;
    if (!this.errorHistory.has(contextKey)) {
      this.errorHistory.set(contextKey, []);
    }
    this.errorHistory.get(contextKey)!.push(classifiedError);

    return classifiedError;
  }

  /**
   * Handle error with automatic recovery attempts
   */
  async handleError<T>(
    error: Error,
    context: ErrorContext,
    operation: () => Promise<T>
  ): Promise<PartialFailureResult<T>> {
    const classifiedError = this.classifyError(error, context);
    const recoveryAttempts: RecoveryAttempt[] = [];

    console.log('Handling error:', {
      errorId: classifiedError.id,
      type: classifiedError.classification.type,
      severity: classifiedError.classification.severity,
      retryable: classifiedError.classification.retryable,
    });

    // Try recovery strategies in priority order
    for (const strategy of classifiedError.classification.recoveryStrategies) {
      const attemptStartTime = Date.now();
      
      try {
        console.log(`Attempting recovery strategy: ${strategy.type}`, {
          errorId: classifiedError.id,
          strategy: strategy.description,
        });

        const result = await this.executeRecoveryStrategy(
          strategy,
          classifiedError,
          operation
        );

        const attempt: RecoveryAttempt = {
          strategy,
          timestamp: attemptStartTime,
          success: true,
          duration: Date.now() - attemptStartTime,
        };

        recoveryAttempts.push(attempt);
        classifiedError.recoveryAttempts.push(attempt);

        if (result.success) {
          return {
            success: true,
            data: result.data,
            errors: [classifiedError],
            recoveryAttempts,
            userMessage: 'Operation completed successfully after recovery',
          };
        }

        // Partial success
        if (result.partialData) {
          return {
            success: false,
            data: null,
            partialData: result.partialData,
            errors: [classifiedError],
            recoveryAttempts,
            userMessage: 'Operation partially completed with some issues',
            technicalDetails: classifiedError.technicalMessage,
          };
        }

      } catch (recoveryError) {
        const attempt: RecoveryAttempt = {
          strategy,
          timestamp: attemptStartTime,
          success: false,
          error: recoveryError as Error,
          duration: Date.now() - attemptStartTime,
        };

        recoveryAttempts.push(attempt);
        classifiedError.recoveryAttempts.push(attempt);

        console.warn(`Recovery strategy failed: ${strategy.type}`, {
          errorId: classifiedError.id,
          recoveryError: recoveryError instanceof Error ? recoveryError.message : recoveryError,
        });
      }
    }

    // All recovery strategies failed
    return {
      success: false,
      data: null,
      errors: [classifiedError],
      recoveryAttempts,
      userMessage: classifiedError.userMessage,
      technicalDetails: classifiedError.technicalMessage,
    };
  }

  /**
   * Execute retry with exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: Error;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateBackoffDelay(attempt, config);
          console.log(`Retry attempt ${attempt}/${config.maxRetries} after ${delay}ms`, {
            operation: context.operation,
            requestId: context.requestId,
          });
          await this.sleep(delay);
        }

        return await operation();
      } catch (error) {
        lastError = error as Error;
        const classifiedError = this.classifyError(lastError, context);
        
        // Check if error is retryable
        if (!config.retryableErrors.includes(classifiedError.classification.type)) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === config.maxRetries) {
          throw lastError;
        }

        console.warn(`Attempt ${attempt + 1} failed, retrying...`, {
          error: lastError.message,
          errorType: classifiedError.classification.type,
          operation: context.operation,
        });
      }
    }

    throw lastError!;
  }

  /**
   * Handle partial failures with graceful degradation
   */
  async handlePartialFailure<T>(
    results: Array<{ success: boolean; data?: T; error?: Error }>,
    context: ErrorContext,
    minimumSuccessThreshold: number = 0.5
  ): Promise<PartialFailureResult<T[]>> {
    const successful = results.filter(r => r.success && r.data);
    const failed = results.filter(r => !r.success);
    const successRate = successful.length / results.length;

    const errors = failed.map(f => 
      this.classifyError(f.error || new Error('Unknown failure'), context)
    );

    if (successRate >= minimumSuccessThreshold) {
      return {
        success: true,
        data: successful.map(r => r.data!),
        errors,
        recoveryAttempts: [],
        userMessage: failed.length > 0 
          ? `Operation completed with ${failed.length} minor issues`
          : 'Operation completed successfully',
        technicalDetails: failed.length > 0 
          ? `${failed.length} out of ${results.length} operations failed`
          : undefined,
      };
    }

    // Below threshold - attempt recovery
    const recoveryResult = await this.attemptPartialRecovery(failed, context);
    
    return {
      success: false,
      data: null,
      partialData: successful.map(r => r.data!),
      errors: [...errors, ...recoveryResult.errors],
      recoveryAttempts: recoveryResult.recoveryAttempts,
      userMessage: `Operation partially failed. ${successful.length} out of ${results.length} completed successfully.`,
      technicalDetails: `Success rate: ${Math.round(successRate * 100)}%, below threshold of ${Math.round(minimumSuccessThreshold * 100)}%`,
    };
  }

  /**
   * Get error statistics and patterns
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recoverySuccessRate: number;
    commonPatterns: string[];
  } {
    const allErrors = Array.from(this.errorHistory.values()).flat();
    
    const errorsByType = allErrors.reduce((acc, error) => {
      acc[error.classification.type] = (acc[error.classification.type] || 0) + 1;
      return acc;
    }, {} as Record<ErrorType, number>);

    const errorsBySeverity = allErrors.reduce((acc, error) => {
      acc[error.classification.severity] = (acc[error.classification.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    const totalRecoveryAttempts = allErrors.reduce((sum, error) => 
      sum + error.recoveryAttempts.length, 0
    );
    const successfulRecoveries = allErrors.reduce((sum, error) => 
      sum + error.recoveryAttempts.filter(attempt => attempt.success).length, 0
    );

    return {
      totalErrors: allErrors.length,
      errorsByType,
      errorsBySeverity,
      recoverySuccessRate: totalRecoveryAttempts > 0 
        ? successfulRecoveries / totalRecoveryAttempts 
        : 0,
      commonPatterns: this.identifyCommonPatterns(allErrors),
    };
  }

  // Private methods

  private determineClassification(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (message.includes('fetch') || message.includes('network') || name.includes('network')) {
      return {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.TRANSIENT,
        retryable: true,
        userFriendly: true,
        recoveryStrategies: this.recoveryStrategies.get(ErrorType.NETWORK) || [],
      };
    }

    // Timeout errors
    if (message.includes('timeout') || name.includes('timeout') || name.includes('abort')) {
      return {
        type: ErrorType.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.TRANSIENT,
        retryable: true,
        userFriendly: true,
        recoveryStrategies: this.recoveryStrategies.get(ErrorType.TIMEOUT) || [],
      };
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('429')) {
      return {
        type: ErrorType.RATE_LIMIT,
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.TRANSIENT,
        retryable: true,
        userFriendly: true,
        recoveryStrategies: this.recoveryStrategies.get(ErrorType.RATE_LIMIT) || [],
      };
    }

    // API errors
    if (message.includes('api') || message.includes('status') || message.includes('http')) {
      return {
        type: ErrorType.API,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.TRANSIENT,
        retryable: true,
        userFriendly: true,
        recoveryStrategies: this.recoveryStrategies.get(ErrorType.API) || [],
      };
    }

    // Parsing errors
    if (message.includes('parse') || message.includes('json') || message.includes('invalid')) {
      return {
        type: ErrorType.PARSING,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.PERMANENT,
        retryable: false,
        userFriendly: false,
        recoveryStrategies: this.recoveryStrategies.get(ErrorType.PARSING) || [],
      };
    }

    // Memory errors
    if (message.includes('memory') || message.includes('heap')) {
      return {
        type: ErrorType.MEMORY,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.SYSTEM,
        retryable: false,
        userFriendly: true,
        recoveryStrategies: this.recoveryStrategies.get(ErrorType.MEMORY) || [],
      };
    }

    // Default classification
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.TRANSIENT,
      retryable: true,
      userFriendly: false,
      recoveryStrategies: this.recoveryStrategies.get(ErrorType.UNKNOWN) || [],
    };
  }

  private setupRecoveryStrategies(): void {
    // Network error strategies
    this.recoveryStrategies.set(ErrorType.NETWORK, [
      {
        type: 'retry',
        priority: 1,
        description: 'Retry with exponential backoff',
        config: { maxRetries: 3, baseDelay: 2000 },
      },
      {
        type: 'fallback',
        priority: 2,
        description: 'Use cached data if available',
      },
    ]);

    // Timeout error strategies
    this.recoveryStrategies.set(ErrorType.TIMEOUT, [
      {
        type: 'retry',
        priority: 1,
        description: 'Retry with increased timeout',
        config: { maxRetries: 2, baseDelay: 1000 },
      },
      {
        type: 'partial',
        priority: 2,
        description: 'Continue with partial data',
      },
    ]);

    // Rate limit strategies
    this.recoveryStrategies.set(ErrorType.RATE_LIMIT, [
      {
        type: 'retry',
        priority: 1,
        description: 'Wait and retry with backoff',
        config: { maxRetries: 5, baseDelay: 5000 },
      },
    ]);

    // API error strategies
    this.recoveryStrategies.set(ErrorType.API, [
      {
        type: 'retry',
        priority: 1,
        description: 'Retry API request',
        config: { maxRetries: 2, baseDelay: 1500 },
      },
      {
        type: 'fallback',
        priority: 2,
        description: 'Use alternative data source',
      },
    ]);

    // Memory error strategies
    this.recoveryStrategies.set(ErrorType.MEMORY, [
      {
        type: 'partial',
        priority: 1,
        description: 'Process data in smaller chunks',
      },
      {
        type: 'fallback',
        priority: 2,
        description: 'Use cached or simplified data',
      },
    ]);
  }

  private async executeRecoveryStrategy<T>(
    strategy: RecoveryStrategy,
    error: ClassifiedError,
    operation: () => Promise<T>
  ): Promise<{ success: boolean; data?: T; partialData?: Partial<T> }> {
    switch (strategy.type) {
      case 'retry':
        try {
          const data = await this.executeWithRetry(
            operation,
            error.context,
            strategy.config
          );
          return { success: true, data };
        } catch (retryError) {
          return { success: false };
        }

      case 'fallback':
        // This would typically involve using cached data or alternative sources
        // For now, we'll return a placeholder implementation
        return { success: false };

      case 'partial':
        // This would involve continuing with partial data
        return { success: false, partialData: {} as Partial<T> };

      case 'abort':
        return { success: false };

      default:
        return { success: false };
    }
  }

  private async attemptPartialRecovery(
    failedResults: Array<{ success: boolean; error?: Error }>,
    context: ErrorContext
  ): Promise<{ errors: ClassifiedError[]; recoveryAttempts: RecoveryAttempt[] }> {
    const errors: ClassifiedError[] = [];
    const recoveryAttempts: RecoveryAttempt[] = [];

    for (const failed of failedResults) {
      if (failed.error) {
        const classifiedError = this.classifyError(failed.error, context);
        errors.push(classifiedError);
      }
    }

    return { errors, recoveryAttempts };
  }

  private calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitterEnabled) {
      delay += Math.random() * 1000; // Add up to 1 second of jitter
    }

    return Math.round(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUserMessage(error: Error, classification: ErrorClassification): string {
    if (!classification.userFriendly) {
      return 'An unexpected error occurred. Please try again or contact support.';
    }

    switch (classification.type) {
      case ErrorType.NETWORK:
        return 'Network connection issue. Please check your internet connection and try again.';
      case ErrorType.TIMEOUT:
        return 'The request took too long to complete. Please try again.';
      case ErrorType.RATE_LIMIT:
        return 'Too many requests. Please wait a moment and try again.';
      case ErrorType.API:
        return 'Service temporarily unavailable. Please try again in a few moments.';
      case ErrorType.MEMORY:
        return 'The request is too large to process. Please try with a smaller date range.';
      default:
        return 'An error occurred while processing your request. Please try again.';
    }
  }

  private generateTechnicalMessage(error: Error, context: ErrorContext): string {
    return `${error.name}: ${error.message} | Operation: ${context.operation} | Timestamp: ${new Date(context.timestamp).toISOString()}`;
  }

  private identifyCommonPatterns(errors: ClassifiedError[]): string[] {
    const patterns: string[] = [];
    const errorMessages = errors.map(e => e.originalError.message);
    
    // Simple pattern detection - in production, you might want more sophisticated analysis
    const messageCounts = errorMessages.reduce((acc, msg) => {
      acc[msg] = (acc[msg] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(messageCounts)
      .filter(([_, count]) => count > 1)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .forEach(([message, count]) => {
        patterns.push(`"${message}" (${count} occurrences)`);
      });

    return patterns;
  }
}

// Singleton instance for global use
let globalErrorHandler: ComprehensiveErrorHandler | null = null;

export function getErrorHandler(config?: Partial<RetryConfig>): ComprehensiveErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ComprehensiveErrorHandler(config);
  }
  return globalErrorHandler;
}