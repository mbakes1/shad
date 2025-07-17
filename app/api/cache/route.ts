import { type NextRequest, NextResponse } from "next/server"
import { getCacheManager } from "@/lib/services/cache-manager"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action") || "stats"

  try {
    const cacheManager = getCacheManager()

    switch (action) {
      case "stats":
        const stats = await cacheManager.getStats()
        return NextResponse.json({
          success: true,
          data: {
            ...stats,
            hitRatePercentage: Math.round(stats.hitRate * 100),
            missRatePercentage: Math.round(stats.missRate * 100),
            memoryUsageMB: Math.round(stats.memoryUsage * 100) / 100,
            compressionRatioPercentage: Math.round((1 - stats.compressionRatio) * 100),
          },
          timestamp: new Date().toISOString(),
        })

      case "health":
        const healthStats = await cacheManager.getStats()
        const isHealthy = healthStats.memoryUsage < 80 && healthStats.hitRate > 0.3
        
        return NextResponse.json({
          success: true,
          healthy: isHealthy,
          data: {
            memoryUsage: Math.round(healthStats.memoryUsage * 100) / 100,
            hitRate: Math.round(healthStats.hitRate * 100) / 100,
            totalEntries: healthStats.totalEntries,
            status: isHealthy ? "healthy" : "warning",
            recommendations: isHealthy ? [] : [
              healthStats.memoryUsage > 80 ? "High memory usage - consider clearing cache" : null,
              healthStats.hitRate < 0.3 ? "Low hit rate - cache may need tuning" : null,
            ].filter(Boolean),
          },
          timestamp: new Date().toISOString(),
        })

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action",
          availableActions: ["stats", "health"],
        }, { status: 400 })
    }
  } catch (error) {
    console.error("Cache API error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to retrieve cache information",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  try {
    const cacheManager = getCacheManager()

    switch (action) {
      case "clear":
        await cacheManager.clear()
        return NextResponse.json({
          success: true,
          message: "Cache cleared successfully",
          timestamp: new Date().toISOString(),
        })

      case "invalidate":
        const body = await request.json()
        const { pattern } = body

        if (!pattern) {
          return NextResponse.json({
            success: false,
            error: "Pattern is required for invalidation",
          }, { status: 400 })
        }

        const invalidatedCount = await cacheManager.invalidate(pattern)
        return NextResponse.json({
          success: true,
          message: `Invalidated ${invalidatedCount} cache entries`,
          data: { invalidatedCount, pattern },
          timestamp: new Date().toISOString(),
        })

      case "invalidate-date-range":
        const dateBody = await request.json()
        const { dateFrom, dateTo } = dateBody

        if (!dateFrom || !dateTo) {
          return NextResponse.json({
            success: false,
            error: "dateFrom and dateTo are required",
          }, { status: 400 })
        }

        const dateInvalidatedCount = await cacheManager.invalidateByDateRange(dateFrom, dateTo)
        return NextResponse.json({
          success: true,
          message: `Invalidated ${dateInvalidatedCount} cache entries for date range`,
          data: { invalidatedCount: dateInvalidatedCount, dateFrom, dateTo },
          timestamp: new Date().toISOString(),
        })

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action",
          availableActions: ["clear", "invalidate", "invalidate-date-range"],
        }, { status: 400 })
    }
  } catch (error) {
    console.error("Cache management error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to perform cache operation",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}