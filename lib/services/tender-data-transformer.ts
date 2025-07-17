/**
 * Comprehensive Tender Data Transformer
 * 
 * This service transforms OCDS (Open Contracting Data Standard) release data
 * into enhanced tender information with comprehensive details for display.
 * 
 * Implements requirements:
 * - 2.1: Request for Bid details, Department, and bid description
 * - 2.2: Delivery location and place where services are required
 * - 2.3: Opening Date, Closing Date, and Modified Date extraction
 * - 2.4: Contact Person, Email, Tel, and Fax details
 * - 2.5: Briefing Session details and compulsory status
 * - 2.6: Special conditions extraction
 * - 5.2: Data validation and transformation
 */

// Core OCDS interfaces (based on existing tender-detail.tsx)
export interface TenderValue {
  amount: number
  currency: string
}

export interface TenderPeriod {
  startDate: string
  endDate: string
}

export interface Address {
  streetAddress?: string
  locality?: string
  region?: string
  postalCode?: string
  countryName?: string
}

export interface ContactPoint {
  name?: string
  email?: string
  telephone?: string
  faxNumber?: string
  url?: string
}

export interface ProcuringEntity {
  id: string
  name: string
  address?: Address
  contactPoint?: ContactPoint
}

export interface Classification {
  scheme: string
  id: string
  description: string
  uri?: string
}

export interface Document {
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

export interface Tender {
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
  procuringEntity?: ProcuringEntity
  classification?: Classification
  additionalClassifications?: Classification[]
  documents?: Document[]
  eligibilityCriteria?: string
  submissionMethod?: string[]
  submissionMethodDetails?: string
  procurementMethod?: string
  procurementMethodDetails?: string
  awardCriteria?: string
  awardCriteriaDetails?: string
  // Additional fields for comprehensive extraction
  items?: Array<{
    id: string
    description: string
    deliveryLocation?: Address
    deliveryAddress?: Address
  }>
  milestones?: Array<{
    id: string
    title?: string
    description?: string
    type: string
    status?: string
    dueDate?: string
    dateMet?: string
  }>
  lots?: Array<{
    id: string
    title?: string
    description: string
    status: string
    value?: TenderValue
  }>
}

export interface Party {
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

export interface Release {
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

// Enhanced tender information interfaces
export interface RequestForBidInfo {
  department: string
  bidDescription: string
  deliveryLocation: string
  placeOfService: string
  procurementCategory: string
  additionalCategories: string[]
}

export interface KeyDates {
  openingDate?: string
  closingDate: string
  modifiedDate?: string
  enquiryPeriodStart?: string
  enquiryPeriodEnd?: string
  awardPeriodStart?: string
  awardPeriodEnd?: string
  publishedDate: string
}

export interface ContactInformation {
  contactPerson?: string
  email?: string
  telephone?: string
  fax?: string
  organizationName?: string
  address?: Address
  url?: string
}

export interface BriefingSession {
  hasBriefing: boolean
  isCompulsory?: boolean
  date?: string
  venue?: string
  description?: string
  contactInfo?: ContactInformation
}

export interface SpecialConditions {
  eligibilityCriteria?: string
  submissionRequirements?: string[]
  evaluationCriteria?: string
  procurementMethodDetails?: string
  additionalRequirements?: string[]
  documentRequirements?: string[]
}

export interface EnhancedTenderInfo {
  // Core OCDS data
  ocid: string
  id: string
  title: string
  status: string
  publishedDate: string

  // Enhanced fields for comprehensive display
  requestForBid: RequestForBidInfo
  keyDates: KeyDates
  contactInformation: ContactInformation
  briefingSession?: BriefingSession
  specialConditions: SpecialConditions

  // Original tender data for fallback
  originalTender: Tender
  originalRelease: Release

  // Metadata
  dataQuality: {
    completenessScore: number // 0-1 score based on available fields
    extractedFields: string[]
    missingFields: string[]
    validationWarnings: string[]
  }
}

// Validation and transformation result interfaces
export interface TransformationResult {
  success: boolean
  enhancedTender?: EnhancedTenderInfo
  errors: TransformationError[]
  warnings: string[]
  processingTime: number
}

export interface TransformationError {
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
  originalValue?: any
}

/**
 * Comprehensive Tender Data Transformer Service
 */
export class TenderDataTransformer {
  private validationEnabled: boolean
  private strictMode: boolean

