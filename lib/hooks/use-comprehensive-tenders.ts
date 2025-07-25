"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getFallbackService, FallbackStrategyService } from "@/lib/services/fallback-strategy"

// Enhanced data interfaces based on the comprehensive API
export interface EnhancedTenderInfo {
  ocid: string
  id: string
  date: string
  tag: string[]
  tender: {
    id: string
    title: string
    status: string
    description: string
    mainProcurementCategory: string
    value?: {
      amount: number
      currency: string
    }
    tenderPeriod?: {
      startDate: string
      endDate: string
    }
    procuringEntity?: {
      id: string
      name: string
    }
    // Enhanced fields from comprehensive extraction
    requestForBid?: {
      department: string
      bidDescription: string
      deliveryLocation: string
    }
    keyDates?: {
      openingDate?: string
      closingDate: string
      modifiedDate?: string
    }
    contactInformation?: {
      contactPerson?: string
      email?: string
      telephone?: string
      fax?: string
    }
    briefingSession?: {
      hasBriefing: boolean
      isCompulsory?: boolean
      date?: string
      venue?: string
    }
    specialConditions?: string[]
  }
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

export interface ProgressInfo {
  completed: number
  total: number
  percentage: number
  currentPhase: string
  estimatedTimeRemaining?: number
}

export interface ComprehensiveTendersState {
  tenders: EnhancedTenderInfo[]
  loading: boolean
  progress: ProgressInfo | null
  error: FetchError | null
  performance: PerformanceMetrics | null
  totalCount: number
  fetchedCount: number
  lastUpdated: string | null
  warnings: string[]
}

export interface UseComprehensiveTendersOptions {
  dateFrom?: string
  dateTo?: string
  pageSize?: number
  maxConcurrency?: number
  enableStreaming?: boolean
  cacheEnabled?: boolean
  refreshInterval?: number
  autoRetry?: boolean
  maxRetries?: number
}

export interface ComprehensiveTendersActions {
  refresh: () => Promise<void>
  retry: () => Promise<void>
  clearCache: () => void
  updateFilters: (filters: { dateFrom?: string; dateTo?: string }) => void
}

export interface StreamingChunk {
  type: 'progress' | 'data' | 'error' | 'complete'
  data?: {
    releases?: EnhancedTenderInfo[]
    progress?: ProgressInfo
    performance?: Partial<PerformanceMetrics>
  }
  error?: FetchError
  timestamp: string
}

export function useComprehensiveTenders(
  options: UseComprehensiveTendersOptions = {}
): {
  state: ComprehensiveTendersState
  actions: ComprehensiveTendersActions
} {
  const {
    dateFrom = "2025-01-01",
    dateTo = "2025-03-31",
    pageSize = 50,
    maxConcurrency = 8,
    enableStreaming = false, // Disable streaming by default to avoid EventSource errors
    cacheEnabled = true,
    refreshInterval,
    autoRetry = true,
    maxRetries = 3,
  } = options

  // State management
  const [state, setState] = useState<ComprehensiveTendersState>({
    tenders: [],
    loading: false,
    progress: null,
    error: null,
    performance: null,
    totalCount: 0,
    fetchedCount: 0,
    lastUpdated: null,
    warnings: [],
  })

  // Refs for managing streaming and retries
  const abortControllerRef = useRef<AbortController | null>(null)
  const retryCountRef = useRef(0)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const fallbackServiceRef = useRef<FallbackStrategyService | null>(null)

  // Initialize fallback service
  if (!fallbackServiceRef.current) {
    fallbackServiceRef.current = getFallbackService({
      enableCachedFallback: cacheEnabled,
      maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
      retrySchedule: [1000, 2000, 5000, 10000, 30000],
      maxRetryAttempts: maxRetries,
      gracefulDegradationThreshold: 0.7,
      offlineDetection: true,
      backgroundRefresh: true,
    })
  }

  // Build API URL with parameters
  const buildApiUrl = useCallback((streaming: boolean = false) => {
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      pageSize: pageSize.toString(),
      maxConcurrency: maxConcurrency.toString(),
    })

    if (streaming) {
      params.append("streaming", "true")
    }

    return `/api/tenders/comprehensive?${params.toString()}`
  }, [dateFrom, dateTo, pageSize, maxConcurrency])

  // Handle streaming response
  const handleStreamingFetch = useCallback(async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = buildApiUrl(true)
    console.log("Starting streaming fetch:", { url, timestamp: new Date().toISOString() })

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      progress: { completed: 0, total: 0, percentage: 0, currentPhase: 'initializing' },
    }))

    try {
      // Add a timeout to detect if EventSource fails to connect
      const timeoutId = setTimeout(() => {
        console.log("EventSource connection timeout, falling back to regular fetch")
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
        handleRegularFetch()
      }, 5000) // 5 second timeout

      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      // Clear timeout on successful connection
      eventSource.onopen = () => {
        clearTimeout(timeoutId)
        console.log("EventSource connection established")
      }

      eventSource.onmessage = (event) => {
        try {
          const chunk: StreamingChunk = JSON.parse(event.data)
          console.log("Received streaming chunk:", { type: chunk.type, timestamp: chunk.timestamp })

          switch (chunk.type) {
            case 'progress':
              if (chunk.data?.progress) {
                setState(prev => ({
                  ...prev,
                  progress: chunk.data?.progress || null,
                  performance: chunk.data?.performance ? {
                    totalFetchTime: chunk.data.performance.totalFetchTime ?? prev.performance?.totalFetchTime ?? 0,
                    averageRequestTime: chunk.data.performance.averageRequestTime ?? prev.performance?.averageRequestTime ?? 0,
                    cacheHitRate: chunk.data.performance.cacheHitRate ?? prev.performance?.cacheHitRate ?? 0,
                    errorRate: chunk.data.performance.errorRate ?? prev.performance?.errorRate ?? 0,
                    discoveryTime: chunk.data.performance.discoveryTime ?? prev.performance?.discoveryTime ?? 0,
                    aggregationTime: chunk.data.performance.aggregationTime ?? prev.performance?.aggregationTime ?? 0,
                  } : prev.performance,
                }))
              }
              break

            case 'data':
              if (chunk.data?.releases) {
                setState(prev => ({
                  ...prev,
                  tenders: chunk.data?.releases || [],
                  fetchedCount: chunk.data?.releases?.length || 0,
                  progress: chunk.data?.progress || prev.progress,
                  performance: chunk.data?.performance ? {
                    totalFetchTime: chunk.data.performance.totalFetchTime ?? prev.performance?.totalFetchTime ?? 0,
                    averageRequestTime: chunk.data.performance.averageRequestTime ?? prev.performance?.averageRequestTime ?? 0,
                    cacheHitRate: chunk.data.performance.cacheHitRate ?? prev.performance?.cacheHitRate ?? 0,
                    errorRate: chunk.data.performance.errorRate ?? prev.performance?.errorRate ?? 0,
                    discoveryTime: chunk.data.performance.discoveryTime ?? prev.performance?.discoveryTime ?? 0,
                    aggregationTime: chunk.data.performance.aggregationTime ?? prev.performance?.aggregationTime ?? 0,
                  } : prev.performance,
                }))
              }
              break

            case 'complete':
              if (chunk.data?.releases) {
                setState(prev => ({
                  ...prev,
                  tenders: chunk.data?.releases || [],
                  loading: false,
                  progress: chunk.data?.progress || null,
                  performance: chunk.data?.performance ? {
                    totalFetchTime: chunk.data.performance.totalFetchTime ?? prev.performance?.totalFetchTime ?? 0,
                    averageRequestTime: chunk.data.performance.averageRequestTime ?? prev.performance?.averageRequestTime ?? 0,
                    cacheHitRate: chunk.data.performance.cacheHitRate ?? prev.performance?.cacheHitRate ?? 0,
                    errorRate: chunk.data.performance.errorRate ?? prev.performance?.errorRate ?? 0,
                    discoveryTime: chunk.data.performance.discoveryTime ?? prev.performance?.discoveryTime ?? 0,
                    aggregationTime: chunk.data.performance.aggregationTime ?? prev.performance?.aggregationTime ?? 0,
                  } : prev.performance,
                  totalCount: chunk.data?.releases?.length || 0,
                  fetchedCount: chunk.data?.releases?.length || 0,
                  lastUpdated: new Date().toISOString(),
                }))
              }
              retryCountRef.current = 0
              eventSource.close()
              break

            case 'error':
              if (chunk.error) {
                console.error("Streaming error received:", chunk.error)
                setState(prev => ({
                  ...prev,
                  error: chunk.error!,
                  loading: false,
                  progress: null,
                }))
                
                // Auto-retry logic for streaming errors
                if (autoRetry && chunk.error.retryable && retryCountRef.current < maxRetries) {
                  const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
                  console.log(`Auto-retrying streaming in ${retryDelay}ms (attempt ${retryCountRef.current + 1}/${maxRetries})`)
                  
                  setTimeout(() => {
                    retryCountRef.current++
                    handleStreamingFetch()
                  }, retryDelay)
                }
              }
              eventSource.close()
              break
          }
        } catch (parseError) {
          console.error("Failed to parse streaming chunk:", parseError, event.data)
        }
      }

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error)
        setState(prev => ({
          ...prev,
          error: {
            type: 'network',
            message: 'Streaming connection failed',
            retryable: true,
          },
          loading: false,
          progress: null,
        }))
        eventSource.close()

        // Auto-retry logic for connection errors
        if (autoRetry && retryCountRef.current < maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
          console.log(`Auto-retrying streaming connection in ${retryDelay}ms (attempt ${retryCountRef.current + 1}/${maxRetries})`)
          
          setTimeout(() => {
            retryCountRef.current++
            handleStreamingFetch()
          }, retryDelay)
        }
      }

    } catch (error) {
      console.error("Failed to start streaming:", error)
      setState(prev => ({
        ...prev,
        error: {
          type: 'network',
          message: error instanceof Error ? error.message : 'Failed to start streaming',
          retryable: true,
        },
        loading: false,
        progress: null,
      }))
    }
  }, [buildApiUrl, autoRetry, maxRetries])

  // Handle regular fetch (non-streaming) with fallback strategies
  const handleRegularFetch = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const url = buildApiUrl(false)
    console.log("Starting regular fetch with fallback:", { url, timestamp: new Date().toISOString() })

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      progress: { completed: 0, total: 1, percentage: 0, currentPhase: 'fetching' },
    }))

    // Generate cache key for fallback service
    const cacheKey = `comprehensive-tenders-${dateFrom}-${dateTo}-${pageSize}-${maxConcurrency}`

    // Define the fetch operation
    const fetchOperation = async () => {
      const response = await fetch(url, {
        signal: abortController.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': cacheEnabled ? 'max-age=300' : 'no-cache',
        },
      })

      if (!response.ok) {
        let errorType: FetchError['type'] = 'api'
        let retryable = true

        if (response.status >= 400 && response.status < 500) {
          errorType = response.status === 429 ? 'rate_limit' : 'api'
          retryable = response.status === 429
        } else if (response.status >= 500) {
          errorType = 'api'
          retryable = true
        }

        const errorData = await response.json().catch(() => ({}))
        const fetchError: FetchError = {
          type: errorType,
          message: errorData.message || `API error (${response.status})`,
          retryable,
          statusCode: response.status,
          retryAfter: response.headers.get('Retry-After') ? 
            parseInt(response.headers.get('Retry-After')!) * 1000 : undefined,
        }

        throw fetchError
      }

      return await response.json()
    }

    try {
      // Use fallback service to execute the operation with comprehensive fallback strategies
      const fallbackResult = await fallbackServiceRef.current!.executeWithFallback(
        fetchOperation,
        cacheKey,
        {
          cacheKeyOptions: {
            dateFrom,
            dateTo,
            pageSize,
            maxConcurrency,
          },
          operationName: 'comprehensive-tenders-fetch',
          allowPartialData: true,
        }
      )

      console.log("Fetch completed with fallback result:", {
        source: fallbackResult.source,
        isFallback: fallbackResult.isFallback,
        totalReleases: fallbackResult.data?.releases?.length || 0,
        warnings: fallbackResult.warnings.length,
        errors: fallbackResult.errors.length,
      })

      // Update state based on fallback result
      setState(prev => ({
        ...prev,
        tenders: fallbackResult.data?.releases || [],
        loading: false,
        progress: null,
        error: fallbackResult.errors.length > 0 ? fallbackResult.errors[0] : null,
        performance: fallbackResult.performance || fallbackResult.data?.performance || null,
        totalCount: fallbackResult.data?.pagination?.totalCount || 0,
        fetchedCount: fallbackResult.data?.pagination?.fetchedCount || 0,
        lastUpdated: fallbackResult.source === 'live' 
          ? new Date().toISOString() 
          : prev.lastUpdated || new Date().toISOString(),
        warnings: [
          ...fallbackResult.warnings,
          ...(fallbackResult.data?.warnings || [])
        ],
      }))

      // Add fallback-specific warnings
      if (fallbackResult.isFallback) {
        setState(prev => ({
          ...prev,
          warnings: [
            ...prev.warnings,
            fallbackResult.source === 'cache' 
              ? `Data loaded from cache (${fallbackResult.cacheAge ? Math.round(fallbackResult.cacheAge / (1000 * 60)) : 'unknown'} minutes old)`
              : fallbackResult.source === 'partial'
              ? 'Partial data recovered from alternative sources'
              : 'Using fallback data source'
          ]
        }))
      }

      retryCountRef.current = 0

    } catch (error) {
      console.error("Fetch with fallback failed:", error)

      // Check if we have offline data available
      const offlineState = await fallbackServiceRef.current!.getOfflineState(cacheKey)
      
      if (offlineState.hasOfflineData) {
        console.log("Using offline data as last resort")
        
        setState(prev => ({
          ...prev,
          tenders: offlineState.offlineData?.releases || [],
          loading: false,
          progress: null,
          error: {
            type: 'network',
            message: 'Working offline with cached data',
            retryable: true,
          },
          performance: offlineState.offlineData?.performance || null,
          totalCount: offlineState.offlineData?.pagination?.totalCount || 0,
          fetchedCount: offlineState.offlineData?.pagination?.fetchedCount || 0,
          warnings: [
            'Working in offline mode',
            `Using cached data from ${offlineState.cacheAge ? Math.round(offlineState.cacheAge / (1000 * 60)) : 'unknown'} minutes ago`,
            ...offlineState.recommendations,
            ...(offlineState.isStale ? ['Cached data may be outdated'] : [])
          ],
        }))
      } else {
        // No fallback data available
        let fetchError: FetchError
        if (error instanceof Error && 'type' in error && 'retryable' in error) {
          fetchError = error as FetchError
        } else if (error instanceof Error) {
          if (error.name === 'AbortError') {
            return // Request was cancelled, don't update state
          }

          fetchError = {
            type: error.message.includes('fetch') ? 'network' : 'api',
            message: error.message,
            retryable: true,
          }
        } else {
          fetchError = {
            type: 'api',
            message: 'An unexpected error occurred',
            retryable: true,
          }
        }

        setState(prev => ({
          ...prev,
          error: fetchError,
          loading: false,
          progress: null,
          warnings: [
            'No cached data available for offline use',
            'Please check your internet connection and try again'
          ],
        }))

        // Auto-retry logic for regular fetch
        if (autoRetry && fetchError.retryable && retryCountRef.current < maxRetries) {
          const retryDelay = fetchError.retryAfter || Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
          console.log(`Auto-retrying regular fetch in ${retryDelay}ms (attempt ${retryCountRef.current + 1}/${maxRetries})`)
          
          setTimeout(() => {
            retryCountRef.current++
            handleRegularFetch()
          }, retryDelay)
        }
      }
    }
  }, [buildApiUrl, cacheEnabled, autoRetry, maxRetries, dateFrom, dateTo, pageSize, maxConcurrency])

  // Main fetch function that chooses between streaming and regular
  const fetchTenders = useCallback(async () => {
    if (enableStreaming) {
      try {
        await handleStreamingFetch()
      } catch (error) {
        console.error("Streaming fetch failed, falling back to regular fetch:", error)
        await handleRegularFetch()
      }
    } else {
      await handleRegularFetch()
    }
  }, [enableStreaming, handleStreamingFetch, handleRegularFetch])

  // Actions
  const refresh = useCallback(async () => {
    retryCountRef.current = 0
    await fetchTenders()
  }, [fetchTenders])

  const retry = useCallback(async () => {
    await fetchTenders()
  }, [fetchTenders])

  const clearCache = useCallback(() => {
    // Clear browser cache for the API endpoint
    if ('caches' in window) {
      caches.delete('comprehensive-tenders-cache').catch(console.warn)
    }
    
    // Reset state
    setState(prev => ({
      ...prev,
      tenders: [],
      performance: null,
      lastUpdated: null,
      warnings: [],
    }))
  }, [])

  const updateFilters = useCallback((filters: { dateFrom?: string; dateTo?: string }) => {
    // This will trigger a re-fetch via the useEffect dependency
    console.log("Filters updated:", filters)
  }, [])

  // Initial fetch and refresh interval setup
  useEffect(() => {
    fetchTenders()

    // Setup refresh interval if specified
    if (refreshInterval && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        console.log("Auto-refreshing tenders due to interval")
        fetchTenders()
      }, refreshInterval)
    }

    return () => {
      // Cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [dateFrom, dateTo, pageSize, maxConcurrency, enableStreaming, refreshInterval])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  return {
    state,
    actions: {
      refresh,
      retry,
      clearCache,
      updateFilters,
    },
  }
}