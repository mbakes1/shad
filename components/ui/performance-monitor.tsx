"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  Activity,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { PerformanceMetrics } from "@/lib/hooks/use-comprehensive-tenders";

interface PerformanceMonitorProps {
  performance: PerformanceMetrics | null;
  lastUpdated: string | null;
  totalCount: number;
  fetchedCount: number;
  loading: boolean;
  className?: string;
  showOptimizationSuggestions?: boolean;
}

interface OptimizationSuggestion {
  type: "info" | "warning" | "success";
  message: string;
  icon: React.ReactNode;
}

export function PerformanceMonitor({
  performance,
  lastUpdated,
  totalCount,
  fetchedCount,
  loading,
  className = "",
  showOptimizationSuggestions = true,
}: PerformanceMonitorProps) {
  // Format duration in human-readable format
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${Math.round(value * 100)}%`;
  };

  // Calculate data freshness
  const getDataFreshness = (): {
    status: "fresh" | "stale" | "old";
    message: string;
    color: string;
  } => {
    if (!lastUpdated)
      return { status: "old", message: "No data", color: "text-gray-500" };

    const now = new Date();
    const updated = new Date(lastUpdated);
    const diffMinutes = Math.floor(
      (now.getTime() - updated.getTime()) / (1000 * 60)
    );

    if (diffMinutes < 5) {
      return {
        status: "fresh",
        message: "Just updated",
        color: "text-green-600",
      };
    } else if (diffMinutes < 30) {
      return {
        status: "fresh",
        message: `${diffMinutes}m ago`,
        color: "text-green-600",
      };
    } else if (diffMinutes < 120) {
      return {
        status: "stale",
        message: `${diffMinutes}m ago`,
        color: "text-yellow-600",
      };
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      return {
        status: "old",
        message: `${diffHours}h ago`,
        color: "text-red-600",
      };
    }
  };

  // Generate optimization suggestions
  const getOptimizationSuggestions = (): OptimizationSuggestion[] => {
    if (!performance) return [];

    const suggestions: OptimizationSuggestion[] = [];

    // Performance-based suggestions
    if (performance.totalFetchTime > 10000) {
      suggestions.push({
        type: "warning",
        message:
          "Fetch time is high. Consider reducing date range or enabling caching.",
        icon: <Clock className="h-4 w-4" />,
      });
    } else if (performance.totalFetchTime < 3000) {
      suggestions.push({
        type: "success",
        message: "Excellent fetch performance!",
        icon: <Zap className="h-4 w-4" />,
      });
    }

    // Cache hit rate suggestions
    if (performance.cacheHitRate < 0.3) {
      suggestions.push({
        type: "warning",
        message: "Low cache hit rate. Data is being fetched frequently.",
        icon: <Database className="h-4 w-4" />,
      });
    } else if (performance.cacheHitRate > 0.8) {
      suggestions.push({
        type: "success",
        message: "Great cache utilization!",
        icon: <CheckCircle className="h-4 w-4" />,
      });
    }

    // Error rate suggestions
    if (performance.errorRate > 0.1) {
      suggestions.push({
        type: "warning",
        message: "High error rate detected. Check network connectivity.",
        icon: <AlertTriangle className="h-4 w-4" />,
      });
    } else if (performance.errorRate === 0) {
      suggestions.push({
        type: "success",
        message: "No errors encountered!",
        icon: <CheckCircle className="h-4 w-4" />,
      });
    }

    return suggestions;
  };

  const freshness = getDataFreshness();
  const optimizationSuggestions = showOptimizationSuggestions
    ? getOptimizationSuggestions()
    : [];

  if (loading && !performance) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 animate-pulse" />
            Performance Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant="secondary" className="animate-pulse">
              Loading...
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Performance Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Data Freshness */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Data Freshness</span>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                freshness.status === "fresh"
                  ? "bg-green-500"
                  : freshness.status === "stale"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            />
            <span className={`text-sm font-medium ${freshness.color}`}>
              {freshness.message}
            </span>
          </div>
        </div>

        {/* Data Coverage */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Data Coverage</span>
          <span className="text-sm font-medium">
            {fetchedCount.toLocaleString()} / {totalCount.toLocaleString()}{" "}
            tenders
          </span>
        </div>

        {performance && (
          <>
            <Separator />

            {/* Performance Metrics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Total Fetch Time
                </span>
                <Badge
                  variant={
                    performance.totalFetchTime > 10000
                      ? "destructive"
                      : performance.totalFetchTime > 5000
                      ? "secondary"
                      : "default"
                  }
                >
                  {formatDuration(performance.totalFetchTime)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Avg Request Time
                </span>
                <span className="text-sm font-medium">
                  {formatDuration(performance.averageRequestTime)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Cache Hit Rate
                </span>
                <Badge
                  variant={
                    performance.cacheHitRate > 0.7
                      ? "default"
                      : performance.cacheHitRate > 0.3
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {formatPercentage(performance.cacheHitRate)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Error Rate
                </span>
                <Badge
                  variant={
                    performance.errorRate === 0
                      ? "default"
                      : performance.errorRate < 0.1
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {formatPercentage(performance.errorRate)}
                </Badge>
              </div>

              {/* Detailed Timing */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Discovery Phase</span>
                  <span>{formatDuration(performance.discoveryTime)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Data Aggregation
                  </span>
                  <span>{formatDuration(performance.aggregationTime)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Optimization Suggestions */}
        {optimizationSuggestions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4" />
                Optimization Tips
              </div>
              {optimizationSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                >
                  <div
                    className={`mt-0.5 ${
                      suggestion.type === "success"
                        ? "text-green-600"
                        : suggestion.type === "warning"
                        ? "text-yellow-600"
                        : "text-blue-600"
                    }`}
                  >
                    {suggestion.icon}
                  </div>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {suggestion.message}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Last Updated Timestamp */}
        {lastUpdated && (
          <>
            <Separator />
            <div className="text-xs text-muted-foreground text-center">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
