"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { Badge } from "@/components/ui/badge"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { FileText, ChevronLeft, ChevronRight, CalendarIcon, AlertCircle, RefreshCw, WifiOff } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

// Form validation schema
const filterFormSchema = z.object({
  dateFrom: z.date({
    message: "Start date is required",
  }),
  dateTo: z.date({
    message: "End date is required",
  }),
}).refine((data) => {
  return data.dateFrom <= data.dateTo
}, {
  message: "End date must be after start date",
  path: ["dateTo"],
})

type FilterFormValues = z.infer<typeof filterFormSchema>

// Enhanced error types
interface ApiError {
  message: string
  type: "network" | "server" | "validation" | "unknown"
  retryable: boolean
  statusCode?: number
}

interface TenderValue {
  amount: number
  currency: string
}

interface TenderPeriod {
  startDate: string
  endDate: string
}

interface ProcuringEntity {
  id: string
  name: string
}

interface Tender {
  id: string
  title: string
  status: string
  description: string
  mainProcurementCategory: string
  value?: TenderValue
  tenderPeriod?: TenderPeriod
  procuringEntity?: ProcuringEntity
}

interface Release {
  ocid: string
  id: string
  date: string
  tag: string[]
  tender: Tender
}

interface ApiResponse {
  releases: Release[]
  links?: {
    next?: string
    prev?: string
  }
}

