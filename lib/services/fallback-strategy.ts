/**
 * Fallback Strategy Service
 * 
 * This service provides fallback strategies for API failures including:
 * - Cached data fallback when live data is unavailable
 * - Offline-friendly error states with cached data display
 * - Automatic retry scheduling for failed requests
 */

import { getCacheManager, TenderCacheManager, CacheKeyOptions } from './cache-manager'
import { getErrorHandler, ComprehensiveErrorHandler, ErrorType, ErrorSeverity } from './error-handler'
import { EnhancedTenderInfo, PerformanceMetrics, FetchError } from '@/lib/hooks/use-comprehensive-tenders'

export interface FallbackConfig {
  enableCachedFallback: boolean
  maxCacheAge: number // Maximum age of cached data to use as fallback (in milliseconds)
  retrySchedule: number[] // Retry delays in milliseconds
  maxRetryAttempts: number
  gracefulDegradationThreshold: number // Minimum success rate to continue with partial data
  offlineDetection: boolean
  backgroundRefresh: boolean
}

export interface FallbackResult<T> {
  data: T | null
  source: 'live' | 'cache' | 'partial' | 'none'
  isFallback: boolean
  cacheAge?: number
  warnings: string[]
  errors: FetchError[]
  retryScheduled?: {
    nextRetry: number
    attempt: number
    maxAttempts: number
  }
  performance?: PerformanceMetrics
}

export interface RetrySchedule {
  requestId: string
  operation: () => Promise<any>
  attempt: number
  maxAttempts: number
  nextRetry: number
  lastError?: FetchError
  onSuccess?: (data: any) => void
  onFailure?: (error: FetchError) => void
}

export interface OfflineState {
  isOffline: boolean
  lastOnline: number
  connectionQuality: 'good' | 'poor' | 'offline'
  estimatedBandwidth?: number
}

export class FallbackStrategyService {
  private cacheManager: TenderCacheManager
  private errorHandler: ComprehensiveErrorHandler
  private config: FallbackConfig
  private retryQueue: Map<string, RetrySchedule> = new Map()
  private retryTimers: Map<string, NodeJS.Timeout> = new Map()
  private offlineState: OfflineState = {
    isOffline: false,
    lastOnline: Date.now(),
    connectionQuality: 'good'
  }

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = {
      enableCachedFallback: true,
      maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
      retrySchedule: [1000, 2000, 5000, 10000, 30000], // Progressive delays
      maxRetryAttempts: 5,
      gracefulDegradationThreshold: 0.7, // 70% success rate
      offlineDetection: true,
      backgroundRefresh: true,
      ...config
    }

    this.cacheManager = getCacheManager()
    this.errorHandler = getErrorHandler()

    if (this.config.offlineDetection) {
      this.setupOfflineDetection()
    }

