"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  WifiOff,
  RefreshCw,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap,
  CloudOff,
} from "lucide-react";
import { FetchError } from "@/lib/hooks/use-comprehensive-tenders";

interface OfflineErrorDisplayProps {
  error: FetchError | null;
  isOffline?: boolean;
  hasOfflineData?: boolean;
  offlineDataAge?: number;
  isStaleData?: boolean;
  recommendations?: string[];
  onRetry?: () => void;
  onClearCache?: () => void;
  onUseOfflineData?: () => void;
  className?: string;
  showDetailedInfo?: boolean;
}

export function OfflineErrorDisplay({
  error,
  isOffline = false,
  hasOfflineData = false,
  offlineDataAge,
  isStaleData = false,
  recommendations = [],
  onRetry,
  onClearCache,
  onUseOfflineData,
  className = "",
  showDetailedInfo = true,
}: OfflineErrorDisplayProps) {
  // Format offline data age
  const formatDataAge = (ageMs: number): string => {
    const minutes = Math.floor(ageMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days !== 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    return "just now";
  };

  // Get error icon based on type and offline state
  const getErrorIcon = () => {
    if (isOffline) return <WifiOff className="h-5 w-5" />;
    if (!error) return <Info className="h-5 w-5" />;

    switch (error.type) {
      case "network":
        return <WifiOff className="h-5 w-5" />;
      case "api":
        return <AlertTriangle className="h-5 w-5" />;
      case "timeout":
        return <Clock className="h-5 w-5" />;
      case "rate_limit":
        return <RefreshCw className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  // Get error title
  const getErrorTitle = () => {
    if (isOffline) return "Working Offline";
    if (!error) return "Information";

    switch (error.type) {
      case "network":
        return "Connection Problem";
      case "api":
        return "Service Unavailable";
      case "timeout":
        return "Request Timeout";
      case "rate_limit":
        return "Rate Limited";
      default:
        return "Error Occurred";
    }
  };

  // Get alert variant
  const getAlertVariant = (): "default" | "destructive" => {
    if (isOffline && hasOfflineData) return "default";
    if (error && !hasOfflineData) return "destructive";
    return "default";
  };

  // Get status badge
  const getStatusBadge = () => {
    if (isOffline && hasOfflineData) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CloudOff className="h-3 w-3" />
          Offline Mode
        </Badge>
      );
    }

    if (hasOfflineData && isStaleData) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Database className="h-3 w-3" />
          Cached Data
        </Badge>
      );
    }

    if (hasOfflineData) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Recent Cache
        </Badge>
      );
    }

    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        No Data
      </Badge>
    );
  };

  return (
    <div className={className}>
      <Alert variant={getAlertVariant()} className="border-l-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {getErrorIcon()}
            <div className="flex-1">
              <AlertTitle className="flex items-center gap-2 mb-2">
                {getErrorTitle()}
                {getStatusBadge()}
              </AlertTitle>

              <AlertDescription className="space-y-3">
                {/* Main error message */}
                <div>
                  {isOffline ? (
                    <p>
                      You're currently offline.{" "}
                      {hasOfflineData
                        ? "Using cached data to continue working."
                        : "No cached data is available."}
                    </p>
                  ) : error ? (
                    <p>{error.message}</p>
                  ) : (
                    <p>System information and status.</p>
                  )}
                </div>

                {/* Offline data information */}
                {hasOfflineData && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Cached Data Available
                      </span>
                    </div>

                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      {offlineDataAge && (
                        <div className="flex items-center justify-between">
                          <span>Last updated:</span>
                          <span
                            className={`font-medium ${
                              isStaleData ? "text-orange-600" : "text-green-600"
                            }`}
                          >
                            {formatDataAge(offlineDataAge)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span>Data quality:</span>
                        <span
                          className={`font-medium ${
                            isStaleData ? "text-orange-600" : "text-green-600"
                          }`}
                        >
                          {isStaleData ? "May be outdated" : "Recent"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Info className="h-4 w-4" />
                      Recommendations
                    </div>
                    <ul className="text-sm space-y-1 ml-6">
                      {recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {onRetry && (
                    <Button
                      size="sm"
                      onClick={onRetry}
                      disabled={isOffline}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {isOffline ? "Retry When Online" : "Retry Now"}
                    </Button>
                  )}

                  {hasOfflineData && onUseOfflineData && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onUseOfflineData}
                      className="flex items-center gap-2"
                    >
                      <Database className="h-4 w-4" />
                      Use Cached Data
                    </Button>
                  )}

                  {onClearCache && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onClearCache}
                      className="flex items-center gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      Clear Cache
                    </Button>
                  )}
                </div>

                {/* Detailed technical information */}
                {showDetailedInfo && error && (
                  <details className="mt-4">
                    <summary className="text-sm font-medium cursor-pointer hover:text-foreground/80">
                      Technical Details
                    </summary>
                    <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono space-y-1">
                      <div>
                        <strong>Error Type:</strong> {error.type}
                      </div>
                      {error.statusCode && (
                        <div>
                          <strong>Status Code:</strong> {error.statusCode}
                        </div>
                      )}
                      {error.retryAfter && (
                        <div>
                          <strong>Retry After:</strong> {error.retryAfter}ms
                        </div>
                      )}
                      <div>
                        <strong>Retryable:</strong>{" "}
                        {error.retryable ? "Yes" : "No"}
                      </div>
                      <div>
                        <strong>Timestamp:</strong> {new Date().toISOString()}
                      </div>
                    </div>
                  </details>
                )}
              </AlertDescription>
            </div>
          </div>
        </div>
      </Alert>

      {/* Connection status indicator */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isOffline ? "bg-red-500" : "bg-green-500"
            }`}
          />
          <span>{isOffline ? "Offline" : "Online"}</span>
        </div>

        {hasOfflineData && (
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3" />
            <span>Cached data available</span>
          </div>
        )}
      </div>
    </div>
  );
}