export default function TenderListing() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(5) // API default is 5
  const [pageSize] = useState(50) // API default is 50

  // Form setup with validation
  const form = useForm<FilterFormValues>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-03-31"),
    },
  })

  const fetchTenders = async (page: number, from?: string, to?: string) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        PageNumber: page.toString(),
        PageSize: pageSize.toString(),
      })

      // Always provide date parameters (use defaults if not specified)
      params.append("dateFrom", from || "2025-01-01")
      params.append("dateTo", to || "2025-03-31")

      console.log("Fetching with params:", params.toString())

      const response = await fetch(`/api/tenders?${params}`, {
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })

      if (!response.ok) {
        let errorType: ApiError["type"] = "server"
        let retryable = true

        if (response.status >= 400 && response.status < 500) {
          errorType = "validation"
          retryable = response.status === 429 // Only retry rate limits
        } else if (response.status >= 500) {
          errorType = "server"
          retryable = true
        }

        const errorData = await response.json().catch(() => ({}))
        const apiError: ApiError = {
          message: errorData.message || `Server error (${response.status})`,
          type: errorType,
          retryable,
          statusCode: response.status,
        }
        
        throw apiError
      }

      const result = await response.json()
      console.log("Received data:", result)
      setData(result)
      setRetryCount(0) // Reset retry count on success
    } catch (err) {
      console.error("Fetch error:", err)
      
      let apiError: ApiError
      if (err instanceof Error && 'type' in err && 'retryable' in err) {
        apiError = err as unknown as ApiError
      } else if (err instanceof Error) {
        // Handle network errors
        if (err.name === 'AbortError' || err.message.includes('timeout')) {
          apiError = {
            message: "Request timed out. Please check your connection and try again.",
            type: "network",
            retryable: true,
          }
        } else if (err.message.includes('fetch')) {
          apiError = {
            message: "Unable to connect to the server. Please check your internet connection.",
            type: "network",
            retryable: true,
          }
        } else {
          apiError = {
            message: err.message,
            type: "unknown",
            retryable: true,
          }
        }
      } else {
        apiError = {
          message: "An unexpected error occurred. Please try again.",
          type: "unknown",
          retryable: true,
        }
      }
      
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const values = form.getValues()
    fetchTenders(currentPage, values.dateFrom.toISOString().split('T')[0], values.dateTo.toISOString().split('T')[0])
  }, [currentPage, pageSize, form])

  const onSubmit = (values: FilterFormValues) => {
    setCurrentPage(1)
    fetchTenders(1, values.dateFrom.toISOString().split('T')[0], values.dateTo.toISOString().split('T')[0])
  }

  const handleClearFilter = () => {
    form.reset({
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-03-31"),
    })
    setCurrentPage(5)
    fetchTenders(5, "2025-01-01", "2025-03-31")
  }

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

  // Loading skeleton component for tender cards
  const TenderCardSkeleton = () => (
    <Card>
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
  )

  // Comprehensive error handling component
  const ErrorDisplay = ({ error, onRetry }: { error: ApiError; onRetry: () => void }) => {
    const getErrorIcon = () => {
      switch (error.type) {
        case "network":
          return <WifiOff className="h-5 w-5" />
        case "server":
          return <AlertCircle className="h-5 w-5" />
        case "validation":
          return <AlertCircle className="h-5 w-5" />
        default:
          return <AlertCircle className="h-5 w-5" />
      }
    }

    const getErrorTitle = () => {
      switch (error.type) {
        case "network":
          return "Connection Problem"
        case "server":
          return "Server Error"
        case "validation":
          return "Invalid Request"
        default:
          return "Something Went Wrong"
      }
    }

    const getErrorSuggestions = () => {
      switch (error.type) {
        case "network":
          return [
            "Check your internet connection",
            "Try refreshing the page",
            "Wait a moment and try again"
          ]
        case "server":
          return [
            "The server is temporarily unavailable",
            "Please try again in a few minutes",
            "Contact support if the problem persists"
          ]
        case "validation":
          return [
            "Check your filter settings",
            "Try different date ranges",
            "Reset filters and try again"
          ]
        default:
          return [
            "Try refreshing the page",
            "Check your internet connection",
            "Contact support if the problem continues"
          ]
      }
    }

    return (
      <>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Procurement Tender Opportunities</h1>
          <p className="text-gray-500">Browse active procurement opportunities from South African government entities</p>
        </div>

        <Alert variant="destructive" className="mb-6">
          {getErrorIcon()}
          <AlertTitle>{getErrorTitle()}</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">{error.message}</p>
            {error.retryable && (
              <div className="space-y-2">
                <p className="font-medium text-sm">What you can try:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {getErrorSuggestions().map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>

        <div className="flex justify-center gap-4">
          {error.retryable && (
            <Button onClick={onRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
              {retryCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  Attempt {retryCount + 1}
                </Badge>
              )}
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
        </div>

        {error.statusCode && (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Error Code: {error.statusCode} | Time: {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}
      </>
    )
  }

  if (loading && !data) {
    return (
      <>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Procurement Tender Opportunities</h1>
          <p className="text-gray-500">Browse active procurement opportunities from South African government entities</p>
        </div>

        {/* Filters Skeleton */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex-1">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-16" />
                <Skeleton className="h-10 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading Skeleton Cards */}
        <div className="grid gap-6 mb-8">
          {Array.from({ length: 5 }).map((_, index) => (
            <TenderCardSkeleton key={index} />
          ))}
        </div>

        {/* Pagination Skeleton */}
        <div className="flex justify-center items-center gap-4">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-16" />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <ErrorDisplay 
        error={error} 
        onRetry={() => {
          setRetryCount(prev => prev + 1)
          const values = form.getValues()
          fetchTenders(currentPage, values.dateFrom.toISOString().split('T')[0], values.dateTo.toISOString().split('T')[0])
        }} 
      />
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Procurement Tender Opportunities</h1>
        <p className="text-gray-500">Browse active procurement opportunities from South African government entities</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-4 items-end">
              <FormField
                control={form.control}
                name="dateFrom"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Date From</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            disabled={loading}
                            className={`w-full justify-start text-left font-normal ${
                              !field.value && "text-muted-foreground"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateTo"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Date To</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            disabled={loading}
                            className={`w-full justify-start text-left font-normal ${
                              !field.value && "text-muted-foreground"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Filtering..." : "Filter"}
                </Button>
                <Button
                  type="button"
                  onClick={handleClearFilter}
                  variant="outline"
                  disabled={loading}
                >
                  Clear
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Results */}
      {data?.releases && data.releases.length > 0 ? (
        <>
          <div className="grid gap-6 mb-8">
            {data.releases.map((release) => (
              <Link href={`/tender/${encodeURIComponent(release.ocid)}`} key={release.ocid}>
                <Card className="hover:shadow-md transition-all duration-200 cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="destructive" className="text-xs">
                          NEW
                        </Badge>
                        <Badge 
                          variant={getStatusVariant(release.tender.status)} 
                          className="text-xs"
                        >
                          {release.tender.status || "Active"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {release.tender.id || release.ocid}
                      </div>
                    </div>
                    <CardTitle className="group-hover:text-primary transition-colors">
                      {release.tender.procuringEntity?.name || "Unknown Entity"}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {release.tender.title}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardFooter className="flex items-center justify-between pt-0">
                    <div className="text-sm text-muted-foreground">
                      {release.tender.tenderPeriod?.endDate ? (
                        <>Closing {format(new Date(release.tender.tenderPeriod.endDate), "d MMM yyyy h:mmaaa")}</>
                      ) : (
                        "Closing date not specified"
                      )}
                    </div>
                    <Badge variant={getCategoryVariant(release.tender.mainProcurementCategory)} className="text-xs">
                      {release.tender.mainProcurementCategory || "General"}
                    </Badge>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-4">
            <Button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              variant="outline"
              size="sm"
              className="transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {loading ? "Loading..." : "Previous"}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Page</span>
              <Badge variant="outline" className="px-3 py-1">
                {currentPage}
              </Badge>
            </div>

            <Button
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={!data?.releases || data.releases.length < pageSize || loading}
              variant="outline"
              size="sm"
              className="transition-all duration-200"
            >
              {loading ? "Loading..." : "Next"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      ) : (
        <Card className="border border-gray-200">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tenders found</h3>
            <p className="text-gray-500">Try adjusting your date filters or check back later for new opportunities.</p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
