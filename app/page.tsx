import type { Metadata } from "next"
import MainLayout from "@/components/main-layout"
import EnhancedTenderListing from "@/components/enhanced-tender-listing"

export const metadata: Metadata = {
  title: "Procurement Tender Opportunities",
  description: "Browse active procurement opportunities from South African government entities. Find the latest tenders, RFPs, and procurement notices with detailed information including closing dates, requirements, and contact details.",
  keywords: ["South Africa", "government tenders", "procurement opportunities", "active tenders", "RFP", "government contracts", "public procurement"],
  openGraph: {
    title: "Procurement Tender Opportunities | SA Gov Tenders",
    description: "Browse active procurement opportunities from South African government entities. Find the latest tenders, RFPs, and procurement notices with detailed information.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Procurement Tender Opportunities | SA Gov Tenders",
    description: "Browse active procurement opportunities from South African government entities. Find the latest tenders, RFPs, and procurement notices.",
  },
  alternates: {
    canonical: "/",
  },
}

export default function Home() {
  return (
    <MainLayout>
      <EnhancedTenderListing 
        enableVirtualScrolling={true}
        enableAdvancedFilters={true}
        showPerformanceMetrics={true}
        autoRefreshInterval={300000} // 5 minutes
      />
    </MainLayout>
  )
}
