import { type NextRequest, NextResponse } from "next/server"
import { ApiDiscoveryService } from "@/lib/services/api-discovery"
import { ConcurrentRequestManager } from "@/lib/services/concurrent-request-manager"
import { DataAggregationService } from "@/lib/services/data-aggregation"
import { getCacheManager, type CacheKeyOptions } from "@/lib/services/cache-manager"
import { getErrorHandler, type ErrorContext } from "@/lib/services/error-handler"

export interface ComprehensiveApiResponse {
  data: {
    releases: any[]
    pagination: {
      totalCount: number
      fetchedCount: number
      totalPages: number
      fetchedPages: number[]
    }
    performance: PerformanceMetrics
    lastUpdated: string
  }
  errors?: FetchError[]
  warnings?: string[]
}

export interface PerformanceMetrics {
  totalFetchTime: number
  averageRequestTime: number
  cacheHitRate: number
  errorRate: number
  discoveryTime: number
  aggregationTime: number
}

export interface FetchError {
  type: 'network' | 'api' | 'timeout' | 'rate_limit' | 'parsing'
  message: string
  pageNumber?: number
  retryable: boolean
  retryAfter?: number
  statusCode?: number
}

export interface StreamingChunk {
  type: 'progress' | 'data' | 'error' | 'complete'
  data?: {
    releases?: any[]
    progress?: {
      completed: number
      total: number
      percentage: number
      currentPhase: string
      estimatedTimeRemaining?: number
    }
    performance?: Partial<PerformanceMetrics>
  }
  error?: FetchError
  timestamp: string
}