  constructor(options: {
    validationEnabled?: boolean
    strictMode?: boolean
  } = {}) {
    this.validationEnabled = options.validationEnabled ?? true
    this.strictMode = options.strictMode ?? false
  }

  /**
   * Transform OCDS Release to Enhanced Tender Information
   */
  async transformOCDSToEnhanced(release: Release): Promise<TransformationResult> {
    const startTime = Date.now()
    const errors: TransformationError[] = []
    const warnings: string[] = []

    try {
      // Validate input
      if (!release || !release.tender) {
        return {
          success: false,
          errors: [{
            field: 'release',
            message: 'Invalid or missing release data',
            severity: 'error'
          }],
          warnings: [],
          processingTime: Date.now() - startTime
        }
      }

      const tender = release.tender

      // Extract Request for Bid information
      const requestForBid = this.extractRequestForBidInfo(tender, release, errors)

      // Extract key dates
      const keyDates = this.extractKeyDates(tender, release, errors)

      // Extract contact information
      const contactInformation = this.extractContactInfo(release.parties || [], tender, errors)

      // Extract briefing session information
      const briefingSession = this.extractBriefingInfo(tender, errors)

      // Extract special conditions
      const specialConditions = this.extractSpecialConditions(tender, errors)

      // Calculate data quality metrics
      const dataQuality = this.calculateDataQuality({
        requestForBid,
        keyDates,
        contactInformation,
        briefingSession,
        specialConditions
      }, errors)

      const enhancedTender: EnhancedTenderInfo = {
        ocid: release.ocid,
        id: release.id,
        title: tender.title,
        status: tender.status,
        publishedDate: release.date,
        requestForBid,
        keyDates,
        contactInformation,
        briefingSession,
        specialConditions,
        originalTender: tender,
        originalRelease: release,
        dataQuality
      }

      return {
        success: true,
        enhancedTender,
        errors,
        warnings,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      errors.push({
        field: 'transformation',
        message: error instanceof Error ? error.message : 'Unknown transformation error',
        severity: 'error'
      })

      return {
        success: false,
        errors,
        warnings,
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Extract Request for Bid information
   * Requirements: 2.1, 2.2
   */
  private extractRequestForBidInfo(
    tender: Tender, 
    release: Release, 
    errors: TransformationError[]
  ): RequestForBidInfo {
    // Extract department from procuring entity
    const department = tender.procuringEntity?.name || 
                      release.buyer?.name || 
                      this.findDepartmentFromParties(release.parties || []) ||
                      'Department not specified'

    // Extract bid description (use tender description as primary source)
    const bidDescription = tender.description || 
                          release.description || 
                          'Bid description not available'

    // Extract delivery location from items or tender details
    const deliveryLocation = this.extractDeliveryLocation(tender, errors)

    // Extract place of service (where services are required)
    const placeOfService = this.extractPlaceOfService(tender, release, errors)

    // Validate required fields
    if (this.validationEnabled) {
      if (!department || department === 'Department not specified') {
        errors.push({
          field: 'requestForBid.department',
          message: 'Department information not found in tender data',
          severity: 'warning'
        })
      }

      if (!bidDescription || bidDescription === 'Bid description not available') {
        errors.push({
          field: 'requestForBid.bidDescription',
          message: 'Bid description not found in tender data',
          severity: 'warning'
        })
      }
    }

    return {
      department,
      bidDescription,
      deliveryLocation,
      placeOfService,
      procurementCategory: tender.mainProcurementCategory,
      additionalCategories: tender.additionalProcurementCategories || []
    }
  }

  /**
   * Find department from parties array
   */
  private findDepartmentFromParties(parties: Party[]): string {
    // Look for parties with 'buyer' or 'procuringEntity' roles
    const buyerParty = parties.find(party => 
      party.roles.includes('buyer') || 
      party.roles.includes('procuringEntity')
    )

    return buyerParty?.name || ''
  }

  /**
   * Extract delivery location information
   */
  private extractDeliveryLocation(tender: Tender, errors: TransformationError[]): string {
    const locations: string[] = []

    // Check items for delivery locations
    if (tender.items) {
      tender.items.forEach(item => {
        if (item.deliveryLocation) {
          const location = this.formatAddress(item.deliveryLocation)
          if (location) locations.push(location)
        }
        if (item.deliveryAddress) {
          const location = this.formatAddress(item.deliveryAddress)
          if (location) locations.push(location)
        }
      })
    }

    // Check procuring entity address as fallback
    if (locations.length === 0 && tender.procuringEntity?.address) {
      const location = this.formatAddress(tender.procuringEntity.address)
      if (location) locations.push(location)
    }

    // Remove duplicates
    const uniqueLocations = [...new Set(locations)]

    if (uniqueLocations.length === 0) {
      if (this.validationEnabled) {
        errors.push({
          field: 'requestForBid.deliveryLocation',
          message: 'Delivery location not specified in tender data',
          severity: 'info'
        })
      }
      return 'Delivery location not specified'
    }

    return uniqueLocations.join('; ')
  }

  /**
   * Extract place of service information
   */
  private extractPlaceOfService(tender: Tender, release: Release, errors: TransformationError[]): string {
    // Look for service location in various places
    const serviceLocations: string[] = []

    // Check tender description for location keywords
    const locationKeywords = ['location', 'venue', 'site', 'address', 'place', 'where']
    const description = tender.description?.toLowerCase() || ''
    
    locationKeywords.forEach(keyword => {
      const regex = new RegExp(`${keyword}[:\\s]+([^.\\n]+)`, 'i')
      const match = description.match(regex)
      if (match && match[1]) {
        serviceLocations.push(match[1].trim())
      }
    })

    // Check items for service locations
    if (tender.items) {
      tender.items.forEach(item => {
        if (item.description.toLowerCase().includes('location') || 
            item.description.toLowerCase().includes('site')) {
          serviceLocations.push(item.description)
        }
      })
    }

    // Use procuring entity address as fallback
    if (serviceLocations.length === 0 && tender.procuringEntity?.address) {
      const address = this.formatAddress(tender.procuringEntity.address)
      if (address) serviceLocations.push(address)
    }

    if (serviceLocations.length === 0) {
      if (this.validationEnabled) {
        errors.push({
          field: 'requestForBid.placeOfService',
          message: 'Place of service not specified in tender data',
          severity: 'info'
        })
      }
      return 'Place of service not specified'
    }

    // Remove duplicates and return
    const uniqueLocations = [...new Set(serviceLocations)]
    return uniqueLocations.join('; ')
  }

  /**
   * Format address object to string
   */
  private formatAddress(address: Address): string {
    const parts: string[] = []

    if (address.streetAddress) parts.push(address.streetAddress)
    if (address.locality) parts.push(address.locality)
    if (address.region) parts.push(address.region)
    if (address.postalCode) parts.push(address.postalCode)
    if (address.countryName) parts.push(address.countryName)

    return parts.filter(Boolean).join(', ')
  }

  /**
   * Calculate data quality metrics
   */
  private calculateDataQuality(
    data: {
      requestForBid: RequestForBidInfo
      keyDates: KeyDates
      contactInformation: ContactInformation
      briefingSession?: BriefingSession
      specialConditions: SpecialConditions
    },
    errors: TransformationError[]
  ): EnhancedTenderInfo['dataQuality'] {
    const extractedFields: string[] = []
    const missingFields: string[] = []

    // Check Request for Bid completeness
    if (data.requestForBid.department !== 'Department not specified') {
      extractedFields.push('department')
    } else {
      missingFields.push('department')
    }

    if (data.requestForBid.bidDescription !== 'Bid description not available') {
      extractedFields.push('bidDescription')
    } else {
      missingFields.push('bidDescription')
    }

    if (data.requestForBid.deliveryLocation !== 'Delivery location not specified') {
      extractedFields.push('deliveryLocation')
    } else {
      missingFields.push('deliveryLocation')
    }

    if (data.requestForBid.placeOfService !== 'Place of service not specified') {
      extractedFields.push('placeOfService')
    } else {
      missingFields.push('placeOfService')
    }

    // Check key dates completeness
    if (data.keyDates.openingDate) extractedFields.push('openingDate')
    else missingFields.push('openingDate')

    if (data.keyDates.closingDate) extractedFields.push('closingDate')
    else missingFields.push('closingDate')

    if (data.keyDates.modifiedDate) extractedFields.push('modifiedDate')
    else missingFields.push('modifiedDate')

    // Check contact information completeness
    if (data.contactInformation.contactPerson) extractedFields.push('contactPerson')
    else missingFields.push('contactPerson')

    if (data.contactInformation.email) extractedFields.push('email')
    else missingFields.push('email')

    if (data.contactInformation.telephone) extractedFields.push('telephone')
    else missingFields.push('telephone')

    if (data.contactInformation.fax) extractedFields.push('fax')
    else missingFields.push('fax')

    // Check briefing session
    if (data.briefingSession?.hasBriefing) {
      extractedFields.push('briefingSession')
      if (data.briefingSession.date) extractedFields.push('briefingDate')
      if (data.briefingSession.venue) extractedFields.push('briefingVenue')
    } else {
      missingFields.push('briefingSession')
    }

    // Check special conditions
    if (data.specialConditions.eligibilityCriteria) extractedFields.push('eligibilityCriteria')
    else missingFields.push('eligibilityCriteria')

    // Calculate completeness score
    const totalPossibleFields = extractedFields.length + missingFields.length
    const completenessScore = totalPossibleFields > 0 ? extractedFields.length / totalPossibleFields : 0

    // Extract validation warnings
    const validationWarnings = errors
      .filter(error => error.severity === 'warning')
      .map(error => error.message)

    return {
      completenessScore,
      extractedFields,
      missingFields,
      validationWarnings
    }
  }

  /**
   * Extract key dates information
   * Requirements: 2.3
   */
  private extractKeyDates(
    tender: Tender, 
    release: Release, 
    errors: TransformationError[]
  ): KeyDates {
    const keyDates: KeyDates = {
      closingDate: '', // Required field
      publishedDate: release.date
    }

    // Extract opening date (tender period start)
    if (tender.tenderPeriod?.startDate) {
      keyDates.openingDate = tender.tenderPeriod.startDate
    }

    // Extract closing date (tender period end) - this is required
    if (tender.tenderPeriod?.endDate) {
      keyDates.closingDate = tender.tenderPeriod.endDate
    } else {
      // Try to find closing date in other places
      if (tender.enquiryPeriod?.endDate) {
        keyDates.closingDate = tender.enquiryPeriod.endDate
      } else {
        errors.push({
          field: 'keyDates.closingDate',
          message: 'Closing date not found in tender data',
          severity: 'error'
        })
        keyDates.closingDate = 'Not specified'
      }
    }

    // Extract modified date (look for latest modification)
    const modificationDates: string[] = []
    
    // Check release date as potential modification date
    if (release.date) modificationDates.push(release.date)
    
    // Check document modification dates
    if (tender.documents) {
      tender.documents.forEach(doc => {
        if (doc.dateModified) modificationDates.push(doc.dateModified)
      })
    }

    // Use the latest date as modified date
    if (modificationDates.length > 0) {
      const sortedDates = modificationDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      keyDates.modifiedDate = sortedDates[0]
    }

    // Extract enquiry period dates
    if (tender.enquiryPeriod) {
      keyDates.enquiryPeriodStart = tender.enquiryPeriod.startDate
      keyDates.enquiryPeriodEnd = tender.enquiryPeriod.endDate
    }

    // Extract award period dates
    if (tender.awardPeriod) {
      keyDates.awardPeriodStart = tender.awardPeriod.startDate
      keyDates.awardPeriodEnd = tender.awardPeriod.endDate
    }

    // Validate date formats
    if (this.validationEnabled) {
      this.validateDateFormat(keyDates.openingDate, 'openingDate', errors)
      this.validateDateFormat(keyDates.closingDate, 'closingDate', errors)
      this.validateDateFormat(keyDates.modifiedDate, 'modifiedDate', errors)
    }

    return keyDates
  }

  /**
   * Validate date format
   */
  private validateDateFormat(dateString: string | undefined, fieldName: string, errors: TransformationError[]): void {
    if (!dateString || dateString === 'Not specified') return

    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        errors.push({
          field: `keyDates.${fieldName}`,
          message: `Invalid date format: ${dateString}`,
          severity: 'warning',
          originalValue: dateString
        })
      }
    } catch (error) {
      errors.push({
        field: `keyDates.${fieldName}`,
        message: `Date parsing error: ${dateString}`,
        severity: 'warning',
        originalValue: dateString
      })
    }
  }

  /**
   * Extract contact information from parties and tender data
   * Requirements: 2.4
   */
  extractContactInfo(
    parties: Party[], 
    tender: Tender, 
    errors: TransformationError[]
  ): ContactInformation {
    const contactInfo: ContactInformation = {}

    // Priority order for finding contact information:
    // 1. Procuring entity contact point
    // 2. Buyer party contact point
    // 3. Any party with buyer/procuringEntity role
    // 4. First party with contact information

    let primaryContact: ContactPoint | undefined
    let primaryParty: Party | undefined

    // Check procuring entity first
    if (tender.procuringEntity?.contactPoint) {
      primaryContact = tender.procuringEntity.contactPoint
      primaryParty = {
        id: tender.procuringEntity.id,
        name: tender.procuringEntity.name,
        address: tender.procuringEntity.address,
        contactPoint: tender.procuringEntity.contactPoint,
        roles: ['procuringEntity']
      }
    }

    // Check parties for buyer or procuring entity
    if (!primaryContact && parties.length > 0) {
      const buyerParty = parties.find(party => 
        party.roles.includes('buyer') || party.roles.includes('procuringEntity')
      )

      if (buyerParty?.contactPoint) {
        primaryContact = buyerParty.contactPoint
        primaryParty = buyerParty
      }
    }

    // Fallback to any party with contact information
    if (!primaryContact && parties.length > 0) {
      const partyWithContact = parties.find(party => party.contactPoint)
      if (partyWithContact?.contactPoint) {
        primaryContact = partyWithContact.contactPoint
        primaryParty = partyWithContact
      }
    }

    // Extract contact information
    if (primaryContact) {
      contactInfo.contactPerson = primaryContact.name
      contactInfo.email = primaryContact.email
      contactInfo.telephone = primaryContact.telephone
      contactInfo.fax = primaryContact.faxNumber
      contactInfo.url = primaryContact.url
    }

    // Extract organization information
    if (primaryParty) {
      contactInfo.organizationName = primaryParty.name
      contactInfo.address = primaryParty.address
    }

    // Validate contact information
    if (this.validationEnabled) {
      if (!contactInfo.contactPerson && !contactInfo.organizationName) {
        errors.push({
          field: 'contactInformation.contactPerson',
          message: 'No contact person or organization name found',
          severity: 'warning'
        })
      }

      if (!contactInfo.email && !contactInfo.telephone) {
        errors.push({
          field: 'contactInformation',
          message: 'No email or telephone contact information found',
          severity: 'warning'
        })
      }

      // Validate email format
      if (contactInfo.email && !this.isValidEmail(contactInfo.email)) {
        errors.push({
          field: 'contactInformation.email',
          message: `Invalid email format: ${contactInfo.email}`,
          severity: 'warning',
          originalValue: contactInfo.email
        })
      }

      // Validate phone format (basic validation)
      if (contactInfo.telephone && !this.isValidPhone(contactInfo.telephone)) {
        errors.push({
          field: 'contactInformation.telephone',
          message: `Potentially invalid phone format: ${contactInfo.telephone}`,
          severity: 'info',
          originalValue: contactInfo.telephone
        })
      }
    }

    return contactInfo
  }

  /**
   * Extract briefing session information
   * Requirements: 2.5, 2.6
   */
  extractBriefingInfo(tender: Tender, errors: TransformationError[]): BriefingSession | undefined {
    // Look for briefing information in various places
    let hasBriefing = false
    let isCompulsory: boolean | undefined
    let briefingDate: string | undefined
    let briefingVenue: string | undefined
    let briefingDescription: string | undefined
    let briefingContact: ContactInformation | undefined

    // Check tender description for briefing keywords
    const description = tender.description?.toLowerCase() || ''
    const briefingKeywords = [
      'briefing', 'meeting', 'site visit', 'pre-bid', 'pre-tender',
      'information session', 'clarification meeting'
    ]

    const compulsoryKeywords = [
      'compulsory', 'mandatory', 'required', 'must attend'
    ]

    // Check if briefing is mentioned
    hasBriefing = briefingKeywords.some(keyword => description.includes(keyword))

    if (hasBriefing) {
      // Check if briefing is compulsory
      isCompulsory = compulsoryKeywords.some(keyword => description.includes(keyword))

      // Try to extract briefing date
      briefingDate = this.extractDateFromText(tender.description || '')

      // Try to extract venue information
      briefingVenue = this.extractVenueFromText(tender.description || '')

      // Use description as briefing description if it contains briefing info
      if (description.includes('briefing')) {
        briefingDescription = tender.description
      }
    }

    // Check milestones for briefing information
    if (tender.milestones) {
      const briefingMilestone = tender.milestones.find(milestone =>
        milestone.type.toLowerCase().includes('briefing') ||
        milestone.title?.toLowerCase().includes('briefing') ||
        milestone.description?.toLowerCase().includes('briefing')
      )

      if (briefingMilestone) {
        hasBriefing = true
        if (briefingMilestone.dueDate) {
          briefingDate = briefingMilestone.dueDate
        }
        if (briefingMilestone.description) {
          briefingDescription = briefingMilestone.description
          briefingVenue = this.extractVenueFromText(briefingMilestone.description)
        }
      }
    }

    // Check documents for briefing information
    if (tender.documents) {
      const briefingDoc = tender.documents.find(doc =>
        doc.title.toLowerCase().includes('briefing') ||
        doc.description?.toLowerCase().includes('briefing') ||
        doc.documentType.toLowerCase().includes('briefing')
      )

      if (briefingDoc) {
        hasBriefing = true
        if (briefingDoc.description) {
          briefingDescription = briefingDoc.description
          briefingVenue = this.extractVenueFromText(briefingDoc.description)
        }
      }
    }

    // If no briefing found, return undefined
    if (!hasBriefing) {
      return undefined
    }

    // Validate briefing information
    if (this.validationEnabled) {
      if (hasBriefing && !briefingDate) {
        errors.push({
          field: 'briefingSession.date',
          message: 'Briefing session mentioned but date not found',
          severity: 'warning'
        })
      }

      if (hasBriefing && !briefingVenue) {
        errors.push({
          field: 'briefingSession.venue',
          message: 'Briefing session mentioned but venue not found',
          severity: 'info'
        })
      }
    }

    return {
      hasBriefing,
      isCompulsory,
      date: briefingDate,
      venue: briefingVenue,
      description: briefingDescription,
      contactInfo: briefingContact
    }
  }

  /**
   * Extract special conditions and requirements
   * Requirements: 2.6, 5.2
   */
  extractSpecialConditions(tender: Tender, errors: TransformationError[]): SpecialConditions {
    const specialConditions: SpecialConditions = {}

    // Extract eligibility criteria
    if (tender.eligibilityCriteria) {
      specialConditions.eligibilityCriteria = tender.eligibilityCriteria
    }

    // Extract submission requirements
    const submissionRequirements: string[] = []
    
    if (tender.submissionMethod) {
      submissionRequirements.push(`Submission methods: ${tender.submissionMethod.join(', ')}`)
    }

    if (tender.submissionMethodDetails) {
      submissionRequirements.push(tender.submissionMethodDetails)
    }

    if (submissionRequirements.length > 0) {
      specialConditions.submissionRequirements = submissionRequirements
    }

    // Extract evaluation criteria
    if (tender.awardCriteria) {
      let evaluationCriteria = `Award criteria: ${tender.awardCriteria}`
      if (tender.awardCriteriaDetails) {
        evaluationCriteria += `\n${tender.awardCriteriaDetails}`
      }
      specialConditions.evaluationCriteria = evaluationCriteria
    }

    // Extract procurement method details
    if (tender.procurementMethodDetails) {
      specialConditions.procurementMethodDetails = tender.procurementMethodDetails
    }

    // Extract additional requirements from description
    const additionalRequirements = this.extractRequirementsFromText(tender.description || '')
    if (additionalRequirements.length > 0) {
      specialConditions.additionalRequirements = additionalRequirements
    }

    // Extract document requirements
    const documentRequirements: string[] = []
    
    if (tender.documents) {
      tender.documents.forEach(doc => {
        if (doc.documentType.toLowerCase().includes('requirement') ||
            doc.title.toLowerCase().includes('requirement') ||
            doc.documentType.toLowerCase().includes('specification')) {
          documentRequirements.push(`${doc.title} (${doc.documentType})`)
        }
      })
    }

    if (documentRequirements.length > 0) {
      specialConditions.documentRequirements = documentRequirements
    }

    // Validate special conditions
    if (this.validationEnabled) {
      const hasAnyConditions = Object.values(specialConditions).some(value => 
        value !== undefined && 
        (typeof value === 'string' ? value.length > 0 : value.length > 0)
      )

      if (!hasAnyConditions) {
        errors.push({
          field: 'specialConditions',
          message: 'No special conditions or requirements found',
          severity: 'info'
        })
      }
    }

    return specialConditions
  }

  // Utility methods for text extraction

  /**
   * Extract date from text using common date patterns
   */
  private extractDateFromText(text: string): string | undefined {
    const datePatterns = [
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/g, // DD/MM/YYYY or DD-MM-YYYY
      /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g, // YYYY/MM/DD or YYYY-MM-DD
      /\b(\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi,
      /\b((January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi
    ]

    for (const pattern of datePatterns) {
      const matches = text.match(pattern)
      if (matches && matches.length > 0) {
        return matches[0]
      }
    }

    return undefined
  }

  /**
   * Extract venue information from text
   */
  private extractVenueFromText(text: string): string | undefined {
    const venueKeywords = ['venue', 'location', 'address', 'at', 'held at', 'meeting at']
    const lines = text.split('\n')

    for (const line of lines) {
      const lowerLine = line.toLowerCase()
      for (const keyword of venueKeywords) {
        if (lowerLine.includes(keyword)) {
          // Extract text after the keyword
          const keywordIndex = lowerLine.indexOf(keyword)
          const afterKeyword = line.substring(keywordIndex + keyword.length).trim()
          if (afterKeyword.length > 0) {
            // Remove common prefixes
            const cleanVenue = afterKeyword.replace(/^[:;,\s]+/, '').trim()
            if (cleanVenue.length > 0) {
              return cleanVenue
            }
          }
        }
      }
    }

    return undefined
  }

  /**
   * Extract requirements from text
   */
  private extractRequirementsFromText(text: string): string[] {
    const requirements: string[] = []
    const requirementKeywords = [
      'must', 'required', 'shall', 'should', 'mandatory', 'compulsory',
      'need to', 'have to', 'ensure', 'provide', 'submit'
    ]

    const sentences = text.split(/[.!?]+/)
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase()
      if (requirementKeywords.some(keyword => lowerSentence.includes(keyword))) {
        const cleanSentence = sentence.trim()
        if (cleanSentence.length > 10) { // Avoid very short sentences
          requirements.push(cleanSentence)
        }
      }
    }

    return requirements
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Validate phone format (basic validation)
   */
  private isValidPhone(phone: string): boolean {
    // Basic phone validation - contains digits and common phone characters
    const phoneRegex = /^[\d\s\-\+\(\)]+$/
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7
  }

  /**
   * Batch transform multiple releases
   */
  async transformBatch(releases: Release[]): Promise<{
    successful: EnhancedTenderInfo[]
    failed: Array<{ release: Release; errors: TransformationError[] }>
    summary: {
      total: number
      successful: number
      failed: number
      averageProcessingTime: number
      averageDataQuality: number
    }
  }> {
    const successful: EnhancedTenderInfo[] = []
    const failed: Array<{ release: Release; errors: TransformationError[] }> = []
    const processingTimes: number[] = []
    const qualityScores: number[] = []

    for (const release of releases) {
      try {
        const result = await this.transformOCDSToEnhanced(release)
        processingTimes.push(result.processingTime)

        if (result.success && result.enhancedTender) {
          successful.push(result.enhancedTender)
          qualityScores.push(result.enhancedTender.dataQuality.completenessScore)
        } else {
          failed.push({ release, errors: result.errors })
        }
      } catch (error) {
        failed.push({
          release,
          errors: [{
            field: 'transformation',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error'
          }]
        })
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: releases.length,
        successful: successful.length,
        failed: failed.length,
        averageProcessingTime: processingTimes.length > 0 
          ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
          : 0,
        averageDataQuality: qualityScores.length > 0
          ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
          : 0
      }
    }
  }
}

// Export utility functions for external use
export const TenderDataTransformerUtils = {
  formatAddress: (address: Address): string => {
    const parts: string[] = []
    if (address.streetAddress) parts.push(address.streetAddress)
    if (address.locality) parts.push(address.locality)
    if (address.region) parts.push(address.region)
    if (address.postalCode) parts.push(address.postalCode)
    if (address.countryName) parts.push(address.countryName)
    return parts.filter(Boolean).join(', ')
  },

  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7
  }
}