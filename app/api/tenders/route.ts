import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Extract query parameters with proper defaults from API documentation
  const pageNumber = searchParams.get("PageNumber") || "5" // API default is 5
  const pageSize = searchParams.get("PageSize") || "50" // API default is 50
  const dateFrom = searchParams.get("dateFrom") || "2025-01-01" // API default
  const dateTo = searchParams.get("dateTo") || "2025-03-31" // API default

  try {
    // Build the API URL with parameters
    const apiUrl = new URL("https://ocds-api.etenders.gov.za/api/OCDSReleases")
    apiUrl.searchParams.set("PageNumber", pageNumber)
    apiUrl.searchParams.set("PageSize", pageSize)
    apiUrl.searchParams.set("dateFrom", dateFrom)
    apiUrl.searchParams.set("dateTo", dateTo)

    console.log("Fetching from URL:", apiUrl.toString())

    // Fetch data from the OCDS API
    const response = await fetch(apiUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "OCDS-Tender-Listing/1.0",
      },
      // Add timeout
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    console.log("API Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API Error Response:", errorText)
      throw new Error(`API responded with status: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("API Response data keys:", Object.keys(data))
    console.log("Number of releases:", data.releases?.length || 0)

    // Return the data
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching OCDS data:", error)

    // Return error response
    return NextResponse.json(
      {
        error: "Failed to fetch tender data",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