export interface StreamingConfig {
  dateFrom: string
  dateTo: string
  pageSize: number
  maxConcurrency: number
  startTime: number
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)

  // Extract query parameters with defaults
  const dateFrom = searchParams.get("dateFrom") || "2025-01-01"
  const dateTo = searchParams.get("dateTo") || "2025-03-31"
  const pageSize = parseInt(searchParams.get("pageSize") || "50", 10)
  const maxConcurrency = parseInt(searchParams.get("maxConcurrency") || "8", 10)
  const enableStreaming = searchParams.get("streaming") === "true"

  console.log("Starting comprehensive tender fetch:", {
    dateFrom,
    dateTo,
    pageSize,
    maxConcurrency,
    enableStreaming,
    timestamp: new Date().toISOString(),
  })

  // Initialize cache manager
  const cacheManager = getCacheManager({
    ttl: 5 * 60 * 1000, // 5 minutes for tender data
    maxSize: 100, // 100 cache entries max
    compressionEnabled: true,
    maxMemoryUsage: 50, // 50MB max for cache
  })

  // Generate cache key
  const cacheKeyOptions: CacheKeyOptions = {
    dateFrom,
    dateTo,
    pageSize,
    maxConcurrency,
    includeMetadata: true,
  }
  const cacheKey = cacheManager.generateCacheKey(cacheKeyOptions)

  console.log("Cache key generated:", { cacheKey })

  // If streaming is enabled, return streaming response
  if (enableStreaming) {
    return handleStreamingResponse(request, {
      dateFrom,
      dateTo,
      pageSize,
      maxConcurrency,
      startTime,
    }, cacheManager, cacheKey)
  }

  // Check cache first for non-streaming requests
  const cachedResult = await cacheManager.get<ComprehensiveApiResponse>(cacheKey)
  if (cachedResult) {
    console.log("Cache hit - returning cached result:", {
      cacheKey,
      cachedAt: cachedResult.data.lastUpdated,
      totalReleases: cachedResult.data.releases.length,
    })

    // Update cache hit rate in performance metrics
    cachedResult.data.performance.cacheHitRate = 1.0

    // Add cache headers
    const headers = new Headers()
    headers.set('X-Cache-Status', 'HIT')
    headers.set('X-Cache-Key', cacheKey)
    headers.set('X-Total-Count', cachedResult.data.pagination.totalCount.toString())
    headers.set('X-Fetched-Count', cachedResult.data.pagination.fetchedCount.toString())
    headers.set('Cache-Control', 'public, max-age=300')

    return NextResponse.json(cachedResult, { headers })
  }

  console.log("Cache miss - fetching fresh data:", { cacheKey })

  // Initialize error handler
  const errorHandler = getErrorHandler({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterEnabled: true,
  })

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const errorContext: ErrorContext = {
    operation: 'comprehensive_tender_fetch',
    timestamp: startTime,
    requestId,
    metadata: {
      dateFrom,
      dateTo,
      pageSize,
      maxConcurrency,
      cacheKey,
    },
  }

  try {
    // Phase 1: API Discovery with error handling
    const discoveryStartTime = Date.now()
    const discoveryService = new ApiDiscoveryService()
    
    const discoveryResult = await errorHandler.executeWithRetry(
      () => discoveryService.discoverTotalData(dateFrom, dateTo, pageSize),
      { ...errorContext, operation: 'api_discovery' }
    )
    
    const discoveryDuration = Date.now() - discoveryStartTime
    
    console.log("Discovery completed:", {
      totalCount: discoveryResult.totalCount,
      totalPages: discoveryResult.totalPages,
      strategy: discoveryResult.optimalStrategy,
      discoveryDuration,
      estimatedTotalTime: discoveryResult.optimalStrategy.estimatedTotalTime,
      riskLevel: discoveryResult.optimalStrategy.riskLevel,
    })

    // Use discovered strategy or user preference
    const concurrency = Math.min(maxConcurrency, discoveryResult.optimalStrategy.recommendedConcurrency)
    
    // Phase 2: Concurrent Data Fetching
    const requestManager = new ConcurrentRequestManager({
      maxConcurrentRequests: concurrency,
      requestTimeout: 20000,
      maxRetries: 3,
    })

    const aggregationService = new DataAggregationService()
    aggregationService.initialize(discoveryResult.totalPages)

    // Generate page numbers to fetch
    const pageNumbers = Array.from({ length: discoveryResult.totalPages }, (_, i) => i + 1)
    
    // Process in batches for better memory management
    const batchSize = discoveryResult.optimalStrategy.batchSize
    const batches: number[][] = []
    
    for (let i = 0; i < pageNumbers.length; i += batchSize) {
      batches.push(pageNumbers.slice(i, i + batchSize))
    }

    console.log(`Processing ${batches.length} batches with batch size ${batchSize}`)

    const allErrors: FetchError[] = []
    let totalFetchTime = 0

    // Process batches with comprehensive error handling and graceful degradation
    const batchResults: Array<{ success: boolean; data?: any; error?: Error }> = []
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const batchStartTime = Date.now()
      
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} pages`, {
        batchIndex: batchIndex + 1,
        totalBatches: batches.length,
        pagesInBatch: batch.length,
        concurrency,
        timestamp: new Date().toISOString(),
      })
      
      try {
        // Execute batch with retry logic
        const batchResult = await errorHandler.executeWithRetry(
          () => requestManager.processBatch(batch, dateFrom, dateTo, pageSize),
          { ...errorContext, operation: `batch_processing_${batchIndex + 1}` }
        )
        
        await aggregationService.processBatchResult(batchResult)
        
        // Collect errors
        allErrors.push(...batchResult.errors.map(error => ({
          type: error.type,
          message: error.message,
          pageNumber: error.pageNumber,
          retryable: error.retryable,
          retryAfter: error.retryAfter,
          statusCode: error.statusCode,
        })))
        
        const batchDuration = Date.now() - batchStartTime
        totalFetchTime += batchDuration
        
        // Log detailed progress with performance metrics
        const progress = aggregationService.getProgress()
        const currentErrorRate = allErrors.length / ((batchIndex + 1) * batch.length)
        const avgBatchTime = totalFetchTime / (batchIndex + 1)
        const estimatedRemainingTime = avgBatchTime * (batches.length - batchIndex - 1)
        
        console.log(`Batch ${batchIndex + 1} completed:`, {
          progress: `${progress.percentage}%`,
          batchDuration,
          avgBatchTime: Math.round(avgBatchTime),
          estimatedRemainingTime: Math.round(estimatedRemainingTime),
          successfulRequests: batchResult.successfulRequests,
          failedRequests: batchResult.failedRequests,
          avgResponseTime: Math.round(batchResult.averageResponseTime),
          currentErrorRate: Math.round(currentErrorRate * 100) / 100,
          uniqueReleases: progress.processedPages,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        })
        
        batchResults.push({ success: true, data: batchResult })
        
      } catch (error) {
        const batchDuration = Date.now() - batchStartTime
        console.error(`Batch ${batchIndex + 1} failed after retries:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          batchDuration,
          pagesInBatch: batch.length,
          timestamp: new Date().toISOString(),
        })
        
        allErrors.push({
          type: 'network',
          message: error instanceof Error ? error.message : 'Batch processing failed',
          retryable: true,
        })
        
        batchResults.push({ success: false, error: error as Error })
      }
    }

    // Handle partial failures with graceful degradation
    const partialFailureResult = await errorHandler.handlePartialFailure(
      batchResults,
      errorContext,
      0.3 // Accept if at least 30% of batches succeed
    )

    // Phase 3: Finalize Aggregation
    const aggregationStartTime = Date.now()
    const aggregationResult = await aggregationService.finalize()
    const aggregationTime = Date.now() - aggregationStartTime

    // Calculate performance metrics
    const totalProcessingTime = Date.now() - startTime
    const performance: PerformanceMetrics = {
      totalFetchTime: totalProcessingTime,
      averageRequestTime: aggregationResult.metadata.averagePageProcessingTime,
      cacheHitRate: 0,
      errorRate: allErrors.length / discoveryResult.totalPages,
      discoveryTime: discoveryResult.metadata.discoveryTime,
      aggregationTime,
    }

    // Prepare response with error handling context
    let response: ComprehensiveApiResponse
    let httpStatus = 200
    let additionalWarnings: string[] = []

    if (partialFailureResult.success) {
      // Full or acceptable partial success
      response = {
        data: {
          releases: aggregationResult.releases,
          pagination: {
            totalCount: discoveryResult.totalCount,
            fetchedCount: aggregationResult.releases.length,
            totalPages: discoveryResult.totalPages,
            fetchedPages: Array.from({ length: discoveryResult.totalPages }, (_, i) => i + 1),
          },
          performance,
          lastUpdated: new Date().toISOString(),
        },
        errors: allErrors.length > 0 ? allErrors : undefined,
        warnings: [
          ...(aggregationResult.validationErrors.length > 0 
            ? [`${aggregationResult.validationErrors.length} validation warnings found`]
            : []),
          ...(partialFailureResult.errors.length > 0 
            ? [`${partialFailureResult.errors.length} batch processing issues encountered`]
            : []),
          ...additionalWarnings,
        ].filter(Boolean),
      }
    } else {
      // Partial failure - return what we have with warnings
      httpStatus = 206 // Partial Content
      additionalWarnings.push(partialFailureResult.userMessage)
      
      response = {
        data: {
          releases: aggregationResult.releases,
          pagination: {
            totalCount: discoveryResult.totalCount,
            fetchedCount: aggregationResult.releases.length,
            totalPages: discoveryResult.totalPages,
            fetchedPages: Array.from({ length: discoveryResult.totalPages }, (_, i) => i + 1),
          },
          performance,
          lastUpdated: new Date().toISOString(),
        },
        errors: [...allErrors, ...partialFailureResult.errors.map(e => ({
          type: 'network' as const,
          message: e.userMessage,
          retryable: true,
        }))],
        warnings: [
          ...(aggregationResult.validationErrors.length > 0 
            ? [`${aggregationResult.validationErrors.length} validation warnings found`]
            : []),
          ...additionalWarnings,
          'Some data may be incomplete due to processing errors',
        ].filter(Boolean),
      }
    }

    console.log("Comprehensive fetch completed:", {
      totalReleases: aggregationResult.releases.length,
      totalErrors: allErrors.length,
      processingTime: totalProcessingTime,
      dataQuality: aggregationResult.metadata.dataQualityScore,
    })

    // Cache the successful result
    try {
      await cacheManager.set(cacheKey, response, 5 * 60 * 1000) // 5 minutes TTL
      console.log("Result cached successfully:", { cacheKey })
    } catch (cacheError) {
      console.warn("Failed to cache result:", cacheError)
    }

    // Get cache statistics for monitoring
    const cacheStats = await cacheManager.getStats()
    console.log("Cache statistics:", {
      hitRate: Math.round(cacheStats.hitRate * 100) / 100,
      totalEntries: cacheStats.totalEntries,
      memoryUsage: Math.round(cacheStats.memoryUsage * 100) / 100,
    })

    // Add performance headers
    const headers = new Headers()
    headers.set('X-Cache-Status', 'MISS')
    headers.set('X-Cache-Key', cacheKey)
    headers.set('X-Total-Count', discoveryResult.totalCount.toString())
    headers.set('X-Fetched-Count', aggregationResult.releases.length.toString())
    headers.set('X-Processing-Time', totalProcessingTime.toString())
    headers.set('X-Data-Quality-Score', aggregationResult.metadata.dataQualityScore.toString())
    headers.set('X-Cache-Hit-Rate', cacheStats.hitRate.toString())
    headers.set('Cache-Control', 'public, max-age=300') // 5 minutes cache

    return NextResponse.json(response, { status: httpStatus, headers })

  } catch (error) {
    console.error("Comprehensive fetch failed:", error)

    // Use error handler for comprehensive error classification and recovery
    const errorResult = await errorHandler.handleError(
      error as Error,
      errorContext,
      async () => {
        // This would be a fallback operation, like returning cached data
        const fallbackCached = await cacheManager.get<ComprehensiveApiResponse>(`fallback_${cacheKey}`)
        if (fallbackCached) {
          return fallbackCached
        }
        throw new Error('No fallback data available')
      }
    )

    // Prepare comprehensive error response
    const errorResponse = {
      success: false,
      error: "Failed to fetch comprehensive tender data",
      message: errorResult.userMessage,
      technicalDetails: errorResult.technicalDetails,
      suggestions: [
        "Check your internet connection",
        "Try reducing the date range or page size",
        "Try again in a few moments",
        ...(errorResult.errors.some(e => e.classification.type === 'rate_limit') 
          ? ["Wait a few minutes before retrying due to rate limiting"]
          : []),
        ...(errorResult.errors.some(e => e.classification.type === 'memory') 
          ? ["Try with a smaller date range to reduce memory usage"]
          : []),
        "Contact support if the problem persists",
      ],
      retryable: errorResult.errors.some(e => e.classification.retryable),
      partialData: errorResult.partialData,
      errors: errorResult.errors.map(e => ({
        id: e.id,
        type: e.classification.type,
        message: e.userMessage,
        retryable: e.classification.retryable,
        severity: e.classification.severity,
      })),
      recoveryAttempts: errorResult.recoveryAttempts.map(attempt => ({
        strategy: attempt.strategy.type,
        success: attempt.success,
        duration: attempt.duration,
        description: attempt.strategy.description,
      })),
      timestamp: new Date().toISOString(),
      requestId,
    }

    // Determine appropriate HTTP status code based on error classification
    let statusCode = 503 // Service Unavailable (default)
    
    if (errorResult.errors.some(e => e.classification.category === 'user_input')) {
      statusCode = 400 // Bad Request
    } else if (errorResult.errors.some(e => e.classification.type === 'rate_limit')) {
      statusCode = 429 // Too Many Requests
    } else if (errorResult.errors.some(e => e.classification.type === 'timeout')) {
      statusCode = 504 // Gateway Timeout
    } else if (errorResult.partialData) {
      statusCode = 206 // Partial Content
    }

    // Add error-specific headers
    const errorHeaders = new Headers()
    errorHeaders.set('X-Error-ID', requestId)
    errorHeaders.set('X-Error-Count', errorResult.errors.length.toString())
    errorHeaders.set('X-Recovery-Attempts', errorResult.recoveryAttempts.length.toString())
    
    if (errorResult.errors.some(e => e.classification.type === 'rate_limit')) {
      errorHeaders.set('Retry-After', '300') // 5 minutes
    }

    return NextResponse.json(errorResponse, { status: statusCode, headers: errorHeaders })
  }
}

