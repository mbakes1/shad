"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"
import Link from "next/link"
import { EnhancedTenderInfo } from "@/lib/hooks/use-comprehensive-tenders"

export interface VirtualScrollConfig {
  itemHeight: number
  containerHeight: number
  overscan: number
  dynamicHeight: boolean
}

export interface VirtualTenderListProps {
  tenders: EnhancedTenderInfo[]
  loading?: boolean
  onItemClick?: (tender: EnhancedTenderInfo) => void
  virtualScrollConfig?: Partial<VirtualScrollConfig>
  className?: string
  showLoadingSkeletons?: boolean
  skeletonCount?: number
}

interface VirtualItem {
  index: number
  tender: EnhancedTenderInfo
  height: number
  offset: number
}

interface ViewportInfo {
  scrollTop: number
  containerHeight: number
  startIndex: number
  endIndex: number
  visibleItems: VirtualItem[]
  totalHeight: number
}

const DEFAULT_CONFIG: VirtualScrollConfig = {
  itemHeight: 200, // Default height for tender cards
  containerHeight: 600, // Default container height
  overscan: 5, // Number of items to render outside viewport
  dynamicHeight: true, // Enable dynamic height calculation
}

export default function VirtualTenderList({
  tenders,
  loading = false,
  onItemClick,
  virtualScrollConfig = {},
  className = "",
  showLoadingSkeletons = true,
  skeletonCount = 10,
}: VirtualTenderListProps) {
  const config = { ...DEFAULT_CONFIG, ...virtualScrollConfig }
  
  // Refs for DOM elements and measurements
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const itemHeightsRef = useRef<Map<number, number>>(new Map())
  const itemElementsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  
  // State for virtual scrolling
  const [viewport, setViewport] = useState<ViewportInfo>({
    scrollTop: 0,
    containerHeight: config.containerHeight,
    startIndex: 0,
    endIndex: 0,
    visibleItems: [],
    totalHeight: 0,
  })
  
  // State for scroll position persistence
  const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0)
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState<boolean>(false)

  // Memoized item heights calculation
  const itemHeights = useMemo(() => {
    if (!config.dynamicHeight) {
      return tenders.map(() => config.itemHeight)
    }

    return tenders.map((_, index) => {
      const measuredHeight = itemHeightsRef.current.get(index)
      return measuredHeight || config.itemHeight
    })
  }, [tenders, config.dynamicHeight, config.itemHeight])

  // Memoized cumulative heights for efficient offset calculation
  const cumulativeHeights = useMemo(() => {
    const heights = [0]
    for (let i = 0; i < itemHeights.length; i++) {
      heights.push(heights[i] + itemHeights[i])
    }
    return heights
  }, [itemHeights])

  // Calculate total height
  const totalHeight = useMemo(() => {
    return cumulativeHeights[cumulativeHeights.length - 1] || 0
  }, [cumulativeHeights])

  // Binary search to find start index based on scroll position
  const findStartIndex = useCallback((scrollTop: number): number => {
    let left = 0
    let right = cumulativeHeights.length - 1
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (cumulativeHeights[mid] < scrollTop) {
        left = mid + 1
      } else {
        right = mid
      }
    }
    
    return Math.max(0, left - 1)
  }, [cumulativeHeights])

  // Calculate visible items based on viewport
  const calculateVisibleItems = useCallback((scrollTop: number, containerHeight: number): VirtualItem[] => {
    if (tenders.length === 0) return []

    const startIndex = Math.max(0, findStartIndex(scrollTop) - config.overscan)
    const endScrollTop = scrollTop + containerHeight
    
    let endIndex = startIndex
    while (endIndex < tenders.length && cumulativeHeights[endIndex] < endScrollTop) {
      endIndex++
    }
    endIndex = Math.min(tenders.length - 1, endIndex + config.overscan)

    const visibleItems: VirtualItem[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      if (i < tenders.length) {
        visibleItems.push({
          index: i,
          tender: tenders[i],
          height: itemHeights[i],
          offset: cumulativeHeights[i],
        })
      }
    }

    return visibleItems
  }, [tenders, cumulativeHeights, itemHeights, findStartIndex, config.overscan])

  // Update viewport when scroll position or container size changes
  const updateViewport = useCallback(() => {
    if (!scrollElementRef.current) return

    const scrollTop = scrollElementRef.current.scrollTop
    const containerHeight = scrollElementRef.current.clientHeight
    
    const visibleItems = calculateVisibleItems(scrollTop, containerHeight)
    const startIndex = visibleItems.length > 0 ? visibleItems[0].index : 0
    const endIndex = visibleItems.length > 0 ? visibleItems[visibleItems.length - 1].index : 0

    setViewport({
      scrollTop,
      containerHeight,
      startIndex,
      endIndex,
      visibleItems,
      totalHeight,
    })
  }, [calculateVisibleItems, totalHeight])

  // Handle scroll events with throttling
  const handleScroll = useCallback(() => {
    updateViewport()
    
    // Save scroll position for persistence
    if (scrollElementRef.current) {
      setSavedScrollPosition(scrollElementRef.current.scrollTop)
    }
  }, [updateViewport])

  // Measure item height when it's rendered
  const measureItemHeight = useCallback((index: number, element: HTMLDivElement | null) => {
    if (!element || !config.dynamicHeight) return

    const height = element.getBoundingClientRect().height
    const currentHeight = itemHeightsRef.current.get(index)
    
    if (currentHeight !== height) {
      itemHeightsRef.current.set(index, height)
      itemElementsRef.current.set(index, element)
      
      // Trigger viewport recalculation if height changed significantly
      if (Math.abs((currentHeight || config.itemHeight) - height) > 10) {
        requestAnimationFrame(updateViewport)
      }
    }
  }, [config.dynamicHeight, config.itemHeight, updateViewport])

  // Setup ResizeObserver for dynamic height measurement
  useEffect(() => {
    if (!config.dynamicHeight) return

    resizeObserverRef.current = new ResizeObserver((entries) => {
      let shouldUpdate = false
      
      entries.forEach((entry) => {
        const element = entry.target as HTMLDivElement
        const index = parseInt(element.dataset.index || '-1', 10)
        
        if (index >= 0) {
          const height = entry.contentRect.height
          const currentHeight = itemHeightsRef.current.get(index)
          
          if (currentHeight !== height) {
            itemHeightsRef.current.set(index, height)
            shouldUpdate = true
          }
        }
      })
      
      if (shouldUpdate) {
        requestAnimationFrame(updateViewport)
      }
    })

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
    }
  }, [config.dynamicHeight, updateViewport])

  // Observe visible items for height changes
  useEffect(() => {
    if (!config.dynamicHeight || !resizeObserverRef.current) return

    // Observe all currently visible items
    viewport.visibleItems.forEach((item) => {
      const element = itemElementsRef.current.get(item.index)
      if (element) {
        resizeObserverRef.current!.observe(element)
      }
    })

    return () => {
      if (resizeObserverRef.current) {
        // Unobserve all items
        itemElementsRef.current.forEach((element) => {
          resizeObserverRef.current!.unobserve(element)
        })
      }
    }
  }, [viewport.visibleItems, config.dynamicHeight])

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      updateViewport()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateViewport])

  // Initial viewport calculation and scroll restoration
  useEffect(() => {
    updateViewport()
    
    // Restore scroll position if needed
    if (shouldRestoreScroll && scrollElementRef.current && savedScrollPosition > 0) {
      scrollElementRef.current.scrollTop = savedScrollPosition
      setShouldRestoreScroll(false)
      updateViewport()
    }
  }, [tenders.length, updateViewport, shouldRestoreScroll, savedScrollPosition])

  // Save scroll position when tenders change (for data refresh)
  useEffect(() => {
    if (scrollElementRef.current && tenders.length > 0) {
      setShouldRestoreScroll(true)
    }
  }, [tenders])

  // Utility functions for status and category badges
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case "active":
        return "default"
      case "closed":
        return "destructive"
      case "cancelled":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getCategoryVariant = (category: string): "default" | "secondary" | "destructive" | "outline" => {
    return "secondary"
  }

  // Render individual tender item
  const renderTenderItem = useCallback((item: VirtualItem) => {
    const { tender, index, offset } = item
    
    return (
      <div
        key={tender.ocid}
        data-index={index}
        ref={(el) => measureItemHeight(index, el)}
        style={{
          position: 'absolute',
          top: offset,
          left: 0,
          right: 0,
          minHeight: config.itemHeight,
        }}
        className="px-4"
      >
        <Link 
          href={`/tender/${encodeURIComponent(tender.ocid)}`}
          onClick={() => onItemClick?.(tender)}
        >
          <Card className="hover:shadow-md transition-all duration-200 cursor-pointer group mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="destructive" className="text-xs">
                    NEW
                  </Badge>
                  <Badge 
                    variant={getStatusVariant(tender.tender.status)} 
                    className="text-xs"
                  >
                    {tender.tender.status || "Active"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground font-mono">
                  {tender.tender.id || tender.ocid}
                </div>
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">
                {tender.tender.procuringEntity?.name || "Unknown Entity"}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {tender.tender.title}
              </CardDescription>
              
              {/* Enhanced information from comprehensive data */}
              {tender.tender.requestForBid?.department && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Department:</span> {tender.tender.requestForBid.department}
                </div>
              )}
              
              {tender.tender.requestForBid?.deliveryLocation && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Location:</span> {tender.tender.requestForBid.deliveryLocation}
                </div>
              )}
            </CardHeader>
            
            <CardFooter className="flex items-center justify-between pt-0">
              <div className="text-sm text-muted-foreground">
                {tender.tender.tenderPeriod?.endDate ? (
                  <>Closing {format(new Date(tender.tender.tenderPeriod.endDate), "d MMM yyyy h:mmaaa")}</>
                ) : tender.tender.keyDates?.closingDate ? (
                  <>Closing {format(new Date(tender.tender.keyDates.closingDate), "d MMM yyyy h:mmaaa")}</>
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
                <Badge variant={getCategoryVariant(tender.tender.mainProcurementCategory)} className="text-xs">
                  {tender.tender.mainProcurementCategory || "General"}
                </Badge>
              </div>
            </CardFooter>
          </Card>
        </Link>
      </div>
    )
  }, [config.itemHeight, measureItemHeight, onItemClick])

  // Render loading skeletons
  const renderLoadingSkeletons = () => {
    if (!showLoadingSkeletons) return null

    return Array.from({ length: skeletonCount }).map((_, index) => (
      <div
        key={`skeleton-${index}`}
        style={{
          position: 'absolute',
          top: index * config.itemHeight,
          left: 0,
          right: 0,
          height: config.itemHeight,
        }}
        className="px-4"
      >
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardFooter className="flex items-center justify-between pt-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20" />
          </CardFooter>
        </Card>
      </div>
    ))
  }

  return (
    <div 
      ref={containerRef}
      className={`virtual-tender-list ${className}`}
      style={{ height: config.containerHeight }}
    >
      <div
        ref={scrollElementRef}
        className="overflow-auto h-full"
        onScroll={handleScroll}
        style={{ 
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div
          className="relative"
          style={{ 
            height: loading ? skeletonCount * config.itemHeight : totalHeight,
            minHeight: config.containerHeight,
          }}
        >
          {loading ? (
            renderLoadingSkeletons()
          ) : (
            viewport.visibleItems.map(renderTenderItem)
          )}
        </div>
      </div>
      
      {/* Debug information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 bg-black/80 text-white text-xs p-2 rounded">
          <div>Items: {tenders.length}</div>
          <div>Visible: {viewport.startIndex}-{viewport.endIndex}</div>
          <div>Scroll: {Math.round(viewport.scrollTop)}</div>
          <div>Height: {Math.round(totalHeight)}</div>
        </div>
      )}
    </div>
  )
}

// Hook for managing virtual scroll state and configuration
export function useVirtualScroll(
  itemCount: number,
  options: Partial<VirtualScrollConfig> = {}
) {
  const config = { ...DEFAULT_CONFIG, ...options }
  const [scrollPosition, setScrollPosition] = useState(0)
  const [containerHeight, setContainerHeight] = useState(config.containerHeight)

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const element = document.querySelector(`[data-index="${index}"]`)
    if (element) {
      element.scrollIntoView({ behavior, block: 'start' })
    }
  }, [])

  const scrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = document.querySelector('.virtual-tender-list .overflow-auto')
    if (container) {
      container.scrollTo({ top: 0, behavior })
    }
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = document.querySelector('.virtual-tender-list .overflow-auto')
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior })
    }
  }, [])

  return {
    config,
    scrollPosition,
    containerHeight,
    actions: {
      scrollToIndex,
      scrollToTop,
      scrollToBottom,
      setScrollPosition,
      setContainerHeight,
    },
  }
}