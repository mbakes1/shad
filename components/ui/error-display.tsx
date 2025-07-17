/**
 * User-friendly error display components for partial failures
 * Provides error categorization, retry options, and appropriate user messaging
 */

import React from "react";
import {
  AlertCircle,
  WifiOff,
  Clock,
  Zap,
  RefreshCw,
  X,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Separator } from "./separator";

export interface ErrorDisplayProps {
  errors: DisplayError[];
  onRetry?: (errorIds?: string[]) => void;
  onDismiss?: (errorId: string) => void;
  onRetryAll?: () => void;
  showTechnicalDetails?: boolean;
  className?: string;
}

export interface DisplayError {
  id: string;
  type:
    | "network"
    | "api"
    | "timeout"
    | "rate_limit"
    | "parsing"
    | "validation"
    | "memory"
    | "unknown";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  technicalMessage?: string;
  retryable: boolean;
  retryCount?: number;
  timestamp: number;
  context?: {
    operation?: string;
    pageNumber?: number;
    totalPages?: number;
  };
  recoveryAttempts?: Array<{
    strategy: string;
    success: boolean;
    timestamp: number;
  }>;
}

export interface PartialFailureDisplayProps {
  successCount: number;
  totalCount: number;
  errors: DisplayError[];
  partialData?: any;
  onRetryFailed?: () => void;
  onContinueWithPartial?: () => void;
  onRetryAll?: () => void;
  showDetails?: boolean;
}

const ErrorIcon = ({
  type,
  className = "h-4 w-4",
}: {
  type: DisplayError["type"];
  className?: string;
}) => {
  switch (type) {
    case "network":
      return <WifiOff className={className} />;
    case "timeout":
      return <Clock className={className} />;
    case "rate_limit":
      return <Zap className={className} />;
    case "api":
    case "parsing":
    case "validation":
      return <AlertCircle className={className} />;
    default:
      return <AlertTriangle className={className} />;
  }
};

