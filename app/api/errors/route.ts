import { type NextRequest, NextResponse } from "next/server"
import { getErrorHandler } from "@/lib/services/error-handler"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action") || "stats"

  try {
    const errorHandler = getErrorHandler()

    switch (action) {
      case "stats":
        const stats = errorHandler.getErrorStatistics()
        return NextResponse.json({
          success: true,
          data: {
            ...stats,
            recoverySuccessRatePercentage: Math.round(stats.recoverySuccessRate * 100),
            errorDistribution: {
              byType: Object.entries(stats.errorsByType).map(([type, count]) => ({
                type,
                count,
                percentage: Math.round((count / stats.totalErrors) * 100),
              })),
              bySeverity: Object.entries(stats.errorsBySeverity).map(([severity, count]) => ({
                severity,
                count,
                percentage: Math.round((count / stats.totalErrors) * 100),
              })),
            },
          },
          timestamp: new Date().toISOString(),
        })

      case "health":
        const healthStats = errorHandler.getErrorStatistics()
        const isHealthy = healthStats.recoverySuccessRate > 0.7 && healthStats.totalErrors < 100
        
        return NextResponse.json({
          success: true,
          healthy: isHealthy,
          data: {
            totalErrors: healthStats.totalErrors,
            recoverySuccessRate: Math.round(healthStats.recoverySuccessRate * 100),
            status: isHealthy ? "healthy" : "warning",
            recommendations: isHealthy ? [] : [
              healthStats.recoverySuccessRate < 0.7 ? "Low recovery success rate - check error handling strategies" : null,
              healthStats.totalErrors > 100 ? "High error count - investigate common error patterns" : null,
            ].filter(Boolean),
            commonPatterns: healthStats.commonPatterns.slice(0, 3), // Top 3 patterns
          },
          timestamp: new Date().toISOString(),
        })

      case "patterns":
        const patternStats = errorHandler.getErrorStatistics()
        return NextResponse.json({
          success: true,
          data: {
            commonPatterns: patternStats.commonPatterns,
            errorsByType: patternStats.errorsByType,
            errorsBySeverity: patternStats.errorsBySeverity,
            totalErrors: patternStats.totalErrors,
            analysisRecommendations: [
              "Monitor network errors for infrastructure issues",
              "Check timeout patterns for performance optimization",
              "Review API errors for service reliability",
              "Analyze parsing errors for data quality issues",
            ],
          },
          timestamp: new Date().toISOString(),
        })

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action",
          availableActions: ["stats", "health", "patterns"],
        }, { status: 400 })
    }
  } catch (error) {
    console.error("Error monitoring API error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to retrieve error information",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}