"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Briefcase,
  Calendar,
  MapPinned,
  Info,
  Building,
  Truck,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface TenderValue {
  amount: number;
  currency: string;
}

interface TenderPeriod {
  startDate: string;
  endDate: string;
}

interface Address {
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  countryName?: string;
}

interface ContactPoint {
  name?: string;
  email?: string;
  telephone?: string;
  faxNumber?: string;
  url?: string;
}

interface ProcuringEntity {
  id: string;
  name: string;
  address?: Address;
  contactPoint?: ContactPoint;
}

interface Classification {
  scheme: string;
  id: string;
  description: string;
  uri?: string;
}

interface Unit {
  name: string;
  value?: {
    amount: number;
    currency: string;
  };
}

interface Item {
  id: string;
  description: string;
  classification?: Classification;
  additionalClassifications?: Classification[];
  quantity?: number;
  unit?: Unit;
}

interface Document {
  id: string;
  documentType: string;
  title: string;
  description?: string;
  url?: string;
  datePublished?: string;
  dateModified?: string;
  format?: string;
  language?: string;
}

interface ContractPeriod {
  startDate?: string;
  endDate?: string;
  maxExtentDate?: string;
  durationInDays?: number;
}

interface Lot {
  id: string;
  title?: string;
  description: string;
  status: string;
  value?: TenderValue;
  contractPeriod?: ContractPeriod;
  hasOptions?: boolean;
  hasRenewal?: boolean;
}

interface Milestone {
  id: string;
  title?: string;
  description?: string;
  type: string;
  status?: string;
  dueDate?: string;
  dateMet?: string;
}

interface Tender {
  id: string;
  title: string;
  status: string;
  description: string;
  mainProcurementCategory: string;
  additionalProcurementCategories?: string[];
  value?: TenderValue;
  minValue?: TenderValue;
  tenderPeriod?: TenderPeriod;
  enquiryPeriod?: TenderPeriod;
  awardPeriod?: TenderPeriod;
  contractPeriod?: ContractPeriod;
  procuringEntity?: ProcuringEntity;
  classification?: Classification;
  additionalClassifications?: Classification[];
  items?: Item[];
  documents?: Document[];
  lots?: Lot[];
  milestones?: Milestone[];
  eligibilityCriteria?: string;
  selectionCriteria?: any;
  submissionMethod?: string[];
  submissionMethodDetails?: string;
  hasEnquiries?: boolean;
  reviewDetails?: string;
  procurementMethod?: string;
  procurementMethodDetails?: string;
  procurementMethodRationale?: string;
  awardCriteria?: string;
  awardCriteriaDetails?: string;
  hasElectronicAuction?: boolean;
  hasFrameworkAgreement?: boolean;
  numberOfTenderers?: number;
  tenderers?: Array<{
    id: string;
    name: string;
  }>;
}

interface Party {
  id: string;
  name: string;
  identifier?: {
    scheme: string;
    id: string;
    legalName?: string;
  };
  address?: Address;
  contactPoint?: ContactPoint;
  roles: string[];
}

interface Release {
  ocid: string;
  id: string;
  date: string;
  tag: string[];
  description?: string;
  initiationType?: string;
  language?: string;
  tender: Tender;
  buyer?: Party;
  parties?: Party[];
  planning?: any;
}

// Enhanced tender information interfaces for comprehensive display
interface RequestForBidInfo {
  department: string;
  bidDescription: string;
  deliveryLocation: string;
  placeOfService: string;
  procurementCategory: string;
  additionalCategories: string[];
}

interface KeyDates {
  openingDate?: string;
  closingDate: string;
  modifiedDate?: string;
  enquiryPeriodStart?: string;
  enquiryPeriodEnd?: string;
  awardPeriodStart?: string;
  awardPeriodEnd?: string;
  publishedDate: string;
}

interface ContactInformation {
  contactPerson?: string;
  email?: string;
  telephone?: string;
  fax?: string;
  organizationName?: string;
  address?: Address;
  url?: string;
}

interface BriefingSession {
  hasBriefing: boolean;
  isCompulsory?: boolean;
  date?: string;
  venue?: string;
  description?: string;
  contactInfo?: ContactInformation;
}

interface SpecialConditions {
  eligibilityCriteria?: string;
  submissionRequirements?: string[];
  evaluationCriteria?: string;
  procurementMethodDetails?: string;
  additionalRequirements?: string[];
  documentRequirements?: string[];
}

interface EnhancedTenderInfo {
  // Core OCDS data
  ocid: string;
  id: string;
  title: string;
  status: string;
  publishedDate: string;

  // Enhanced fields for comprehensive display
  requestForBid: RequestForBidInfo;
  keyDates: KeyDates;
  contactInformation: ContactInformation;
  briefingSession?: BriefingSession;
  specialConditions: SpecialConditions;

  // Original tender data for fallback
  originalTender: Tender;
  originalRelease: Release;

  // Metadata
  dataQuality: {
    completenessScore: number; // 0-1 score based on available fields
    extractedFields: string[];
    missingFields: string[];
    validationWarnings: string[];
  };
}

interface TenderDetailProps {
  ocid: string;
}

interface ApiError {
  error: string;
  message: string;
  suggestions?: string[];
  retryable?: boolean;
}

