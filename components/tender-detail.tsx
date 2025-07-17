"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CalendarDays,
  Building2,
  DollarSign,
  FileText,
  Download,
  ArrowLeft,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Globe,
  Phone,
  Mail,
  WifiOff,
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface TenderValue {
  amount: number
  currency: string
}

interface TenderPeriod {
  startDate: string
  endDate: string
}

interface Address {
  streetAddress?: string
  locality?: string
  region?: string
  postalCode?: string
  countryName?: string
}

interface ContactPoint {
  name?: string
  email?: string
  telephone?: string
  faxNumber?: string
  url?: string
}

interface ProcuringEntity {
  id: string
  name: string
  address?: Address
  contactPoint?: ContactPoint
}

interface Classification {
  scheme: string
  id: string
  description: string
  uri?: string
}

interface Unit {
  name: string
  value?: {
    amount: number
    currency: string
  }
}

interface Item {
  id: string
  description: string
  classification?: Classification
  additionalClassifications?: Classification[]
  quantity?: number
  unit?: Unit
}

interface Document {
  id: string
  documentType: string
  title: string
  description?: string
  url?: string
  datePublished?: string
  dateModified?: string
  format?: string
  language?: string
}

interface ContractPeriod {
  startDate?: string
  endDate?: string
  maxExtentDate?: string
  durationInDays?: number
}

interface Lot {
  id: string
  title?: string
  description: string
  status: string
  value?: TenderValue
  contractPeriod?: ContractPeriod
  hasOptions?: boolean
  hasRenewal?: boolean
}

interface Milestone {
  id: string
  title?: string
  description?: string
  type: string
  status?: string
  dueDate?: string
  dateMet?: string
}

interface Tender {
  id: string
  title: string
  status: string
  description: string
  mainProcurementCategory: string
  additionalProcurementCategories?: string[]
  value?: TenderValue
  minValue?: TenderValue
  tenderPeriod?: TenderPeriod
  enquiryPeriod?: TenderPeriod
  awardPeriod?: TenderPeriod
  contractPeriod?: ContractPeriod
  procuringEntity?: ProcuringEntity
  classification?: Classification
  additionalClassifications?: Classification[]
  items?: Item[]
  documents?: Document[]
  lots?: Lot[]
  milestones?: Milestone[]
  eligibilityCriteria?: string
  selectionCriteria?: any
  submissionMethod?: string[]
  submissionMethodDetails?: string
  hasEnquiries?: boolean
  reviewDetails?: string
  procurementMethod?: string
  procurementMethodDetails?: string
  procurementMethodRationale?: string
  awardCriteria?: string
  awardCriteriaDetails?: string
  hasElectronicAuction?: boolean
  hasFrameworkAgreement?: boolean
  numberOfTenderers?: number
  tenderers?: Array<{
    id: string
    name: string
  }>
}

interface Party {
  id: string
  name: string
  identifier?: {
    scheme: string
    id: string
    legalName?: string
  }
  address?: Address
  contactPoint?: ContactPoint
  roles: string[]
}

interface Release {
  ocid: string
  id: string
  date: string
  tag: string[]
  description?: string
  initiationType?: string
  language?: string
  tender: Tender
  buyer?: Party
  parties?: Party[]
  planning?: any
}

interface TenderDetailProps {
  ocid: string
}

interface ApiError {
  error: string
  message: string
  suggestions?: string[]
  retryable?: boolean
}

