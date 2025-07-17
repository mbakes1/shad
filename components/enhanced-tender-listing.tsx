"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  RefreshCw, 
  AlertCircle, 
  WifiOff, 
  TrendingUp, 
  Clock, 
  MapPin,
  Building,
  Search,
  Filter,
  X,
} from "lucide-react"
import { useComprehensiveTenders } from "@/lib/hooks/use-comprehensive-tenders"
import { useTenderFilters } from "@/lib/hooks/use-tender-filters"
import AdvancedTenderFilters from "@/components/advanced-tender-filters"
import VirtualTenderList from "@/components/virtual-tender-list"

export interface EnhancedTenderListingProps {
  className?: string
  enableVirtualScrolling?: boolean
  enableAdvancedFilters?: boolean
  showPerformanceMetrics?: boolean
  autoRefreshInterval?: number
}

export default function EnhancedTenderListing({
  className = "",
  enableVirtualScrolling = true,
  enableAdvancedFilters = true,
  showPerformanceMetrics = true,
  autoRefreshInterval,
}: EnhancedTenderListingProps) {
  // State for UI controls
  const [showFilters, setShowFilters] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Comprehensive tenders hook
  const { state: tendersState, actions: tendersActions } = useComprehensiveTenders({
    dateFrom: "2025-01-01",
    dateTo: "2025-03-31",
    pageSize: 50,
    maxConcurrency: 8,
    enableStreaming: true,
    cacheEnabled: true,
    refreshInterval: autoRefreshInterval,
    autoRetry: true,
    maxRetries: 3,
  })

  // Filtering hook
  const { 
    filters, 
    sortConfig, 
    filteredResult, 
    actions: filterActions 
  } = useTenderFilters({
    tenders: tendersState.tenders,
    enableUrlSync: true,
    debounceMs: 300,
    defaultSort: { field: 'closingDate', direction: 'asc' },
  })

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await tendersActions.refresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle retry
  const handleRetry = async () => {
    await tendersActions.retry()
  }

  // Handle clear cache
  const handleClearCache = () => {
    tendersActions.clearCache()
    handleRefresh()
  }

  // Performance metrics display
  const renderPerformanceMetrics = () => {
    if (!showPerformanceMetrics || !tendersState.performance) return null

    const { performance } = tendersState
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium">Fetch Time</div>
              <div className="text-xs text-muted-foreground">
                {(performance.totalFetchTime / 1000).toFixed(1)}s
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <div>
              <div className="text-sm font-medium">Cache Hit</div>
              <div className="text-xs text-muted-foreground">
                {(performance.cacheHitRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <div>
              <div className="text-sm font-medium">Error Rate</div>
              <div className="text-xs text-muted-foreground">
                {(performance.errorRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-purple-500" />
            <div>
              <div className="text-sm font-medium">Avg Request</div>
              <div className="text-xs text-muted-foreground">
                {performance.averageRequestTime.toFixed(0)}ms
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Enhanced progress indicator with detailed feedback
  const renderProgressIndicator = () => {
    if (!tendersState.progress) return null

    const { progress } = tendersState
    
    // Calculate progress color based on phase and percentage
    const getProgressColor = () => {
      if (progress.currentPhase === 'error') return 'bg-red-500'
      if (progress.percentage < 25) return 'bg-blue-500'
      if (progress.percentage < 75) return 'bg-indigo-500'
      return 'bg-green-500'
    }

    const getPhaseIcon = () => {
      switch (progress.currentPhase) {
        case 'initializing':
          return <RefreshCw className="h-4 w-4 animate-spin" />
        case 'discovering':
          return <Search className="h-4 w-4 animate-pulse" />
        case 'fetching':
          return <TrendingUp className="h-4 w-4" />
        case 'aggregating':
          return <Building className="h-4 w-4" />
        case 'complete':
          return <div className="h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
            <div className="h-2 w-2 bg-white rounded-full"></div>
          </div>
        default:
          return <Clock className="h-4 w-4" />
      }
    }

    const getPhaseDescription = () => {
      switch (progress.currentPhase) {
        case 'initializing':
          return 'Setting up data fetching process...'
        case 'discovering':
          return 'Discovering total available tenders...'
        case 'fetching':
          return 'Fetching tender data from multiple pages...'
        case 'aggregating':
          return 'Processing and combining tender information...'
        case 'complete':
          return 'All tender data has been successfully loaded'
        default:
          return 'Processing tender data...'
      }
    }

    return (
      <Card className="mb-6 border-l-4 border-l-blue-500">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {getPhaseIcon()}
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {progress.currentPhase.charAt(0).toUpperCase() + progress.currentPhase.slice(1)} Phase
                </div>
                <div className="text-xs text-muted-foreground">
                  {getPhaseDescription()}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">
                {progress.percentage.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                Complete
              </div>
            </div>
          </div>

          {/* Enhanced progress bar with segments */}
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ease-out ${getProgressColor()}`}
                style={{ width: `${progress.percentage}%` }}
              >
                <div className="h-full bg-gradient-to-r from-transparent to-white/20 rounded-full"></div>
              </div>
            </div>
            
            {/* Progress segments indicators */}
            <div className="absolute top-0 left-0 w-full h-3 flex">
              {[25, 50, 75].map((segment) => (
                <div
                  key={segment}
                  className="absolute top-0 w-0.5 h-3 bg-white/60"
                  style={{ left: `${segment}%` }}
                />
              ))}
            </div>
          </div>

          {/* Detailed progress information */}
          <div className="flex items-center justify-between mt-4 text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                <span className="font-semibold text-gray-900">{progress.completed.toLocaleString()}</span>
                {" of "}
                <span className="font-semibold text-gray-900">{progress.total.toLocaleString()}</span>
                {" items processed"}
              </span>
              
              {tendersState.performance?.averageRequestTime && (
                <span className="text-muted-foreground">
                  Avg: {tendersState.performance.averageRequestTime.toFixed(0)}ms/request
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs">
              {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 1000 && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Clock className="h-3 w-3" />
                  <span>~{Math.ceil(progress.estimatedTimeRemaining / 1000)}s remaining</span>
                </div>
              )}
              
              {tendersState.performance?.errorRate !== undefined && tendersState.performance.errorRate > 0 && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{(tendersState.performance.errorRate * 100).toFixed(1)}% errors</span>
                </div>
              )}
            </div>
          </div>

          {/* Performance feedback */}
          {tendersState.performance && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-gray-900">
                    {(tendersState.performance.totalFetchTime / 1000).toFixed(1)}s
                  </div>
                  <div className="text-muted-foreground">Total Time</div>
                </div>
                
                <div className="text-center">
                  <div className="font-semibold text-gray-900">
                    {(tendersState.performance.cacheHitRate * 100).toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground">Cache Hit</div>
                </div>
                
                <div className="text-center">
                  <div className="font-semibold text-gray-900">
                    {tendersState.performance.averageRequestTime.toFixed(0)}ms
                  </div>
                  <div className="text-muted-foreground">Avg Request</div>
                </div>
                
                <div className="text-center">
                  <div className="font-semibold text-gray-900">
                    {((progress.completed / (tendersState.performance.totalFetchTime / 1000)) || 0).toFixed(1)}/s
                  </div>
                  <div className="text-muted-foreground">Throughput</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Error display
  const renderError = () => {
    if (!tendersState.error) return null

    const { error } = tendersState
    
    const getErrorIcon = () => {
      switch (error.type) {
        case "network":
          return <WifiOff className="h-5 w-5" />
        case "api":
          return <AlertCircle className="h-5 w-5" />
        case "timeout":
          return <Clock className="h-5 w-5" />
        case "rate_limit":
          return <RefreshCw className="h-5 w-5" />
        default:
          return <AlertCircle className="h-5 w-5" />
      }
    }

    const getErrorTitle = () => {
      switch (error.type) {
        case "network":
          return "Connection Problem"
        case "api":
          return "API Error"
        case "timeout":
          return "Request Timeout"
        case "rate_limit":
          return "Rate Limited"
        default:
          return "Error"
      }
    }

    return (
      <Alert variant="destructive" className="mb-6">
        {getErrorIcon()}
        <AlertTitle>{getErrorTitle()}</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">{error.message}</p>
          {error.retryable && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button size="sm" variant="outline" onClick={handleClearCache}>
                Clear Cache
              </Button>
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // Comprehensive statistics display with data freshness and performance metrics
  const renderStatistics = () => {
    const getDataFreshnessColor = () => {
      if (!tendersState.lastUpdated) return 'text-gray-500'
      
      const lastUpdate = new Date(tendersState.lastUpdated)
      const now = new Date()
      const minutesAgo = (now.getTime() - lastUpdate.getTime()) / (1000 * 60)
      
      if (minutesAgo < 5) return 'text-green-600'
      if (minutesAgo < 30) return 'text-yellow-600'
      return 'text-orange-600'
    }

    const getDataFreshnessText = () => {
      if (!tendersState.lastUpdated) return 'Never updated'
      
      const lastUpdate = new Date(tendersState.lastUpdated)
      const now = new Date()
      const minutesAgo = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60))
      
      if (minutesAgo < 1) return 'Just updated'
      if (minutesAgo < 60) return `${minutesAgo}m ago`
      
      const hoursAgo = Math.floor(minutesAgo / 60)
      if (hoursAgo < 24) return `${hoursAgo}h ago`
      
      const daysAgo = Math.floor(hoursAgo / 24)
      return `${daysAgo}d ago`
    }

    const completionPercentage = tendersState.totalCount > 0 
      ? (tendersState.fetchedCount / tendersState.totalCount) * 100 
      : 100

    return (
      <div className="space-y-4 mb-6">
        {/* Main statistics card */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tender counts */}
              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-900">
                  {filteredResult.filteredCount.toLocaleString()}
                  {filteredResult.filteredCount !== filteredResult.totalCount && (
                    <span className="text-lg text-muted-foreground font-normal">
                      {" of "}{filteredResult.totalCount.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredResult.filteredCount === 1 ? 'Tender' : 'Tenders'} Available
                  {filteredResult.appliedFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {filteredResult.appliedFiltersCount} filter{filteredResult.appliedFiltersCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Fetch completion status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-gray-900">
                    {completionPercentage.toFixed(0)}%
                  </div>
                  <div className={`h-2 w-2 rounded-full ${
                    completionPercentage === 100 ? 'bg-green-500' : 
                    completionPercentage > 80 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}></div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Data Completeness
                  <div className="text-xs">
                    {tendersState.fetchedCount.toLocaleString()} of {tendersState.totalCount.toLocaleString()} fetched
                  </div>
                </div>
              </div>

              {/* Data freshness */}
              <div className="space-y-2">
                <div className={`text-2xl font-bold ${getDataFreshnessColor()}`}>
                  {getDataFreshnessText()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Data Freshness
                  {tendersState.lastUpdated && (
                    <div className="text-xs">
                      Last updated {new Date(tendersState.lastUpdated).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Performance metrics row */}
            {tendersState.performance && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      {(tendersState.performance.totalFetchTime / 1000).toFixed(1)}s
                    </div>
                    <div className="text-xs text-muted-foreground">Fetch Time</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      {(tendersState.performance.cacheHitRate * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Cache Hit Rate</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      {tendersState.performance.averageRequestTime.toFixed(0)}ms
                    </div>
                    <div className="text-xs text-muted-foreground">Avg Request</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      {(tendersState.performance.errorRate * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Error Rate</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      {tendersState.performance.totalFetchTime > 0 
                        ? (tendersState.fetchedCount / (tendersState.performance.totalFetchTime / 1000)).toFixed(1)
                        : '0'
                      }/s
                    </div>
                    <div className="text-xs text-muted-foreground">Throughput</div>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings and errors summary */}
            {(tendersState.warnings.length > 0 || tendersState.error) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-4 text-sm">
                  {tendersState.warnings.length > 0 && (
                    <div className="flex items-center gap-2 text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>{tendersState.warnings.length} warning{tendersState.warnings.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  
                  {tendersState.error && (
                    <div className="flex items-center gap-2 text-red-600">
                      <WifiOff className="h-4 w-4" />
                      <span>Fetch error occurred</span>
                    </div>
                  )}
                  
                  {completionPercentage < 100 && !tendersState.loading && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <Clock className="h-4 w-4" />
                      <span>Partial data loaded</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Data quality indicator */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`h-2 w-2 rounded-full ${
                completionPercentage === 100 && tendersState.performance?.errorRate === 0 ? 'bg-green-500' :
                completionPercentage > 90 ? 'bg-yellow-500' : 'bg-orange-500'
              }`}></div>
              <span>
                {completionPercentage === 100 && tendersState.performance?.errorRate === 0 ? 'Excellent' :
                 completionPercentage > 90 ? 'Good' : 'Partial'} data quality
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {enableAdvancedFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                {showFilters ? "Hide Filters" : "Show Filters"}
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={tendersState.loading || isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${(tendersState.loading || isRefreshing) ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Warnings display
  const renderWarnings = () => {
    if (!tendersState.warnings || tendersState.warnings.length === 0) return null

    return (
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Partial Results</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {tendersState.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    )
  }

  // Enhanced loading skeleton that reflects comprehensive data structure
  const renderLoadingSkeleton = () => {
    const skeletonCount = tendersState.progress?.total || 10
    const loadedCount = tendersState.progress?.completed || 0
    
    return (
      <div className="space-y-6">
        {Array.from({ length: Math.min(skeletonCount, 20) }).map((_, index) => {
          const isLoaded = index < loadedCount
          const isLoading = index === loadedCount && tendersState.loading
          
          return (
            <Card key={index} className={`transition-all duration-500 ${
              isLoaded ? 'opacity-100 transform-none' : 
              isLoading ? 'opacity-75 animate-pulse' : 
              'opacity-40'
            }`}>
              <CardHeader className="space-y-4">
                {/* Header badges and ID */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                </div>
                
                {/* Title and entity */}
                <div className="space-y-2">
                  <Skeleton className="h-6 w-4/5" />
                  <Skeleton className="h-4 w-2/3" />
                </div>

                {/* Bid description */}
                <div className="bg-gray-50 p-3 rounded-md">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>

                {/* Enhanced information grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, infoIndex) => (
                    <div key={infoIndex} className="flex items-start gap-2">
                      <Skeleton className="h-4 w-4 rounded-full flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-4 w-24" />
                        {infoIndex === 2 && <Skeleton className="h-3 w-32 mt-1" />}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Special conditions section */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>

                {/* Footer with dates and badges */}
                <div className="flex items-center justify-between pt-4">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          )
        })}
        
        {/* Loading progress indicator at bottom */}
        {tendersState.loading && tendersState.progress && (
          <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Loading {tendersState.progress.currentPhase}...
                </span>
              </div>
              <div className="text-xs text-blue-700">
                {tendersState.progress.completed} of {tendersState.progress.total} items processed
                {tendersState.progress.estimatedTimeRemaining && (
                  <> • ~{Math.ceil(tendersState.progress.estimatedTimeRemaining / 1000)}s remaining</>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className={`enhanced-tender-listing ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Comprehensive Tender Opportunities
        </h1>
        <p className="text-gray-500">
          Browse all available procurement opportunities with advanced filtering and search
        </p>
      </div>

      {/* Performance Metrics */}
      {renderPerformanceMetrics()}

      {/* Progress Indicator */}
      {renderProgressIndicator()}

      {/* Error Display */}
      {renderError()}

      {/* Warnings */}
      {renderWarnings()}

      {/* Statistics and Controls */}
      {renderStatistics()}

      {/* Advanced Filters */}
      {enableAdvancedFilters && showFilters && (
        <div className="mb-6">
          <AdvancedTenderFilters
            filters={filters}
            sortConfig={sortConfig}
            filteredResult={filteredResult}
            onFiltersChange={filterActions.updateFilters}
            onSortChange={filterActions.updateSort}
            onClearFilters={filterActions.clearFilters}
            onClearSearch={filterActions.clearSearch}
            showResultsCount={false} // We show this in statistics
            collapsible={false}
          />
        </div>
      )}

      {/* Tender List */}
      {tendersState.loading && !tendersState.tenders.length ? (
        renderLoadingSkeleton()
      ) : filteredResult.filteredTenders.length > 0 ? (
        enableVirtualScrolling ? (
          <VirtualTenderList
            tenders={filteredResult.filteredTenders}
            loading={tendersState.loading}
            virtualScrollConfig={{
              itemHeight: 220,
              containerHeight: 800,
              overscan: 5,
              dynamicHeight: true,
            }}
            showLoadingSkeletons={tendersState.loading}
            skeletonCount={10}
          />
        ) : (
          <div className="space-y-6">
            {filteredResult.filteredTenders.map((tender) => (
              <Card key={tender.ocid} className="hover:shadow-md transition-all duration-200">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="destructive" className="text-xs">
                        NEW
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {tender.tender.status || "Active"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {tender.tender.id || tender.ocid}
                    </div>
                  </div>
                  
                  <CardTitle className="hover:text-primary transition-colors text-lg leading-tight">
                    {tender.tender.title}
                  </CardTitle>
                  
                  <div className="text-sm text-muted-foreground font-medium">
                    {tender.tender.procuringEntity?.name || "Unknown Entity"}
                  </div>

                  {/* Enhanced bid description */}
                  {tender.tender.requestForBid?.bidDescription && (
                    <div className="text-sm text-gray-700 line-clamp-2 bg-gray-50 p-3 rounded-md">
                      {tender.tender.requestForBid.bidDescription}
                    </div>
                  )}

                  {/* Enhanced information with better visual hierarchy */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {tender.tender.requestForBid?.department && (
                      <div className="flex items-start gap-2">
                        <Building className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Department</div>
                          <div className="font-medium text-gray-900">{tender.tender.requestForBid.department}</div>
                        </div>
                      </div>
                    )}
                    
                    {tender.tender.requestForBid?.deliveryLocation && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Delivery Location</div>
                          <div className="font-medium text-gray-900">{tender.tender.requestForBid.deliveryLocation}</div>
                        </div>
                      </div>
                    )}
                    
                    {tender.tender.contactInformation?.contactPerson && (
                      <div className="flex items-start gap-2">
                        <div className="h-4 w-4 bg-purple-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                          <div className="h-2 w-2 bg-purple-600 rounded-full"></div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Contact Person</div>
                          <div className="font-medium text-gray-900">{tender.tender.contactInformation.contactPerson}</div>
                          {tender.tender.contactInformation.email && (
                            <div className="text-xs text-blue-600 hover:underline cursor-pointer">
                              {tender.tender.contactInformation.email}
                            </div>
                          )}
                          {tender.tender.contactInformation.telephone && (
                            <div className="text-xs text-gray-600">
                              Tel: {tender.tender.contactInformation.telephone}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {tender.tender.value?.amount && (
                      <div className="flex items-start gap-2">
                        <div className="h-4 w-4 bg-emerald-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                          <div className="h-2 w-2 bg-emerald-600 rounded-full"></div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Estimated Value</div>
                          <div className="font-medium text-gray-900">
                            {tender.tender.value.currency} {tender.tender.value.amount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Special conditions and briefing info */}
                  {(tender.tender.specialConditions?.length || tender.tender.briefingSession?.hasBriefing) && (
                    <div className="border-t pt-3 space-y-2">
                      {tender.tender.briefingSession?.hasBriefing && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className={`h-2 w-2 rounded-full ${tender.tender.briefingSession.isCompulsory ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                          <span className="font-medium">
                            {tender.tender.briefingSession.isCompulsory ? 'Compulsory Briefing' : 'Optional Briefing'}
                          </span>
                          {tender.tender.briefingSession.date && (
                            <span className="text-muted-foreground">
                              on {new Date(tender.tender.briefingSession.date).toLocaleDateString()}
                            </span>
                          )}
                          {tender.tender.briefingSession.venue && (
                            <span className="text-muted-foreground">
                              at {tender.tender.briefingSession.venue}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {tender.tender.specialConditions && tender.tender.specialConditions.length > 0 && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Special Conditions: </span>
                          <span className="text-orange-700 font-medium">
                            {tender.tender.specialConditions.length} condition{tender.tender.specialConditions.length !== 1 ? 's' : ''} apply
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-muted-foreground">
                      {tender.tender.tenderPeriod?.endDate ? (
                        <>Closing {new Date(tender.tender.tenderPeriod.endDate).toLocaleDateString()}</>
                      ) : tender.tender.keyDates?.closingDate ? (
                        <>Closing {new Date(tender.tender.keyDates.closingDate).toLocaleDateString()}</>
                      ) : (
                        "Closing date not specified"
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {tender.tender.briefingSession?.hasBriefing && (
                        <Badge variant="outline" className="text-xs">
                          {tender.tender.briefingSession.isCompulsory ? "Compulsory Briefing" : "Briefing Available"}
                        </Badge>
                      )}
                      
                      <Badge variant="secondary" className="text-xs">
                        {tender.tender.mainProcurementCategory || "General"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="border border-gray-200">
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tenders found</h3>
            <p className="text-gray-500 mb-4">
              {filteredResult.appliedFiltersCount > 0 
                ? "Try adjusting your filters or search terms to find more results."
                : "No tenders are currently available for the selected date range."
              }
            </p>
            {filteredResult.appliedFiltersCount > 0 && (
              <Button onClick={filterActions.clearFilters} variant="outline">
                Clear All Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}