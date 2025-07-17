import { type NextRequest, NextResponse } from "next/server"

interface TenderDetailParams {
  params: {
    ocid: string
  }
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} for URL:`, url)

      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(20000), // 20 second timeout per attempt
      })

      // If we get a response (even if not ok), return it
      return response
    } catch (error) {
      lastError = error as Error
      console.error(`Attempt ${attempt} failed:`, error)

      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`Waiting ${delay}ms before retry...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error("Max retries exceeded")
}

export async function GET(request: NextRequest, { params }: TenderDetailParams) {
  const { ocid } = params

  if (!ocid) {
    return NextResponse.json({ error: "OCID is required" }, { status: 400 })
  }

  const decodedOcid = decodeURIComponent(ocid)
  console.log("Fetching tender detail for OCID:", decodedOcid)

  try {
    // Validate OCID format (basic validation)
    if (!decodedOcid || decodedOcid.length < 5) {
      return NextResponse.json(
        {
          error: "Invalid OCID format",
          message: `OCID "${decodedOcid}" appears to be invalid`,
          suggestions: ["Check if the OCID is complete and correctly formatted"],
        },
        { status: 400 },
      )
    }

    // Use the single release endpoint with retry logic
    const apiUrl = `https://ocds-api.etenders.gov.za/api/OCDSReleases/release/${encodeURIComponent(decodedOcid)}`

    console.log("Fetching from single release endpoint:", apiUrl)

    const response = await fetchWithRetry(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "OCDS-Tender-Detail/1.0",
        "Cache-Control": "no-cache",
      },
    })

    console.log("API Response status:", response.status)
    console.log("API Response headers:", Object.fromEntries(response.headers.entries()))

    if (response.status === 404) {
      console.log("Tender not found (404) for OCID:", decodedOcid)
      return NextResponse.json(
        {
          error: "Tender not found",
          message: `No tender found with OCID: ${decodedOcid}`,
          suggestions: [
            "The tender may have expired or been removed",
            "Check if the OCID is correct",
            "The tender may not exist in the system",
          ],
        },
        { status: 404 },
      )
    }

    if (response.status === 500) {
      console.error("Server error (500) from API for OCID:", decodedOcid)
      return NextResponse.json(
        {
          error: "Server error",
          message: "The tender service is temporarily unavailable",
          suggestions: [
            "Please try again in a few moments",
            "The tender data may be temporarily inaccessible",
            "Contact support if the problem persists",
          ],
          retryable: true,
        },
        { status: 503 }, // Return 503 Service Unavailable instead of 500
      )
    }

    if (!response.ok) {
      let errorText = ""
      let errorData: any = null

      try {
        errorText = await response.text()
        console.error("API Error Response:", errorText)

        // Try to parse as JSON error response
        if (errorText) {
          try {
            errorData = JSON.parse(errorText)
          } catch {
            // Not JSON, use as plain text
          }
        }
      } catch (readError) {
        console.error("Error reading response:", readError)
        errorText = "Unable to read error response"
      }

      const errorMessage = errorData?.detail || errorData?.message || errorText || "Unknown API error"

      return NextResponse.json(
        {
          error: "API Error",
          message: `API responded with status ${response.status}: ${errorMessage}`,
          suggestions: [
            "The tender service may be experiencing issues",
            "Please try again later",
            "Contact support if the problem persists",
          ],
          retryable: response.status >= 500,
        },
        { status: response.status >= 500 ? 503 : response.status },
      )
    }

    // Parse the response
    let data
    try {
      data = await response.json()
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError)
      return NextResponse.json(
        {
          error: "Invalid response format",
          message: "The API returned an invalid response format",
          suggestions: ["Please try again", "Contact support if the problem persists"],
          retryable: true,
        },
        { status: 502 }, // Bad Gateway
      )
    }

    // Validate the response structure
    if (!data || typeof data !== "object") {
      console.error("Invalid data structure received:", typeof data)
      return NextResponse.json(
        {
          error: "Invalid data structure",
          message: "The API returned unexpected data",
          suggestions: ["Please try again", "Contact support if the problem persists"],
          retryable: true,
        },
        { status: 502 },
      )
    }

    if (!data.ocid) {
      console.error("Response missing OCID field:", Object.keys(data))
      return NextResponse.json(
        {
          error: "Invalid tender data",
          message: "The tender data is incomplete or corrupted",
          suggestions: ["Please try again", "Contact support if the problem persists"],
          retryable: true,
        },
        { status: 502 },
      )
    }

    console.log("Successfully received tender data for OCID:", data.ocid)
    console.log("Tender title:", data.tender?.title || "No title")

    // The single release endpoint returns the release object directly (no wrapper)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching tender detail:", error)

    // Determine if this is a network/timeout error that might be retryable
    const isNetworkError =
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.name === "TimeoutError" ||
        error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("timeout"))

    return NextResponse.json(
      {
        error: "Failed to fetch tender details",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestions: [
          isNetworkError ? "Check your internet connection" : "The tender service may be unavailable",
          "Please try again in a few moments",
          "Contact support if the problem persists",
        ],
        retryable: isNetworkError,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}