const getSeverityColor = (severity: DisplayError["severity"]) => {
  switch (severity) {
    case "low":
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "medium":
      return "text-orange-600 bg-orange-50 border-orange-200";
    case "high":
      return "text-red-600 bg-red-50 border-red-200";
    case "critical":
      return "text-red-800 bg-red-100 border-red-300";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
};

const getErrorTitle = (type: DisplayError["type"]) => {
  switch (type) {
    case "network":
      return "Connection Issue";
    case "timeout":
      return "Request Timeout";
    case "rate_limit":
      return "Rate Limited";
    case "api":
      return "Service Error";
    case "parsing":
      return "Data Format Error";
    case "validation":
      return "Validation Error";
    case "memory":
      return "Memory Limit";
    default:
      return "Unknown Error";
  }
};

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  errors,
  onRetry,
  onDismiss,
  onRetryAll,
  showTechnicalDetails = false,
  className = "",
}) => {
  if (errors.length === 0) return null;

  const retryableErrors = errors.filter((error) => error.retryable);
  const criticalErrors = errors.filter(
    (error) => error.severity === "critical"
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Summary header for multiple errors */}
      {errors.length > 1 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-800">
                  {criticalErrors.length > 0
                    ? "Critical Issues Detected"
                    : "Multiple Issues Detected"}
                </CardTitle>
              </div>
              {retryableErrors.length > 0 && onRetryAll && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetryAll}
                  className="text-orange-700 border-orange-300 hover:bg-orange-100"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry All
                </Button>
              )}
            </div>
            <CardDescription className="text-orange-700">
              {errors.length} issues found. {retryableErrors.length} can be
              retried.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Individual error displays */}
      {errors.map((error) => (
        <Alert
          key={error.id}
          variant={error.severity === "critical" ? "destructive" : "default"}
          className={`${getSeverityColor(error.severity)} relative`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <ErrorIcon type={error.type} className="h-4 w-4 mt-0.5" />
              <div className="flex-1 min-w-0">
                <AlertTitle className="flex items-center gap-2 mb-1">
                  {getErrorTitle(error.type)}
                  <Badge variant="outline" className="text-xs">
                    {error.type}
                  </Badge>
                  {error.retryCount && error.retryCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Retry {error.retryCount}
                    </Badge>
                  )}
                </AlertTitle>
                <AlertDescription>
                  <p className="mb-2">{error.message}</p>

                  {/* Context information */}
                  {error.context && (
                    <div className="text-xs text-muted-foreground mb-2">
                      {error.context.operation && (
                        <span>Operation: {error.context.operation}</span>
                      )}
                      {error.context.pageNumber && (
                        <span className="ml-2">
                          Page: {error.context.pageNumber}
                          {error.context.totalPages &&
                            `/${error.context.totalPages}`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recovery attempts */}
                  {error.recoveryAttempts &&
                    error.recoveryAttempts.length > 0 && (
                      <div className="text-xs text-muted-foreground mb-2">
                        <span>Recovery attempts: </span>
                        {error.recoveryAttempts.map((attempt, index) => (
                          <Badge
                            key={index}
                            variant={attempt.success ? "default" : "secondary"}
                            className="text-xs mr-1"
                          >
                            {attempt.strategy} {attempt.success ? "✓" : "✗"}
                          </Badge>
                        ))}
                      </div>
                    )}

                  {/* Technical details */}
                  {showTechnicalDetails && error.technicalMessage && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                        Technical Details
                      </summary>
                      <pre className="text-xs mt-1 p-2 bg-muted rounded font-mono overflow-x-auto">
                        {error.technicalMessage}
                      </pre>
                    </details>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    {error.retryable && onRetry && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRetry([error.id])}
                        className="text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    )}
                    {onDismiss && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDismiss(error.id)}
                        className="text-xs"
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </div>
            </div>

            {/* Timestamp */}
            <div className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
              {new Date(error.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </Alert>
      ))}
    </div>
  );
};

export const PartialFailureDisplay: React.FC<PartialFailureDisplayProps> = ({
  successCount,
  totalCount,
  errors,
  partialData,
  onRetryFailed,
  onContinueWithPartial,
  onRetryAll,
  showDetails = false,
}) => {
  const successRate = (successCount / totalCount) * 100;
  const failureCount = totalCount - successCount;
  const retryableErrors = errors.filter((error) => error.retryable);

  const getStatusColor = () => {
    if (successRate >= 90) return "text-green-600 bg-green-50 border-green-200";
    if (successRate >= 70)
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-orange-600 bg-orange-50 border-orange-200";
  };

  const getStatusIcon = () => {
    if (successRate >= 90)
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (successRate >= 70)
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <AlertCircle className="h-5 w-5 text-orange-600" />;
  };

  return (
    <Card className={`${getStatusColor()} mb-4`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-lg">
                Partial Success ({successRate.toFixed(1)}%)
              </CardTitle>
              <CardDescription className="mt-1">
                {successCount} of {totalCount} operations completed successfully
              </CardDescription>
            </div>
          </div>

          {/* Quick stats */}
          <div className="text-right">
            <div className="text-2xl font-bold">{successCount}</div>
            <div className="text-sm text-muted-foreground">successful</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>
              {successCount}/{totalCount}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                successRate >= 90
                  ? "bg-green-500"
                  : successRate >= 70
                  ? "bg-yellow-500"
                  : "bg-orange-500"
              }`}
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        {/* Error summary */}
        {failureCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">
                {failureCount} Failed Operations
              </span>
            </div>

            {/* Error breakdown */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Retryable:</span>
                <span className="ml-2 font-medium">
                  {retryableErrors.length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Permanent:</span>
                <span className="ml-2 font-medium">
                  {failureCount - retryableErrors.length}
                </span>
              </div>
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {onContinueWithPartial && (
            <Button variant="default" onClick={onContinueWithPartial}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Continue with {successCount} Results
            </Button>
          )}

          {retryableErrors.length > 0 && onRetryFailed && (
            <Button variant="outline" onClick={onRetryFailed}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Failed ({retryableErrors.length})
            </Button>
          )}

          {onRetryAll && (
            <Button variant="outline" onClick={onRetryAll}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry All
            </Button>
          )}
        </div>

        {/* Detailed error list */}
        {showDetails && errors.length > 0 && (
          <div className="mt-4">
            <Separator className="mb-4" />
            <ErrorDisplay
              errors={errors}
              onRetry={onRetryFailed}
              showTechnicalDetails={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ErrorDisplay;