    console.log('FallbackStrategyService initialized:', this.config)
  }

  /**
   * Execute operation with comprehensive fallback strategies
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    cacheKey: string,
    options: {
      cacheKeyOptions?: CacheKeyOptions
      operationName?: string
      allowPartialData?: boolean
      customRetrySchedule?: number[]
    } = {}
  ): Promise<FallbackResult<T>> {
    const {
      cacheKeyOptions,
      operationName = 'api-request',
      allowPartialData = true,
      customRetrySchedule
    } = options

    const startTime = Date.now()
    let warnings: string[] = []
    let errors: FetchError[] = []

    try {
      // First, try the live operation
      console.log('Attempting live operation:', { operationName, cacheKey })
      
      const liveData = await operation()
      
      // Success - cache the result and return
      if (this.config.enableCachedFallback) {
        await this.cacheManager.set(cacheKey, liveData)
      }

      return {
        data: liveData,
        source: 'live',
        isFallback: false,
        warnings,
        errors,
        performance: {
          totalFetchTime: Date.now() - startTime,
          averageRequestTime: Date.now() - startTime,
          cacheHitRate: 0,
          errorRate: 0,
          discoveryTime: 0,
          aggregationTime: 0
        }
      }

    } catch (error) {
      console.warn('Live operation failed, attempting fallback strategies:', {
        operationName,
        error: error instanceof Error ? error.message : error
      })

      const fetchError: FetchError = {
        type: this.classifyErrorType(error),
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
        statusCode: this.extractStatusCode(error)
      }

      errors.push(fetchError)

      // Strategy 1: Try cached data fallback
      if (this.config.enableCachedFallback) {
        const cachedResult = await this.tryCache(cacheKey)
        if (cachedResult.success) {
          warnings.push(`Using cached data from ${this.formatCacheAge(cachedResult.age!)}`)
          
          // Schedule background refresh if appropriate
          if (this.config.backgroundRefresh && fetchError.retryable) {
            this.scheduleRetry(cacheKey, operation, {
              operationName,
              isBackground: true,
              onSuccess: (data) => {
                // Update cache with fresh data
                this.cacheManager.set(cacheKey, data)
              }
            })
          }

          return {
            data: cachedResult.data,
            source: 'cache',
            isFallback: true,
            cacheAge: cachedResult.age,
            warnings,
            errors,
            performance: {
              totalFetchTime: Date.now() - startTime,
              averageRequestTime: 0,
              cacheHitRate: 1,
              errorRate: 1,
              discoveryTime: 0,
              aggregationTime: 0
            }
          }
        }
      }

      // Strategy 2: Try partial data recovery (if applicable)
      if (allowPartialData) {
        const partialResult = await this.tryPartialRecovery<T>(operation, fetchError)
        if (partialResult.success) {
          warnings.push('Partial data recovered from alternative sources')
          
          return {
            data: partialResult.data,
            source: 'partial',
            isFallback: true,
            warnings,
            errors,
            performance: {
              totalFetchTime: Date.now() - startTime,
              averageRequestTime: Date.now() - startTime,
              cacheHitRate: 0,
              errorRate: 0.5,
              discoveryTime: 0,
              aggregationTime: 0
            }
          }
        }
      }

      // Strategy 3: Schedule retry for later
      const retryInfo = this.scheduleRetry(cacheKey, operation, {
        operationName,
        customSchedule: customRetrySchedule,
        onSuccess: (data) => {
          console.log('Scheduled retry succeeded:', { operationName, cacheKey })
          if (this.config.enableCachedFallback) {
            this.cacheManager.set(cacheKey, data)
          }
        },
        onFailure: (retryError) => {
          console.warn('Scheduled retry failed:', { operationName, cacheKey, error: retryError.message })
        }
      })

      // Return failure with retry information
      return {
        data: null,
        source: 'none',
        isFallback: true,
        warnings,
        errors,
        retryScheduled: retryInfo,
        performance: {
          totalFetchTime: Date.now() - startTime,
          averageRequestTime: Date.now() - startTime,
          cacheHitRate: 0,
          errorRate: 1,
          discoveryTime: 0,
          aggregationTime: 0
        }
      }
    }
  }

  /**
   * Get offline-friendly error state with cached data
   */
  async getOfflineState<T>(cacheKey: string): Promise<{
    hasOfflineData: boolean
    offlineData?: T
    cacheAge?: number
    isStale: boolean
    recommendations: string[]
  }> {
    const cachedResult = await this.tryCache<T>(cacheKey)
    const recommendations: string[] = []

    if (!cachedResult.success) {
      recommendations.push('No offline data available')
      recommendations.push('Try again when connection is restored')
      
      return {
        hasOfflineData: false,
        isStale: false,
        recommendations
      }
    }

    const isStale = cachedResult.age! > this.config.maxCacheAge / 2 // Consider stale if older than half max age
    
    if (isStale) {
      recommendations.push('Cached data is outdated')
      recommendations.push('Results may not reflect recent changes')
    } else {
      recommendations.push('Using recent cached data')
    }

    if (this.offlineState.isOffline) {
      recommendations.push('Working in offline mode')
      recommendations.push('Data will refresh when connection is restored')
    }

    return {
      hasOfflineData: true,
      offlineData: cachedResult.data,
      cacheAge: cachedResult.age,
      isStale,
      recommendations
    }
  }

  /**
   * Check if system is in offline mode
   */
  isOffline(): boolean {
    return this.offlineState.isOffline
  }

  /**
   * Get connection quality information
   */
  getConnectionQuality(): OfflineState {
    return { ...this.offlineState }
  }

  /**
   * Manually trigger retry for failed operations
   */
  async retryFailedOperations(): Promise<{
    attempted: number
    succeeded: number
    failed: number
  }> {
    const results = { attempted: 0, succeeded: 0, failed: 0 }
    
    for (const [requestId, schedule] of this.retryQueue.entries()) {
      results.attempted++
      
      try {
        const data = await schedule.operation()
        
        if (schedule.onSuccess) {
          schedule.onSuccess(data)
        }
        
        // Remove from retry queue
        this.retryQueue.delete(requestId)
        const timer = this.retryTimers.get(requestId)
        if (timer) {
          clearTimeout(timer)
          this.retryTimers.delete(requestId)
        }
        
        results.succeeded++
        console.log('Manual retry succeeded:', { requestId })
        
      } catch (error) {
        results.failed++
        console.warn('Manual retry failed:', { requestId, error })
        
        if (schedule.onFailure) {
          schedule.onFailure({
            type: this.classifyErrorType(error),
            message: error instanceof Error ? error.message : 'Retry failed',
            retryable: true
          })
        }
      }
    }
    
    return results
  }

  /**
   * Clear all scheduled retries
   */
  clearRetryQueue(): void {
    // Clear all timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer)
    }
    
    this.retryQueue.clear()
    this.retryTimers.clear()
    
    console.log('Retry queue cleared')
  }

  /**
   * Get retry queue status
   */
  getRetryQueueStatus(): {
    totalScheduled: number
    nextRetry?: number
    operations: Array<{
      requestId: string
      attempt: number
      maxAttempts: number
      nextRetry: number
    }>
  } {
    const operations = Array.from(this.retryQueue.entries()).map(([requestId, schedule]) => ({
      requestId,
      attempt: schedule.attempt,
      maxAttempts: schedule.maxAttempts,
      nextRetry: schedule.nextRetry
    }))

    const nextRetry = operations.length > 0 
      ? Math.min(...operations.map(op => op.nextRetry))
      : undefined

    return {
      totalScheduled: this.retryQueue.size,
      nextRetry,
      operations
    }
  }

  /**
   * Destroy service and cleanup resources
   */
  destroy(): void {
    this.clearRetryQueue()
    
    // Remove offline detection listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
    
    console.log('FallbackStrategyService destroyed')
  }

  // Private methods

  private async tryCache<T>(cacheKey: string): Promise<{
    success: boolean
    data?: T
    age?: number
  }> {
    try {
      const cachedData = await this.cacheManager.get<T>(cacheKey)
      
      if (!cachedData) {
        return { success: false }
      }

      // Check cache age (this is a simplified approach)
      const stats = await this.cacheManager.getStats()
      const estimatedAge = Date.now() - stats.newestEntry // Rough estimate
      
      if (estimatedAge > this.config.maxCacheAge) {
        console.log('Cached data too old, rejecting fallback:', {
          cacheKey,
          age: estimatedAge,
          maxAge: this.config.maxCacheAge
        })
        return { success: false }
      }

      return {
        success: true,
        data: cachedData,
        age: estimatedAge
      }
    } catch (error) {
      console.warn('Cache fallback failed:', error)
      return { success: false }
    }
  }

  private async tryPartialRecovery<T>(
    operation: () => Promise<T>,
    originalError: FetchError
  ): Promise<{ success: boolean; data?: T }> {
    // This is a placeholder for partial recovery logic
    // In a real implementation, you might try alternative endpoints,
    // reduced data sets, or other recovery mechanisms
    
    try {
      // Example: Try with reduced parameters or alternative approach
      // This would be specific to your API and data structure
      console.log('Attempting partial recovery...')
      
      // For now, return failure - implement specific recovery logic as needed
      return { success: false }
    } catch (error) {
      return { success: false }
    }
  }

  private scheduleRetry(
    cacheKey: string,
    operation: () => Promise<any>,
    options: {
      operationName?: string
      customSchedule?: number[]
      isBackground?: boolean
      onSuccess?: (data: any) => void
      onFailure?: (error: FetchError) => void
    } = {}
  ): {
    nextRetry: number
    attempt: number
    maxAttempts: number
  } {
    const {
      operationName = 'unknown',
      customSchedule,
      isBackground = false,
      onSuccess,
      onFailure
    } = options

    const requestId = `${cacheKey}-${Date.now()}`
    const schedule = customSchedule || this.config.retrySchedule
    const maxAttempts = this.config.maxRetryAttempts
    
    // Check if already scheduled
    const existing = this.retryQueue.get(requestId)
    const attempt = existing ? existing.attempt + 1 : 1
    
    if (attempt > maxAttempts) {
      console.log('Max retry attempts reached:', { requestId, attempt, maxAttempts })
      return { nextRetry: 0, attempt, maxAttempts }
    }

    const delay = schedule[Math.min(attempt - 1, schedule.length - 1)]
    const nextRetry = Date.now() + delay

    const retrySchedule: RetrySchedule = {
      requestId,
      operation,
      attempt,
      maxAttempts,
      nextRetry,
      onSuccess,
      onFailure
    }

    this.retryQueue.set(requestId, retrySchedule)

    // Schedule the retry
    const timer = setTimeout(async () => {
      try {
        console.log('Executing scheduled retry:', {
          requestId,
          attempt,
          operationName,
          isBackground
        })

        const data = await operation()
        
        if (onSuccess) {
          onSuccess(data)
        }
        
        // Remove from queue on success
        this.retryQueue.delete(requestId)
        this.retryTimers.delete(requestId)
        
      } catch (error) {
        console.warn('Scheduled retry failed:', {
          requestId,
          attempt,
          error: error instanceof Error ? error.message : error
        })

        const fetchError: FetchError = {
          type: this.classifyErrorType(error),
          message: error instanceof Error ? error.message : 'Retry failed',
          retryable: this.isRetryableError(error)
        }

        if (onFailure) {
          onFailure(fetchError)
        }

        // Schedule next retry if attempts remaining
        if (attempt < maxAttempts) {
          this.scheduleRetry(cacheKey, operation, {
            ...options,
            customSchedule: schedule
          })
        } else {
          // Remove from queue after max attempts
          this.retryQueue.delete(requestId)
          this.retryTimers.delete(requestId)
        }
      }
    }, delay)

    this.retryTimers.set(requestId, timer)

    console.log('Retry scheduled:', {
      requestId,
      attempt,
      maxAttempts,
      delay,
      nextRetry: new Date(nextRetry).toISOString(),
      isBackground
    })

    return { nextRetry, attempt, maxAttempts }
  }

  private setupOfflineDetection(): void {
    if (typeof window === 'undefined') return

    // Initial state
    this.offlineState.isOffline = !navigator.onLine
    this.offlineState.connectionQuality = navigator.onLine ? 'good' : 'offline'

    // Event listeners
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)

    // Connection quality monitoring (simplified)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection) {
        const updateConnectionQuality = () => {
          const effectiveType = connection.effectiveType
          if (effectiveType === '4g') {
            this.offlineState.connectionQuality = 'good'
          } else if (effectiveType === '3g') {
            this.offlineState.connectionQuality = 'good'
          } else {
            this.offlineState.connectionQuality = 'poor'
          }
          this.offlineState.estimatedBandwidth = connection.downlink
        }

        connection.addEventListener('change', updateConnectionQuality)
        updateConnectionQuality()
      }
    }
  }

  private handleOnline = (): void => {
    console.log('Connection restored')
    this.offlineState.isOffline = false
    this.offlineState.lastOnline = Date.now()
    this.offlineState.connectionQuality = 'good'

    // Trigger retry of failed operations
    this.retryFailedOperations()
  }

  private handleOffline = (): void => {
    console.log('Connection lost')
    this.offlineState.isOffline = true
    this.offlineState.connectionQuality = 'offline'
  }

  private classifyErrorType(error: any): ErrorType {
    if (!error) return ErrorType.UNKNOWN

    const message = error.message?.toLowerCase() || ''
    const name = error.name?.toLowerCase() || ''

    if (message.includes('fetch') || message.includes('network') || name.includes('network')) {
      return ErrorType.NETWORK
    }
    if (message.includes('timeout') || name.includes('timeout')) {
      return ErrorType.TIMEOUT
    }
    if (message.includes('429') || message.includes('rate limit')) {
      return ErrorType.RATE_LIMIT
    }
    if (message.includes('api') || message.includes('http')) {
      return ErrorType.API
    }

    return ErrorType.UNKNOWN
  }

  private isRetryableError(error: any): boolean {
    const errorType = this.classifyErrorType(error)
    return [
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.RATE_LIMIT,
      ErrorType.API
    ].includes(errorType)
  }

  private extractStatusCode(error: any): number | undefined {
    if (error?.response?.status) return error.response.status
    if (error?.status) return error.status
    return undefined
  }

  private formatCacheAge(ageMs: number): string {
    const minutes = Math.floor(ageMs / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    return 'just now'
  }
}

// Singleton instance for global use
let globalFallbackService: FallbackStrategyService | null = null

export function getFallbackService(config?: Partial<FallbackConfig>): FallbackStrategyService {
  if (!globalFallbackService) {
    globalFallbackService = new FallbackStrategyService(config)
  }
  return globalFallbackService
}

export function destroyFallbackService(): void {
  if (globalFallbackService) {
    globalFallbackService.destroy()
    globalFallbackService = null
  }
}