export default function TenderDetail({ ocid }: TenderDetailProps) {
  const [release, setRelease] = useState<Release | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const fetchTenderDetail = async (isRetry = false) => {
    if (isRetry) {
      setRetryCount((prev) => prev + 1)
    } else {
      setRetryCount(0)
    }

    setLoading(true)
    setError(null)

    try {
      console.log("Fetching tender detail for OCID:", ocid)
      const response = await fetch(`/api/tender/${encodeURIComponent(ocid)}`, {
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw errorData
      }

      const result = await response.json()
      console.log("Successfully received tender data:", result.ocid)
      setRelease(result)
      setRetryCount(0) // Reset retry count on success
    } catch (err) {
      console.error("Fetch error:", err)
      if (err && typeof err === "object" && "error" in err) {
        setError(err as ApiError)
      } else {
        setError({
          error: "Failed to fetch tender details",
          message: err instanceof Error ? err.message : "Unknown error",
          retryable: true,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (ocid) {
      fetchTenderDetail()
    }
  }, [ocid])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: currency || "ZAR",
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800"
      case "closed":
        return "bg-red-100 text-red-800"
      case "cancelled":
        return "bg-gray-100 text-gray-800"
      case "complete":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  const getDocumentIcon = (documentType: string) => {
    switch (documentType.toLowerCase()) {
      case "tendernotice":
      case "notice":
        return <FileText className="h-4 w-4" />
      case "biddingdocuments":
      case "tender":
        return <Download className="h-4 w-4" />
      case "technicalspecifications":
        return <FileText className="h-4 w-4" />
      case "evaluationcriteria":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getErrorIcon = (error: ApiError) => {
    if (error.retryable) {
      return <WifiOff className="h-12 w-12 text-orange-500 mx-auto mb-4" />
    }
    return <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
  }

  const getErrorColor = (error: ApiError) => {
    if (error.retryable) {
      return "border-orange-200 bg-orange-50"
    }
    return "border-red-200 bg-red-50"
  }

  const getErrorTextColor = (error: ApiError) => {
    if (error.retryable) {
      return "text-orange-600"
    }
    return "text-red-600"
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {retryCount > 0 ? `Loading tender details... (Attempt ${retryCount + 1})` : "Loading tender details..."}
          </p>
          <p className="text-sm text-gray-500 mt-2">OCID: {ocid}</p>
        </div>
      </div>
    )
  }

  if (error || !release) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Listings
          </Button>
        </Link>

        <Card className={getErrorColor(error!)}>
          <CardContent className="p-6 text-center">
            {getErrorIcon(error!)}
            <p className={`${getErrorTextColor(error!)} font-medium text-lg mb-2`}>
              {error?.error || "Tender not found"}
            </p>
            <p className={`${getErrorTextColor(error!)} text-sm mb-4`}>
              {error?.message || "The requested tender could not be found"}
            </p>

            {error?.suggestions && (
              <div className="text-left max-w-md mx-auto mb-4">
                <p className={`font-medium ${getErrorTextColor(error)} mb-2`}>Possible solutions:</p>
                <ul className={`text-sm ${getErrorTextColor(error)} space-y-1`}>
                  {error.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className={`${error.retryable ? "text-orange-400" : "text-red-400"} mt-1`}>•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              {error?.retryable && (
                <Button onClick={() => fetchTenderDetail(true)} variant="outline" className="bg-transparent">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {retryCount > 0 ? `Retry (${retryCount + 1})` : "Try Again"}
                </Button>
              )}
              <Link href="/">
                <Button className="bg-teal-600 hover:bg-teal-700">Browse All Tenders</Button>
              </Link>
            </div>

            {retryCount > 0 && (
              <p className="text-xs text-gray-500 mt-4">
                Attempted {retryCount} time{retryCount !== 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const tender = release.tender

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Listings
          </Button>
        </Link>

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{tender.title}</h1>
            <p className="text-lg text-teal-600 mb-2">{tender.procuringEntity?.name}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>OCID: {release.ocid}</span>
              <span>•</span>
              <span>Release ID: {release.id}</span>
              <span>•</span>
              <span>Published: {format(new Date(release.date), "MMM dd, yyyy")}</span>
            </div>
          </div>
          <Badge className={getStatusColor(tender.status)}>{tender.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{tender.description}</p>
                </CardContent>
              </Card>

              {/* Classification */}
              {tender.classification && (
                <Card>
                  <CardHeader>
                    <CardTitle>Classification</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <span className="font-medium">Primary Classification:</span>
                        <div className="mt-1 text-sm text-gray-600">
                          <div>Scheme: {tender.classification.scheme}</div>
                          <div>Code: {tender.classification.id}</div>
                          <div>Description: {tender.classification.description}</div>
                        </div>
                      </div>

                      {tender.additionalClassifications && tender.additionalClassifications.length > 0 && (
                        <div>
                          <span className="font-medium">Additional Classifications:</span>
                          <div className="mt-1 space-y-2">
                            {tender.additionalClassifications.map((classification, index) => (
                              <div key={index} className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
                                <div>Scheme: {classification.scheme}</div>
                                <div>Code: {classification.id}</div>
                                <div>Description: {classification.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Procurement Method */}
              {tender.procurementMethod && (
                <Card>
                  <CardHeader>
                    <CardTitle>Procurement Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Method:</span> {tender.procurementMethod}
                      </div>
                      {tender.procurementMethodDetails && (
                        <div>
                          <span className="font-medium">Details:</span> {tender.procurementMethodDetails}
                        </div>
                      )}
                      {tender.procurementMethodRationale && (
                        <div>
                          <span className="font-medium">Rationale:</span> {tender.procurementMethodRationale}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Award Criteria */}
              {tender.awardCriteria && (
                <Card>
                  <CardHeader>
                    <CardTitle>Award Criteria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Criteria:</span> {tender.awardCriteria}
                      </div>
                      {tender.awardCriteriaDetails && (
                        <div>
                          <span className="font-medium">Details:</span> {tender.awardCriteriaDetails}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lots */}
              {tender.lots && tender.lots.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Lots</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {tender.lots.map((lot) => (
                        <div key={lot.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{lot.title || `Lot ${lot.id}`}</h4>
                            <Badge className={getStatusColor(lot.status)}>{lot.status}</Badge>
                          </div>
                          <p className="text-gray-600 text-sm mb-2">{lot.description}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {lot.value && (
                              <div>
                                <span className="font-medium">Value:</span>{" "}
                                {formatCurrency(lot.value.amount, lot.value.currency)}
                              </div>
                            )}
                            {lot.hasOptions && (
                              <div>
                                <span className="font-medium">Has Options:</span> Yes
                              </div>
                            )}
                            {lot.hasRenewal && (
                              <div>
                                <span className="font-medium">Has Renewal:</span> Yes
                              </div>
                            )}
                            {lot.contractPeriod && (
                              <div className="col-span-2">
                                <span className="font-medium">Contract Period:</span>
                                {lot.contractPeriod.startDate && (
                                  <span> From {format(new Date(lot.contractPeriod.startDate), "MMM dd, yyyy")}</span>
                                )}
                                {lot.contractPeriod.endDate && (
                                  <span> to {format(new Date(lot.contractPeriod.endDate), "MMM dd, yyyy")}</span>
                                )}
                                {lot.contractPeriod.durationInDays && (
                                  <span> ({lot.contractPeriod.durationInDays} days)</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="requirements" className="space-y-6">
              {/* Eligibility Criteria */}
              {tender.eligibilityCriteria && (
                <Card>
                  <CardHeader>
                    <CardTitle>Eligibility Criteria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{tender.eligibilityCriteria}</p>
                  </CardContent>
                </Card>
              )}

              {/* Submission Method */}
              {tender.submissionMethod && (
                <Card>
                  <CardHeader>
                    <CardTitle>Submission Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Methods:</span> {tender.submissionMethod.join(", ")}
                      </div>
                      {tender.submissionMethodDetails && (
                        <div>
                          <span className="font-medium">Details:</span>
                          <p className="mt-1 text-gray-600 whitespace-pre-wrap">{tender.submissionMethodDetails}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Review Details */}
              {tender.reviewDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle>Review Process</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{tender.reviewDetails}</p>
                  </CardContent>
                </Card>
              )}

              {/* Special Features */}
              {(tender.hasElectronicAuction || tender.hasFrameworkAgreement || tender.numberOfTenderers) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Special Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tender.hasElectronicAuction && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Electronic Auction Available</span>
                        </div>
                      )}
                      {tender.hasFrameworkAgreement && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Framework Agreement</span>
                        </div>
                      )}
                      {tender.numberOfTenderers && (
                        <div>
                          <span className="font-medium">Number of Tenderers:</span> {tender.numberOfTenderers}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="items" className="space-y-6">
              {tender.items && tender.items.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Items & Services</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {tender.items.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4">
                          <h4 className="font-medium mb-2">{item.description}</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Item ID:</span> {item.id}
                            </div>
                            {item.quantity && (
                              <div>
                                <span className="font-medium">Quantity:</span> {item.quantity}{" "}
                                {item.unit?.name || "units"}
                              </div>
                            )}
                            {item.unit?.value && (
                              <div>
                                <span className="font-medium">Unit Value:</span>{" "}
                                {formatCurrency(item.unit.value.amount, item.unit.value.currency)}
                              </div>
                            )}
                            {item.classification && (
                              <div className="col-span-2">
                                <span className="font-medium">Classification:</span> {item.classification.description} (
                                {item.classification.id})
                              </div>
                            )}
                            {item.additionalClassifications && item.additionalClassifications.length > 0 && (
                              <div className="col-span-2">
                                <span className="font-medium">Additional Classifications:</span>
                                <ul className="mt-1 space-y-1">
                                  {item.additionalClassifications.map((classification, index) => (
                                    <li key={index} className="text-xs">
                                      {classification.description} ({classification.id})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No items specified for this tender</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-6">
              {tender.documents && tender.documents.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {tender.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {getDocumentIcon(doc.documentType)}
                            <div>
                              <h4 className="font-medium">{doc.title}</h4>
                              {doc.description && <p className="text-sm text-gray-600">{doc.description}</p>}
                              <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                <span>Type: {doc.documentType}</span>
                                {doc.format && <span>Format: {doc.format}</span>}
                                {doc.language && <span>Language: {doc.language}</span>}
                                {doc.datePublished && (
                                  <span>Published: {format(new Date(doc.datePublished), "MMM dd, yyyy")}</span>
                                )}
                                {doc.dateModified && (
                                  <span>Modified: {format(new Date(doc.dateModified), "MMM dd, yyyy")}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {doc.url && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No documents available for this tender</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Key Information */}
          <Card>
            <CardHeader>
              <CardTitle>Key Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tender.value && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">{formatCurrency(tender.value.amount, tender.value.currency)}</div>
                    <div className="text-xs text-gray-500">Estimated Value</div>
                  </div>
                </div>
              )}

              {tender.minValue && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">
                      {formatCurrency(tender.minValue.amount, tender.minValue.currency)}
                    </div>
                    <div className="text-xs text-gray-500">Minimum Value</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium capitalize">{tender.mainProcurementCategory}</div>
                  <div className="text-xs text-gray-500">Category</div>
                </div>
              </div>

              {tender.hasEnquiries !== undefined && (
                <div className="flex items-center gap-2">
                  {tender.hasEnquiries ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium">{tender.hasEnquiries ? "Allowed" : "Not Allowed"}</div>
                    <div className="text-xs text-gray-500">Enquiries</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tender.tenderPeriod && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Tender Period</span>
                  </div>
                  <div className="text-sm text-gray-600 ml-6">
                    {tender.tenderPeriod.startDate && (
                      <div>Opens: {format(new Date(tender.tenderPeriod.startDate), "MMM dd, yyyy h:mmaaa")}</div>
                    )}
                    {tender.tenderPeriod.endDate && (
                      <div>Closes: {format(new Date(tender.tenderPeriod.endDate), "MMM dd, yyyy h:mmaaa")}</div>
                    )}
                  </div>
                </div>
              )}

              {tender.enquiryPeriod && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Enquiry Period</span>
                  </div>
                  <div className="text-sm text-gray-600 ml-6">
                    {tender.enquiryPeriod.startDate && (
                      <div>From: {format(new Date(tender.enquiryPeriod.startDate), "MMM dd, yyyy")}</div>
                    )}
                    {tender.enquiryPeriod.endDate && (
                      <div>Until: {format(new Date(tender.enquiryPeriod.endDate), "MMM dd, yyyy")}</div>
                    )}
                  </div>
                </div>
              )}

              {tender.awardPeriod && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Award Period</span>
                  </div>
                  <div className="text-sm text-gray-600 ml-6">
                    {tender.awardPeriod.startDate && (
                      <div>Expected: {format(new Date(tender.awardPeriod.startDate), "MMM dd, yyyy")}</div>
                    )}
                  </div>
                </div>
              )}

              {tender.contractPeriod && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Contract Period</span>
                  </div>
                  <div className="text-sm text-gray-600 ml-6">
                    {tender.contractPeriod.startDate && (
                      <div>Starts: {format(new Date(tender.contractPeriod.startDate), "MMM dd, yyyy")}</div>
                    )}
                    {tender.contractPeriod.endDate && (
                      <div>Ends: {format(new Date(tender.contractPeriod.endDate), "MMM dd, yyyy")}</div>
                    )}
                    {tender.contractPeriod.durationInDays && (
                      <div>Duration: {tender.contractPeriod.durationInDays} days</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Information */}
          {tender.procuringEntity && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-gray-400 mt-1" />
                  <div>
                    <div className="font-medium">{tender.procuringEntity.name}</div>
                    <div className="text-xs text-gray-500">Procuring Entity</div>
                  </div>
                </div>

                {tender.procuringEntity.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                    <div className="text-sm text-gray-600">
                      {tender.procuringEntity.address.streetAddress && (
                        <div>{tender.procuringEntity.address.streetAddress}</div>
                      )}
                      {tender.procuringEntity.address.locality && <div>{tender.procuringEntity.address.locality}</div>}
                      {tender.procuringEntity.address.region && <div>{tender.procuringEntity.address.region}</div>}
                      {tender.procuringEntity.address.postalCode && (
                        <div>{tender.procuringEntity.address.postalCode}</div>
                      )}
                      {tender.procuringEntity.address.countryName && (
                        <div>{tender.procuringEntity.address.countryName}</div>
                      )}
                    </div>
                  </div>
                )}

                {tender.procuringEntity.contactPoint && (
                  <div className="space-y-2 text-sm">
                    {tender.procuringEntity.contactPoint.name && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{tender.procuringEntity.contactPoint.name}</span>
                      </div>
                    )}
                    {tender.procuringEntity.contactPoint.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <a
                          href={`mailto:${tender.procuringEntity.contactPoint.email}`}
                          className="text-teal-600 hover:underline"
                        >
                          {tender.procuringEntity.contactPoint.email}
                        </a>
                      </div>
                    )}
                    {tender.procuringEntity.contactPoint.telephone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{tender.procuringEntity.contactPoint.telephone}</span>
                      </div>
                    )}
                    {tender.procuringEntity.contactPoint.url && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a
                          href={tender.procuringEntity.contactPoint.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:underline"
                        >
                          Website
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Milestones */}
          {tender.milestones && tender.milestones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Milestones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tender.milestones.map((milestone) => (
                    <div key={milestone.id} className="border-l-2 border-gray-200 pl-3">
                      <div className="font-medium text-sm">{milestone.title || milestone.type}</div>
                      {milestone.description && <div className="text-xs text-gray-600">{milestone.description}</div>}
                      <div className="text-xs text-gray-500 mt-1">
                        {milestone.dueDate && <span>Due: {format(new Date(milestone.dueDate), "MMM dd, yyyy")}</span>}
                        {milestone.status && <span className="ml-2">Status: {milestone.status}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