/**
 * Handle streaming response for progressive loading
 */
async function handleStreamingResponse(
  request: NextRequest,
  config: StreamingConfig,
  cacheManager: any,
  cacheKey: string
): Promise<Response> {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Check cache first for streaming requests too
        const cachedResult = await cacheManager.get<ComprehensiveApiResponse>(cacheKey)
        if (cachedResult) {
          console.log("Streaming cache hit - returning cached result:", {
            cacheKey,
            totalReleases: cachedResult.data.releases.length,
          })

          // Send cached data as complete chunk
          const cachedChunk: StreamingChunk = {
            type: 'complete',
            data: {
              releases: cachedResult.data.releases,
              progress: {
                completed: 1,
                total: 1,
                percentage: 100,
                currentPhase: 'complete',
              },
              performance: {
                ...cachedResult.data.performance,
                cacheHitRate: 1.0,
              }
            },
            timestamp: new Date().toISOString(),
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(cachedChunk)}\n\n`))
          controller.close()
          return
        }

        // Send initial progress chunk
        const initialChunk: StreamingChunk = {
          type: 'progress',
          data: {
            progress: {
              completed: 0,
              total: 0,
              percentage: 0,
              currentPhase: 'initializing',
            }
          },
          timestamp: new Date().toISOString(),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialChunk)}\n\n`))

        // Phase 1: API Discovery
        const discoveryService = new ApiDiscoveryService()
        const discoveryResult = await discoveryService.discoverTotalData(
          config.dateFrom, 
          config.dateTo, 
          config.pageSize
        )
        
        // Send discovery completion
        const discoveryChunk: StreamingChunk = {
          type: 'progress',
          data: {
            progress: {
              completed: 0,
              total: discoveryResult.totalPages,
              percentage: 0,
              currentPhase: 'discovery_complete',
            },
            performance: {
              discoveryTime: discoveryResult.metadata.discoveryTime,
            }
          },
          timestamp: new Date().toISOString(),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(discoveryChunk)}\n\n`))

        // Initialize services
        const concurrency = Math.min(config.maxConcurrency, discoveryResult.optimalStrategy.recommendedConcurrency)
        const requestManager = new ConcurrentRequestManager({
          maxConcurrentRequests: concurrency,
          requestTimeout: 20000,
          maxRetries: 3,
        })

        const aggregationService = new DataAggregationService()
        aggregationService.initialize(discoveryResult.totalPages)

        // Generate batches
        const pageNumbers = Array.from({ length: discoveryResult.totalPages }, (_, i) => i + 1)
        const batchSize = discoveryResult.optimalStrategy.batchSize
        const batches: number[][] = []
        
        for (let i = 0; i < pageNumbers.length; i += batchSize) {
          batches.push(pageNumbers.slice(i, i + batchSize))
        }

        const allErrors: FetchError[] = []
        let processedBatches = 0

        // Process batches with streaming updates
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex]
          
          try {
            // Send batch start progress
            const batchStartChunk: StreamingChunk = {
              type: 'progress',
              data: {
                progress: {
                  completed: processedBatches,
                  total: batches.length,
                  percentage: Math.round((processedBatches / batches.length) * 100),
                  currentPhase: `processing_batch_${batchIndex + 1}`,
                }
              },
              timestamp: new Date().toISOString(),
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(batchStartChunk)}\n\n`))

            const batchResult = await requestManager.processBatch(batch, config.dateFrom, config.dateTo, config.pageSize)
            await aggregationService.processBatchResult(batchResult)
            
            // Collect errors
            allErrors.push(...batchResult.errors.map(error => ({
              type: error.type,
              message: error.message,
              pageNumber: error.pageNumber,
              retryable: error.retryable,
              retryAfter: error.retryAfter,
              statusCode: error.statusCode,
            })))

            processedBatches++

            // Send batch completion with partial data
            const progress = aggregationService.getProgress()
            const batchCompleteChunk: StreamingChunk = {
              type: 'data',
              data: {
                progress: {
                  completed: processedBatches,
                  total: batches.length,
                  percentage: Math.round((processedBatches / batches.length) * 100),
                  currentPhase: 'fetching',
                  estimatedTimeRemaining: progress.estimatedTimeRemaining,
                },
                performance: {
                  averageRequestTime: batchResult.averageResponseTime,
                  errorRate: allErrors.length / (batchIndex + 1),
                }
              },
              timestamp: new Date().toISOString(),
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(batchCompleteChunk)}\n\n`))

          } catch (error) {
            const errorChunk: StreamingChunk = {
              type: 'error',
              error: {
                type: 'network',
                message: error instanceof Error ? error.message : 'Batch processing failed',
                retryable: true,
              },
              timestamp: new Date().toISOString(),
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`))
          }
        }

        // Finalize aggregation
        const aggregationResult = await aggregationService.finalize()
        const totalProcessingTime = Date.now() - config.startTime

        // Prepare final response for caching
        const finalResponse: ComprehensiveApiResponse = {
          data: {
            releases: aggregationResult.releases,
            pagination: {
              totalCount: discoveryResult.totalCount,
              fetchedCount: aggregationResult.releases.length,
              totalPages: discoveryResult.totalPages,
              fetchedPages: Array.from({ length: discoveryResult.totalPages }, (_, i) => i + 1),
            },
            performance: {
              totalFetchTime: totalProcessingTime,
              averageRequestTime: aggregationResult.metadata.averagePageProcessingTime,
              cacheHitRate: 0,
              errorRate: allErrors.length / discoveryResult.totalPages,
              discoveryTime: discoveryResult.metadata.discoveryTime,
              aggregationTime: aggregationResult.metadata.totalProcessingTime || 0,
            },
            lastUpdated: new Date().toISOString(),
          },
          errors: allErrors.length > 0 ? allErrors : undefined,
          warnings: aggregationResult.validationErrors.length > 0 
            ? [`${aggregationResult.validationErrors.length} validation warnings found`]
            : undefined,
        }

        // Cache the successful result
        try {
          await cacheManager.set(cacheKey, finalResponse, 5 * 60 * 1000) // 5 minutes TTL
          console.log("Streaming result cached successfully:", { cacheKey })
        } catch (cacheError) {
          console.warn("Failed to cache streaming result:", cacheError)
        }

        // Send final completion chunk
        const completionChunk: StreamingChunk = {
          type: 'complete',
          data: {
            releases: aggregationResult.releases,
            progress: {
              completed: batches.length,
              total: batches.length,
              percentage: 100,
              currentPhase: 'complete',
            },
            performance: {
              totalFetchTime: totalProcessingTime,
              averageRequestTime: aggregationResult.metadata.averagePageProcessingTime,
              cacheHitRate: 0,
              errorRate: allErrors.length / discoveryResult.totalPages,
              discoveryTime: discoveryResult.metadata.discoveryTime,
              aggregationTime: aggregationResult.metadata.totalProcessingTime || 0,
            }
          },
          timestamp: new Date().toISOString(),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(completionChunk)}\n\n`))

      } catch (error) {
        const errorChunk: StreamingChunk = {
          type: 'error',
          error: {
            type: 'network',
            message: error instanceof Error ? error.message : 'Streaming failed',
            retryable: true,
          },
          timestamp: new Date().toISOString(),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`))
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}