export default function TenderDetail({ ocid }: TenderDetailProps) {
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchTenderDetail = async (isRetry = false) => {
    if (isRetry) {
      setRetryCount((prev) => prev + 1);
    } else {
      setRetryCount(0);
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Fetching tender detail for OCID:", ocid);
      const response = await fetch(`/api/tender/${encodeURIComponent(ocid)}`, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }

      const result = await response.json();
      console.log("Successfully received tender data:", result.ocid);
      setRelease(result);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      console.error("Fetch error:", err);
      if (err && typeof err === "object" && "error" in err) {
        setError(err as ApiError);
      } else {
        setError({
          error: "Failed to fetch tender details",
          message: err instanceof Error ? err.message : "Unknown error",
          retryable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ocid) {
      fetchTenderDetail();
    }
  }, [ocid]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: currency || "ZAR",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      case "complete":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const getDocumentIcon = (documentType: string) => {
    switch (documentType.toLowerCase()) {
      case "tendernotice":
      case "notice":
        return <FileText className="h-4 w-4" />;
      case "biddingdocuments":
      case "tender":
        return <Download className="h-4 w-4" />;
      case "technicalspecifications":
        return <FileText className="h-4 w-4" />;
      case "evaluationcriteria":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getErrorIcon = (error: ApiError) => {
    if (error.retryable) {
      return <WifiOff className="h-12 w-12 text-orange-500 mx-auto mb-4" />;
    }
    return <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />;
  };

  const getErrorColor = (error: ApiError) => {
    if (error.retryable) {
      return "border-orange-200 bg-orange-50";
    }
    return "border-red-200 bg-red-50";
  };

  const getErrorTextColor = (error: ApiError) => {
    if (error.retryable) {
      return "text-orange-600";
    }
    return "text-red-600";
  };

  // Helper functions for briefing session information
  const hasBriefingSession = (tender: Tender): boolean => {
    // Check if there are any milestones related to briefing sessions
    if (tender.milestones && tender.milestones.length > 0) {
      const briefingMilestones = tender.milestones.filter(
        (milestone) =>
          milestone.type?.toLowerCase().includes("briefing") ||
          (milestone.title &&
            milestone.title.toLowerCase().includes("briefing")) ||
          (milestone.description &&
            milestone.description.toLowerCase().includes("briefing"))
      );
      if (briefingMilestones.length > 0) return true;
    }

    // Check if there's any mention of briefing in the description or submission details
    if (
      tender.description &&
      tender.description.toLowerCase().includes("briefing")
    )
      return true;
    if (
      tender.submissionMethodDetails &&
      tender.submissionMethodDetails.toLowerCase().includes("briefing")
    )
      return true;

    return false;
  };

  const isCompulsoryBriefing = (tender: Tender): boolean => {
    // Check if there are any milestones indicating compulsory briefing
    if (tender.milestones && tender.milestones.length > 0) {
      const compulsoryMilestones = tender.milestones.filter(
        (milestone) =>
          (milestone.type?.toLowerCase().includes("briefing") ||
            (milestone.title &&
              milestone.title.toLowerCase().includes("briefing")) ||
            (milestone.description &&
              milestone.description.toLowerCase().includes("briefing"))) &&
          ((milestone.title &&
            milestone.title.toLowerCase().includes("compulsory")) ||
            (milestone.description &&
              milestone.description.toLowerCase().includes("compulsory")))
      );
      if (compulsoryMilestones.length > 0) return true;
    }

    // Check if there's any mention of compulsory briefing in the description or submission details
    const compulsoryTerms = [
      "compulsory briefing",
      "mandatory briefing",
      "required briefing",
    ];

    for (const term of compulsoryTerms) {
      if (tender.description && tender.description.toLowerCase().includes(term))
        return true;
      if (
        tender.submissionMethodDetails &&
        tender.submissionMethodDetails.toLowerCase().includes(term)
      )
        return true;
    }

    return false;
  };

  const getBriefingDate = (tender: Tender): string | null => {
    // Check milestones for briefing date
    if (tender.milestones && tender.milestones.length > 0) {
      const briefingMilestones = tender.milestones.filter(
        (milestone) =>
          milestone.type?.toLowerCase().includes("briefing") ||
          (milestone.title &&
            milestone.title.toLowerCase().includes("briefing")) ||
          (milestone.description &&
            milestone.description.toLowerCase().includes("briefing"))
      );

      if (briefingMilestones.length > 0 && briefingMilestones[0].dueDate) {
        return briefingMilestones[0].dueDate;
      }
    }

    return null;
  };

  const getBriefingTime = (tender: Tender): string | null => {
    // Extract time from briefing milestone or description
    const briefingDate = getBriefingDate(tender);
    if (briefingDate) {
      const date = new Date(briefingDate);
      if (date.getHours() !== 0 || date.getMinutes() !== 0) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }

    // Try to find time in description or milestone description
    if (tender.milestones && tender.milestones.length > 0) {
      const briefingMilestones = tender.milestones.filter(
        (milestone) =>
          milestone.type?.toLowerCase().includes("briefing") ||
          (milestone.title &&
            milestone.title.toLowerCase().includes("briefing")) ||
          (milestone.description &&
            milestone.description.toLowerCase().includes("briefing"))
      );

      if (briefingMilestones.length > 0 && briefingMilestones[0].description) {
        // Try to extract time using regex (looking for patterns like "10:00" or "10h00")
        const timeRegex = /(\d{1,2})[:\h](\d{2})/;
        const match = briefingMilestones[0].description.match(timeRegex);
        if (match) {
          return `${match[1]}:${match[2]}`;
        }
      }
    }

    return null;
  };

  const getBriefingVenue = (tender: Tender): string | null => {
    // Check milestones for briefing venue
    if (tender.milestones && tender.milestones.length > 0) {
      const briefingMilestones = tender.milestones.filter(
        (milestone) =>
          milestone.type?.toLowerCase().includes("briefing") ||
          (milestone.title &&
            milestone.title.toLowerCase().includes("briefing")) ||
          (milestone.description &&
            milestone.description.toLowerCase().includes("briefing"))
      );

      if (briefingMilestones.length > 0 && briefingMilestones[0].description) {
        // If we have a description, try to extract venue information
        // This is a simplistic approach - in a real app, you might use NLP or more sophisticated parsing
        const description = briefingMilestones[0].description;

        // Look for venue indicators
        const venueIndicators = [
          "venue:",
          "location:",
          "place:",
          "at:",
          "address:",
        ];
        for (const indicator of venueIndicators) {
          const index = description.toLowerCase().indexOf(indicator);
          if (index !== -1) {
            // Extract text after the indicator until the end of line or a period
            const venueStart = index + indicator.length;
            const venueEnd = Math.min(
              description.indexOf("\n", venueStart) !== -1
                ? description.indexOf("\n", venueStart)
                : description.length,
              description.indexOf(".", venueStart) !== -1
                ? description.indexOf(".", venueStart) + 1
                : description.length
            );
            return description.substring(venueStart, venueEnd).trim();
          }
        }

        // If no specific indicators found, return the whole description as it likely contains venue info
        return description;
      }
    }

    return null;
  };

  const getBriefingContactPerson = (tender: Tender): string | null => {
    // Check if there's a contact point in the procuring entity
    if (tender.procuringEntity?.contactPoint?.name) {
      return tender.procuringEntity.contactPoint.name;
    }

    // Check if there are parties with contact information
    if (release.parties && release.parties.length > 0) {
      const contactParties = release.parties.filter(
        (party) => party.contactPoint?.name
      );
      if (contactParties.length > 0) {
        return contactParties[0].contactPoint!.name!;
      }
    }

    return null;
  };

  const getBriefingContactEmail = (tender: Tender): string | null => {
    // Check if there's a contact point in the procuring entity
    if (tender.procuringEntity?.contactPoint?.email) {
      return tender.procuringEntity.contactPoint.email;
    }

    // Check if there are parties with contact information
    if (release.parties && release.parties.length > 0) {
      const contactParties = release.parties.filter(
        (party) => party.contactPoint?.email
      );
      if (contactParties.length > 0) {
        return contactParties[0].contactPoint!.email!;
      }
    }

    return null;
  };

  const getBriefingContactPhone = (tender: Tender): string | null => {
    // Check if there's a contact point in the procuring entity
    if (tender.procuringEntity?.contactPoint?.telephone) {
      return tender.procuringEntity.contactPoint.telephone;
    }

    // Check if there are parties with contact information
    if (release.parties && release.parties.length > 0) {
      const contactParties = release.parties.filter(
        (party) => party.contactPoint?.telephone
      );
      if (contactParties.length > 0) {
        return contactParties[0].contactPoint!.telephone!;
      }
    }

    return null;
  };

  // Helper functions for special conditions
  const hasSpecialConditions = (tender: Tender): boolean => {
    return !!(
      tender.eligibilityCriteria ||
      tender.submissionMethodDetails ||
      tender.awardCriteriaDetails ||
      getAdditionalRequirements(tender).length > 0
    );
  };

  const getAdditionalRequirements = (tender: Tender): string[] => {
    const requirements: string[] = [];

    // Check for special requirements in various fields
    if (tender.procurementMethodRationale) {
      requirements.push(tender.procurementMethodRationale);
    }

    if (tender.reviewDetails) {
      requirements.push(tender.reviewDetails);
    }

    // Extract requirements from milestones
    if (tender.milestones && tender.milestones.length > 0) {
      const requirementMilestones = tender.milestones.filter(
        (milestone) =>
          milestone.type?.toLowerCase().includes("requirement") ||
          (milestone.title &&
            milestone.title.toLowerCase().includes("requirement")) ||
          (milestone.description &&
            milestone.description.toLowerCase().includes("requirement"))
      );

      requirementMilestones.forEach((milestone) => {
        if (milestone.description) {
          requirements.push(milestone.description);
        } else if (milestone.title) {
          requirements.push(milestone.title);
        }
      });
    }

    return requirements;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {retryCount > 0
              ? `Loading tender details... (Attempt ${retryCount + 1})`
              : "Loading tender details..."}
          </p>
          <p className="text-sm text-gray-500 mt-2">OCID: {ocid}</p>
        </div>
      </div>
    );
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
            <p
              className={`${getErrorTextColor(
                error!
              )} font-medium text-lg mb-2`}
            >
              {error?.error || "Tender not found"}
            </p>
            <p className={`${getErrorTextColor(error!)} text-sm mb-4`}>
              {error?.message || "The requested tender could not be found"}
            </p>

            {error?.suggestions && (
              <div className="text-left max-w-md mx-auto mb-4">
                <p className={`font-medium ${getErrorTextColor(error)} mb-2`}>
                  Possible solutions:
                </p>
                <ul className={`text-sm ${getErrorTextColor(error)} space-y-1`}>
                  {error.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span
                        className={`${
                          error.retryable ? "text-orange-400" : "text-red-400"
                        } mt-1`}
                      >
                        •
                      </span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              {error?.retryable && (
                <Button
                  onClick={() => fetchTenderDetail(true)}
                  variant="outline"
                  className="bg-transparent"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {retryCount > 0 ? `Retry (${retryCount + 1})` : "Try Again"}
                </Button>
              )}
              <Link href="/">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  Browse All Tenders
                </Button>
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
    );
  }

  const tender = release.tender;

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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {tender.title}
            </h1>
            <p className="text-lg text-teal-600 mb-2">
              {tender.procuringEntity?.name}
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>OCID: {release.ocid}</span>
              <span>•</span>
              <span>Release ID: {release.id}</span>
              <span>•</span>
              <span>
                Published: {format(new Date(release.date), "MMM dd, yyyy")}
              </span>
            </div>
          </div>
          <Badge className={getStatusColor(tender.status)}>
            {tender.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="bid-details">Bid Details</TabsTrigger>
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
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {tender.description}
                  </p>
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
                        <span className="font-medium">
                          Primary Classification:
                        </span>
                        <div className="mt-1 text-sm text-gray-600">
                          <div>Scheme: {tender.classification.scheme}</div>
                          <div>Code: {tender.classification.id}</div>
                          <div>
                            Description: {tender.classification.description}
                          </div>
                        </div>
                      </div>

                      {tender.additionalClassifications &&
                        tender.additionalClassifications.length > 0 && (
                          <div>
                            <span className="font-medium">
                              Additional Classifications:
                            </span>
                            <div className="mt-1 space-y-2">
                              {tender.additionalClassifications.map(
                                (classification, index) => (
                                  <div
                                    key={index}
                                    className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3"
                                  >
                                    <div>Scheme: {classification.scheme}</div>
                                    <div>Code: {classification.id}</div>
                                    <div>
                                      Description: {classification.description}
                                    </div>
                                  </div>
                                )
                              )}
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
                        <span className="font-medium">Method:</span>{" "}
                        {tender.procurementMethod}
                      </div>
                      {tender.procurementMethodDetails && (
                        <div>
                          <span className="font-medium">Details:</span>{" "}
                          {tender.procurementMethodDetails}
                        </div>
                      )}
                      {tender.procurementMethodRationale && (
                        <div>
                          <span className="font-medium">Rationale:</span>{" "}
                          {tender.procurementMethodRationale}
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
                        <span className="font-medium">Criteria:</span>{" "}
                        {tender.awardCriteria}
                      </div>
                      {tender.awardCriteriaDetails && (
                        <div>
                          <span className="font-medium">Details:</span>{" "}
                          {tender.awardCriteriaDetails}
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
                            <h4 className="font-medium">
                              {lot.title || `Lot ${lot.id}`}
                            </h4>
                            <Badge className={getStatusColor(lot.status)}>
                              {lot.status}
                            </Badge>
                          </div>
                          <p className="text-gray-600 text-sm mb-2">
                            {lot.description}
                          </p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {lot.value && (
                              <div>
                                <span className="font-medium">Value:</span>{" "}
                                {formatCurrency(
                                  lot.value.amount,
                                  lot.value.currency
                                )}
                              </div>
                            )}
                            {lot.hasOptions && (
                              <div>
                                <span className="font-medium">
                                  Has Options:
                                </span>{" "}
                                Yes
                              </div>
                            )}
                            {lot.hasRenewal && (
                              <div>
                                <span className="font-medium">
                                  Has Renewal:
                                </span>{" "}
                                Yes
                              </div>
                            )}
                            {lot.contractPeriod && (
                              <div className="col-span-2">
                                <span className="font-medium">
                                  Contract Period:
                                </span>
                                {lot.contractPeriod.startDate && (
                                  <span>
                                    {" "}
                                    From{" "}
                                    {format(
                                      new Date(lot.contractPeriod.startDate),
                                      "MMM dd, yyyy"
                                    )}
                                  </span>
                                )}
                                {lot.contractPeriod.endDate && (
                                  <span>
                                    {" "}
                                    to{" "}
                                    {format(
                                      new Date(lot.contractPeriod.endDate),
                                      "MMM dd, yyyy"
                                    )}
                                  </span>
                                )}
                                {lot.contractPeriod.durationInDays && (
                                  <span>
                                    {" "}
                                    ({lot.contractPeriod.durationInDays} days)
                                  </span>
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
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {tender.eligibilityCriteria}
                    </p>
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
                        <span className="font-medium">Methods:</span>{" "}
                        {tender.submissionMethod.join(", ")}
                      </div>
                      {tender.submissionMethodDetails && (
                        <div>
                          <span className="font-medium">Details:</span>
                          <p className="mt-1 text-gray-600 whitespace-pre-wrap">
                            {tender.submissionMethodDetails}
                          </p>
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
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {tender.reviewDetails}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Special Features */}
              {(tender.hasElectronicAuction ||
                tender.hasFrameworkAgreement ||
                tender.numberOfTenderers) && (
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
                          <span className="font-medium">
                            Number of Tenderers:
                          </span>{" "}
                          {tender.numberOfTenderers}
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
                          <h4 className="font-medium mb-2">
                            {item.description}
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Item ID:</span>{" "}
                              {item.id}
                            </div>
                            {item.quantity && (
                              <div>
                                <span className="font-medium">Quantity:</span>{" "}
                                {item.quantity} {item.unit?.name || "units"}
                              </div>
                            )}
                            {item.unit?.value && (
                              <div>
                                <span className="font-medium">Unit Value:</span>{" "}
                                {formatCurrency(
                                  item.unit.value.amount,
                                  item.unit.value.currency
                                )}
                              </div>
                            )}
                            {item.classification && (
                              <div className="col-span-2">
                                <span className="font-medium">
                                  Classification:
                                </span>{" "}
                                {item.classification.description} (
                                {item.classification.id})
                              </div>
                            )}
                            {item.additionalClassifications &&
                              item.additionalClassifications.length > 0 && (
                                <div className="col-span-2">
                                  <span className="font-medium">
                                    Additional Classifications:
                                  </span>
                                  <ul className="mt-1 space-y-1">
                                    {item.additionalClassifications.map(
                                      (classification, index) => (
                                        <li key={index} className="text-xs">
                                          {classification.description} (
                                          {classification.id})
                                        </li>
                                      )
                                    )}
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
                    <p className="text-gray-500">
                      No items specified for this tender
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="bid-details" className="space-y-6">
              {/* Request for Bid Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-teal-600" />
                    Request for Bid Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Department Information */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-500" />
                      Department
                    </h4>
                    <p className="text-gray-700">
                      {tender.procuringEntity?.name || "Not specified"}
                    </p>
                  </div>

                  {/* Delivery Location */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <MapPinned className="h-4 w-4 text-gray-500" />
                      Delivery Location
                    </h4>
                    <p className="text-gray-700">
                      {tender.procuringEntity?.address?.streetAddress ||
                        tender.procuringEntity?.address?.locality ||
                        tender.procuringEntity?.address?.region ||
                        "Not specified"}
                      {tender.procuringEntity?.address?.locality &&
                        `, ${tender.procuringEntity.address.locality}`}
                      {tender.procuringEntity?.address?.region &&
                        `, ${tender.procuringEntity.address.region}`}
                      {tender.procuringEntity?.address?.countryName &&
                        `, ${tender.procuringEntity.address.countryName}`}
                    </p>
                  </div>

                  {/* Bid Description */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      Bid Description
                    </h4>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {tender.description}
                    </p>
                  </div>

                  {/* Key Dates */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-gray-500" />
                      Key Dates
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tender.tenderPeriod?.startDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-teal-600" />
                          <div>
                            <span className="text-sm text-gray-500">
                              Opening Date:
                            </span>
                            <p className="text-gray-700">
                              {format(
                                new Date(tender.tenderPeriod.startDate),
                                "MMMM dd, yyyy"
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      {tender.tenderPeriod?.endDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-red-600" />
                          <div>
                            <span className="text-sm text-gray-500">
                              Closing Date:
                            </span>
                            <p className="text-gray-700">
                              {format(
                                new Date(tender.tenderPeriod.endDate),
                                "MMMM dd, yyyy"
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      {release.date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <div>
                            <span className="text-sm text-gray-500">
                              Modified Date:
                            </span>
                            <p className="text-gray-700">
                              {format(new Date(release.date), "MMMM dd, yyyy")}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Briefing Session Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    Briefing Session Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasBriefingSession(tender) ? (
                    <div className="space-y-4">
                      {/* Compulsory Status */}
                      <div className="flex items-center gap-2">
                        {isCompulsoryBriefing(tender) ? (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                            Compulsory Briefing
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            Optional Briefing
                          </Badge>
                        )}
                      </div>

                      {/* Briefing Date and Time */}
                      {getBriefingDate(tender) && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            Briefing Date & Time
                          </h4>
                          <div className="flex items-center gap-2">
                            <div className="bg-teal-50 text-teal-700 p-2 rounded-md flex items-center gap-2">
                              <CalendarDays className="h-5 w-5" />
                              <span className="font-medium">
                                {format(
                                  new Date(getBriefingDate(tender)!),
                                  "MMMM dd, yyyy"
                                )}
                              </span>
                              {getBriefingTime(tender) && (
                                <span className="text-teal-600">
                                  at {getBriefingTime(tender)}
                                </span>
                              )}
                            </div>
                            <Button variant="outline" size="sm">
                              <Calendar className="h-4 w-4 mr-2" />
                              Add to Calendar
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Briefing Venue */}
                      {getBriefingVenue(tender) && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            Briefing Venue
                          </h4>
                          <div className="bg-gray-50 p-3 rounded-md">
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {getBriefingVenue(tender)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Briefing Contact Information */}
                      {getBriefingContactPerson(tender) && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            Briefing Contact
                          </h4>
                          <div className="bg-gray-50 p-3 rounded-md">
                            <p className="font-medium">
                              {getBriefingContactPerson(tender)}
                            </p>
                            {getBriefingContactEmail(tender) && (
                              <div className="flex items-center gap-2 mt-1">
                                <Mail className="h-4 w-4 text-gray-500" />
                                <a
                                  href={`mailto:${getBriefingContactEmail(
                                    tender
                                  )}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {getBriefingContactEmail(tender)}
                                </a>
                              </div>
                            )}
                            {getBriefingContactPhone(tender) && (
                              <div className="flex items-center gap-2 mt-1">
                                <Phone className="h-4 w-4 text-gray-500" />
                                <a
                                  href={`tel:${getBriefingContactPhone(
                                    tender
                                  )}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {getBriefingContactPhone(tender)}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Info className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">
                        No briefing session information available for this
                        tender
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Special Conditions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-teal-600" />
                    Special Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasSpecialConditions(tender) ? (
                    <div className="space-y-4">
                      {/* Eligibility Criteria */}
                      {tender.eligibilityCriteria && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-gray-500" />
                            Eligibility Criteria
                          </h4>
                          <div className="bg-gray-50 p-3 rounded-md">
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {tender.eligibilityCriteria}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Submission Requirements */}
                      {tender.submissionMethodDetails && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            Submission Requirements
                          </h4>
                          <div className="bg-gray-50 p-3 rounded-md">
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {tender.submissionMethodDetails}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Award Criteria */}
                      {tender.awardCriteriaDetails && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-gray-500" />
                            Award Criteria
                          </h4>
                          <div className="bg-gray-50 p-3 rounded-md">
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {tender.awardCriteriaDetails}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Additional Requirements */}
                      {getAdditionalRequirements(tender).length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-gray-500" />
                            Additional Requirements
                          </h4>
                          <div className="bg-gray-50 p-3 rounded-md">
                            <ul className="list-disc pl-5 space-y-1">
                              {getAdditionalRequirements(tender).map(
                                (requirement, index) => (
                                  <li key={index} className="text-gray-700">
                                    {requirement}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Info className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">
                        No special conditions specified for this tender
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Request for Bid Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-teal-600" />
                    Request for Bid Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Department */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Department:</span>
                    </div>
                    <p className="text-gray-700 pl-6">
                      {tender.procuringEntity?.name || "Not specified"}
                    </p>
                  </div>

                  {/* Bid Description */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Bid Description:</span>
                    </div>
                    <p className="text-gray-700 pl-6 whitespace-pre-wrap">
                      {tender.description || "No description provided"}
                    </p>
                  </div>

                  {/* Delivery Location */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Delivery Location:</span>
                    </div>
                    <p className="text-gray-700 pl-6">
                      {tender.procuringEntity?.address ? (
                        <>
                          {[
                            tender.procuringEntity.address.streetAddress,
                            tender.procuringEntity.address.locality,
                            tender.procuringEntity.address.region,
                            tender.procuringEntity.address.postalCode,
                            tender.procuringEntity.address.countryName,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </>
                      ) : (
                        "Not specified"
                      )}
                    </p>
                  </div>

                  {/* Procurement Category */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Procurement Category:</span>
                    </div>
                    <p className="text-gray-700 pl-6">
                      {tender.mainProcurementCategory || "Not specified"}
                      {tender.additionalProcurementCategories &&
                        tender.additionalProcurementCategories.length > 0 && (
                          <span className="text-gray-500">
                            {" "}
                            (Additional:{" "}
                            {tender.additionalProcurementCategories.join(", ")})
                          </span>
                        )}
                    </p>
                  </div>

                  {/* Value */}
                  {tender.value && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Estimated Value:</span>
                      </div>
                      <p className="text-gray-700 pl-6">
                        {formatCurrency(
                          tender.value.amount,
                          tender.value.currency
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contact Information Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Find contact information from parties or procuring entity */}
                  {(() => {
                    // Try to find contact information from parties first
                    const procuringParty = release.parties?.find((party) =>
                      party.roles.includes("procuringEntity")
                    );

                    const contactPoint =
                      procuringParty?.contactPoint ||
                      tender.procuringEntity?.contactPoint;

                    const organizationName =
                      procuringParty?.name || tender.procuringEntity?.name;

                    const address =
                      procuringParty?.address ||
                      tender.procuringEntity?.address;

                    if (!contactPoint && !organizationName && !address) {
                      return (
                        <div className="text-center py-4">
                          <Info className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500">
                            No contact information available
                          </p>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Organization Name */}
                        {organizationName && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">Organization:</span>
                            </div>
                            <p className="text-gray-700 pl-6">
                              {organizationName}
                            </p>
                          </div>
                        )}

                        {/* Contact Person */}
                        {contactPoint?.name && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">
                                Contact Person:
                              </span>
                            </div>
                            <p className="text-gray-700 pl-6">
                              {contactPoint.name}
                            </p>
                          </div>
                        )}

                        {/* Email with click-to-contact */}
                        {contactPoint?.email && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">Email:</span>
                            </div>
                            <p className="text-gray-700 pl-6">
                              <a
                                href={`mailto:${contactPoint.email}`}
                                className="text-teal-600 hover:underline flex items-center gap-1"
                              >
                                {contactPoint.email}
                                <span className="text-xs text-gray-500">
                                  (click to email)
                                </span>
                              </a>
                            </p>
                          </div>
                        )}

                        {/* Telephone with click-to-contact */}
                        {contactPoint?.telephone && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">Telephone:</span>
                            </div>
                            <p className="text-gray-700 pl-6">
                              <a
                                href={`tel:${contactPoint.telephone}`}
                                className="text-teal-600 hover:underline flex items-center gap-1"
                              >
                                {contactPoint.telephone}
                                <span className="text-xs text-gray-500">
                                  (click to call)
                                </span>
                              </a>
                            </p>
                          </div>
                        )}

                        {/* Fax with click-to-contact */}
                        {contactPoint?.faxNumber && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">Fax:</span>
                            </div>
                            <p className="text-gray-700 pl-6">
                              <a
                                href={`fax:${contactPoint.faxNumber}`}
                                className="text-teal-600 hover:underline flex items-center gap-1"
                              >
                                {contactPoint.faxNumber}
                                <span className="text-xs text-gray-500">
                                  (click to fax)
                                </span>
                              </a>
                            </p>
                          </div>
                        )}

                        {/* Website URL if available */}
                        {contactPoint?.url && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">Website:</span>
                            </div>
                            <p className="text-gray-700 pl-6">
                              <a
                                href={contactPoint.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 hover:underline flex items-center gap-1"
                              >
                                {contactPoint.url}
                                <span className="text-xs text-gray-500">
                                  (click to visit)
                                </span>
                              </a>
                            </p>
                          </div>
                        )}

                        {/* Address */}
                        {address && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">Address:</span>
                            </div>
                            <p className="text-gray-700 pl-6 whitespace-pre-wrap">
                              {[
                                address.streetAddress,
                                address.locality,
                                address.region,
                                address.postalCode,
                                address.countryName,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Key Dates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-teal-600" />
                    Key Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Published Date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Published Date:</span>
                    </div>
                    <span className="text-gray-700">
                      {format(new Date(release.date), "MMM dd, yyyy")}
                    </span>
                  </div>

                  {/* Opening Date (Tender Period Start) */}
                  {tender.tenderPeriod?.startDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Opening Date:</span>
                      </div>
                      <span className="text-gray-700">
                        {format(
                          new Date(tender.tenderPeriod.startDate),
                          "MMM dd, yyyy"
                        )}
                      </span>
                    </div>
                  )}

                  {/* Closing Date (Tender Period End) */}
                  {tender.tenderPeriod?.endDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Closing Date:</span>
                      </div>
                      <span className="text-gray-700">
                        {format(
                          new Date(tender.tenderPeriod.endDate),
                          "MMM dd, yyyy"
                        )}
                      </span>
                    </div>
                  )}

                  {/* Enquiry Period */}
                  {tender.enquiryPeriod?.startDate &&
                    tender.enquiryPeriod?.endDate && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Enquiry Period:</span>
                        </div>
                        <span className="text-gray-700">
                          {format(
                            new Date(tender.enquiryPeriod.startDate),
                            "MMM dd"
                          )}{" "}
                          -{" "}
                          {format(
                            new Date(tender.enquiryPeriod.endDate),
                            "MMM dd, yyyy"
                          )}
                        </span>
                      </div>
                    )}

                  {/* Award Period */}
                  {tender.awardPeriod?.startDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Award Period Start:</span>
                      </div>
                      <span className="text-gray-700">
                        {format(
                          new Date(tender.awardPeriod.startDate),
                          "MMM dd, yyyy"
                        )}
                      </span>
                    </div>
                  )}

                  {/* Contract Period */}
                  {tender.contractPeriod?.startDate &&
                    tender.contractPeriod?.endDate && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Contract Period:</span>
                        </div>
                        <span className="text-gray-700">
                          {format(
                            new Date(tender.contractPeriod.startDate),
                            "MMM dd, yyyy"
                          )}{" "}
                          -{" "}
                          {format(
                            new Date(tender.contractPeriod.endDate),
                            "MMM dd, yyyy"
                          )}
                          {tender.contractPeriod.durationInDays && (
                            <span className="text-gray-500 ml-1">
                              ({tender.contractPeriod.durationInDays} days)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                </CardContent>
              </Card>

              {/* Request for Bid Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-teal-600" />
                    Request for Bid Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Department
                    </h3>
                    <div className="flex items-start gap-3">
                      <Building className="h-5 w-5 text-gray-500 mt-0.5" />
                      <p className="text-gray-700">
                        {tender.procuringEntity?.name ||
                          "Department not specified"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Bid Description
                    </h3>
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-gray-500 mt-0.5" />
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {tender.description}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Delivery Location
                    </h3>
                    <div className="flex items-start gap-3">
                      <Truck className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div className="text-gray-700">
                        {tender.items?.some(
                          (item) =>
                            item.deliveryLocation || item.deliveryAddress
                        ) ? (
                          <div className="space-y-2">
                            {tender.items
                              .filter(
                                (item) =>
                                  item.deliveryLocation || item.deliveryAddress
                              )
                              .map((item, index) => {
                                const address =
                                  item.deliveryLocation || item.deliveryAddress;
                                if (!address) return null;

                                const addressParts = [];
                                if (address.streetAddress)
                                  addressParts.push(address.streetAddress);
                                if (address.locality)
                                  addressParts.push(address.locality);
                                if (address.region)
                                  addressParts.push(address.region);
                                if (address.postalCode)
                                  addressParts.push(address.postalCode);
                                if (address.countryName)
                                  addressParts.push(address.countryName);

                                return (
                                  <div
                                    key={index}
                                    className="border-l-2 border-gray-200 pl-3"
                                  >
                                    <p className="text-sm font-medium">
                                      {item.description}
                                    </p>
                                    <p className="text-sm">
                                      {addressParts.join(", ")}
                                    </p>
                                  </div>
                                );
                              })}
                          </div>
                        ) : tender.procuringEntity?.address ? (
                          <div>
                            <p className="text-sm italic mb-1">
                              Default delivery location (procuring entity
                              address):
                            </p>
                            <p>
                              {[
                                tender.procuringEntity.address.streetAddress,
                                tender.procuringEntity.address.locality,
                                tender.procuringEntity.address.region,
                                tender.procuringEntity.address.postalCode,
                                tender.procuringEntity.address.countryName,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          </div>
                        ) : (
                          <p>Delivery location not specified</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Place of Service
                    </h3>
                    <div className="flex items-start gap-3">
                      <MapPinned className="h-5 w-5 text-gray-500 mt-0.5" />
                      <p className="text-gray-700">
                        {tender.procuringEntity?.address
                          ? [
                              tender.procuringEntity.address.streetAddress,
                              tender.procuringEntity.address.locality,
                              tender.procuringEntity.address.region,
                              tender.procuringEntity.address.postalCode,
                              tender.procuringEntity.address.countryName,
                            ]
                              .filter(Boolean)
                              .join(", ")
                          : "Place of service not specified"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Procurement Category
                    </h3>
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-gray-700 capitalize">
                          {tender.mainProcurementCategory}
                        </p>
                        {tender.additionalProcurementCategories &&
                          tender.additionalProcurementCategories.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">
                                Additional Categories:
                              </p>
                              <ul className="list-disc list-inside text-sm text-gray-600 ml-1">
                                {tender.additionalProcurementCategories.map(
                                  (category, index) => (
                                    <li key={index} className="capitalize">
                                      {category}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Key Dates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-teal-600" />
                    Key Dates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Opening Date */}
                    {tender.tenderPeriod?.startDate && (
                      <div className="flex items-start gap-3">
                        <CalendarDays className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="font-medium">Opening Date</p>
                          <p className="text-gray-700">
                            {format(
                              new Date(tender.tenderPeriod.startDate),
                              "MMMM dd, yyyy"
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Closing Date */}
                    {tender.tenderPeriod?.endDate && (
                      <div className="flex items-start gap-3">
                        <CalendarDays className="h-5 w-5 text-red-500 mt-0.5" />
                        <div>
                          <p className="font-medium">Closing Date</p>
                          <p className="text-gray-700">
                            {format(
                              new Date(tender.tenderPeriod.endDate),
                              "MMMM dd, yyyy"
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Modified Date */}
                    {release.date && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="font-medium">Last Modified</p>
                          <p className="text-gray-700">
                            {format(new Date(release.date), "MMMM dd, yyyy")}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Enquiry Period */}
                    {tender.enquiryPeriod &&
                      (tender.enquiryPeriod.startDate ||
                        tender.enquiryPeriod.endDate) && (
                        <div className="flex items-start gap-3">
                          <Users className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="font-medium">Enquiry Period</p>
                            <p className="text-gray-700">
                              {tender.enquiryPeriod.startDate && (
                                <>
                                  From{" "}
                                  {format(
                                    new Date(tender.enquiryPeriod.startDate),
                                    "MMMM dd, yyyy"
                                  )}
                                </>
                              )}
                              {tender.enquiryPeriod.startDate &&
                                tender.enquiryPeriod.endDate &&
                                " "}
                              {tender.enquiryPeriod.endDate && (
                                <>
                                  to{" "}
                                  {format(
                                    new Date(tender.enquiryPeriod.endDate),
                                    "MMMM dd, yyyy"
                                  )}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Award Period */}
                    {tender.awardPeriod &&
                      (tender.awardPeriod.startDate ||
                        tender.awardPeriod.endDate) && (
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="font-medium">Award Period</p>
                            <p className="text-gray-700">
                              {tender.awardPeriod.startDate && (
                                <>
                                  From{" "}
                                  {format(
                                    new Date(tender.awardPeriod.startDate),
                                    "MMMM dd, yyyy"
                                  )}
                                </>
                              )}
                              {tender.awardPeriod.startDate &&
                                tender.awardPeriod.endDate &&
                                " "}
                              {tender.awardPeriod.endDate && (
                                <>
                                  to{" "}
                                  {format(
                                    new Date(tender.awardPeriod.endDate),
                                    "MMMM dd, yyyy"
                                  )}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Published Date */}
                    <div className="flex items-start gap-3">
                      <Globe className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Published Date</p>
                        <p className="text-gray-700">
                          {format(new Date(release.date), "MMMM dd, yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getDocumentIcon(doc.documentType)}
                            <div>
                              <h4 className="font-medium">{doc.title}</h4>
                              {doc.description && (
                                <p className="text-sm text-gray-600">
                                  {doc.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                <span>Type: {doc.documentType}</span>
                                {doc.format && (
                                  <span>Format: {doc.format}</span>
                                )}
                                {doc.language && (
                                  <span>Language: {doc.language}</span>
                                )}
                                {doc.datePublished && (
                                  <span>
                                    Published:{" "}
                                    {format(
                                      new Date(doc.datePublished),
                                      "MMM dd, yyyy"
                                    )}
                                  </span>
                                )}
                                {doc.dateModified && (
                                  <span>
                                    Modified:{" "}
                                    {format(
                                      new Date(doc.dateModified),
                                      "MMM dd, yyyy"
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {doc.url && (
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
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
                    <p className="text-gray-500">
                      No documents available for this tender
                    </p>
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
                    <div className="font-medium">
                      {formatCurrency(
                        tender.value.amount,
                        tender.value.currency
                      )}
                    </div>
                    <div className="text-xs text-gray-500">Estimated Value</div>
                  </div>
                </div>
              )}

              {tender.minValue && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">
                      {formatCurrency(
                        tender.minValue.amount,
                        tender.minValue.currency
                      )}
                    </div>
                    <div className="text-xs text-gray-500">Minimum Value</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="font-medium capitalize">
                    {tender.mainProcurementCategory}
                  </div>
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
                    <div className="font-medium">
                      {tender.hasEnquiries ? "Allowed" : "Not Allowed"}
                    </div>
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
                      <div>
                        Opens:{" "}
                        {format(
                          new Date(tender.tenderPeriod.startDate),
                          "MMM dd, yyyy h:mmaaa"
                        )}
                      </div>
                    )}
                    {tender.tenderPeriod.endDate && (
                      <div>
                        Closes:{" "}
                        {format(
                          new Date(tender.tenderPeriod.endDate),
                          "MMM dd, yyyy h:mmaaa"
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Enhanced Timeline Information */}
              {tender.enquiryPeriod &&
                (tender.enquiryPeriod.startDate ||
                  tender.enquiryPeriod.endDate) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Enquiry Period</span>
                    </div>
                    <div className="text-sm text-gray-600 ml-6">
                      {tender.enquiryPeriod.startDate && (
                        <div>
                          Starts:{" "}
                          {format(
                            new Date(tender.enquiryPeriod.startDate),
                            "MMM dd, yyyy"
                          )}
                        </div>
                      )}
                      {tender.enquiryPeriod.endDate && (
                        <div>
                          Ends:{" "}
                          {format(
                            new Date(tender.enquiryPeriod.endDate),
                            "MMM dd, yyyy"
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {tender.awardPeriod &&
                (tender.awardPeriod.startDate ||
                  tender.awardPeriod.endDate) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Award Period</span>
                    </div>
                    <div className="text-sm text-gray-600 ml-6">
                      {tender.awardPeriod.startDate && (
                        <div>
                          Starts:{" "}
                          {format(
                            new Date(tender.awardPeriod.startDate),
                            "MMM dd, yyyy"
                          )}
                        </div>
                      )}
                      {tender.awardPeriod.endDate && (
                        <div>
                          Ends:{" "}
                          {format(
                            new Date(tender.awardPeriod.endDate),
                            "MMM dd, yyyy"
                          )}
                        </div>
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
                      <div>
                        From:{" "}
                        {format(
                          new Date(tender.enquiryPeriod.startDate),
                          "MMM dd, yyyy"
                        )}
                      </div>
                    )}
                    {tender.enquiryPeriod.endDate && (
                      <div>
                        Until:{" "}
                        {format(
                          new Date(tender.enquiryPeriod.endDate),
                          "MMM dd, yyyy"
                        )}
                      </div>
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
                      <div>
                        Expected:{" "}
                        {format(
                          new Date(tender.awardPeriod.startDate),
                          "MMM dd, yyyy"
                        )}
                      </div>
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
                      <div>
                        Starts:{" "}
                        {format(
                          new Date(tender.contractPeriod.startDate),
                          "MMM dd, yyyy"
                        )}
                      </div>
                    )}
                    {tender.contractPeriod.endDate && (
                      <div>
                        Ends:{" "}
                        {format(
                          new Date(tender.contractPeriod.endDate),
                          "MMM dd, yyyy"
                        )}
                      </div>
                    )}
                    {tender.contractPeriod.durationInDays && (
                      <div>
                        Duration: {tender.contractPeriod.durationInDays} days
                      </div>
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
                    <div className="font-medium">
                      {tender.procuringEntity.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Procuring Entity
                    </div>
                  </div>
                </div>

                {tender.procuringEntity.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                    <div className="text-sm text-gray-600">
                      {tender.procuringEntity.address.streetAddress && (
                        <div>
                          {tender.procuringEntity.address.streetAddress}
                        </div>
                      )}
                      {tender.procuringEntity.address.locality && (
                        <div>{tender.procuringEntity.address.locality}</div>
                      )}
                      {tender.procuringEntity.address.region && (
                        <div>{tender.procuringEntity.address.region}</div>
                      )}
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
                        <span>
                          {tender.procuringEntity.contactPoint.telephone}
                        </span>
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
                    <div
                      key={milestone.id}
                      className="border-l-2 border-gray-200 pl-3"
                    >
                      <div className="font-medium text-sm">
                        {milestone.title || milestone.type}
                      </div>
                      {milestone.description && (
                        <div className="text-xs text-gray-600">
                          {milestone.description}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {milestone.dueDate && (
                          <span>
                            Due:{" "}
                            {format(
                              new Date(milestone.dueDate),
                              "MMM dd, yyyy"
                            )}
                          </span>
                        )}
                        {milestone.status && (
                          <span className="ml-2">
                            Status: {milestone.status}
                          </span>
                        )}
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
  );
}
