/**
 * Enhanced Date and Contact Information Extractor
 * 
 * Specialized service for extracting and formatting date and contact information
 * from OCDS tender data with comprehensive validation and multiple fallback strategies.
 * 
 * Requirements:
 * - 2.3: Extract and format Opening Date, Closing Date, and Modified Date
 * - 2.4: Extract Contact Person, Email, Tel, and Fax details
 * - 5.2: Data validation and transformation
 */

import { 
  Tender, 
  Release, 
  Party, 
  ContactPoint, 
  Document,
  KeyDates,
  ContactInformation,
  TransformationError 
} from './tender-data-transformer'

export interface DateExtractionResult {
  dates: KeyDates
  confidence: number // 0-1 score indicating confidence in extracted dates
  sources: DateSource[]
  warnings: string[]
}

export interface ContactExtractionResult {
  contact: ContactInformation
  confidence: number // 0-1 score indicating confidence in extracted contact info
  sources: ContactSource[]
  warnings: string[]
}

export interface DateSource {
  field: keyof KeyDates
  value: string
  source: 'tenderPeriod' | 'enquiryPeriod' | 'awardPeriod' | 'documents' | 'milestones' | 'release'
  confidence: number
}

export interface ContactSource {
  field: keyof ContactInformation
  value: string
  source: 'procuringEntity' | 'buyer' | 'parties' | 'documents' | 'tender'
  confidence: number
}

export interface DateValidationOptions {
  allowPastDates?: boolean
  allowFutureDates?: boolean
  maxYearsInFuture?: number
  requireClosingDate?: boolean
  validateDateSequence?: boolean
}

export interface ContactValidationOptions {
  requireEmail?: boolean
  requirePhone?: boolean
  validateEmailFormat?: boolean
  validatePhoneFormat?: boolean
  allowInternationalPhone?: boolean
}

/**
 * Enhanced Date and Contact Information Extractor Service
 */
export class EnhancedDateContactExtractor {
  private dateValidationOptions: DateValidationOptions
  private contactValidationOptions: ContactValidationOptions

  constructor(
    dateOptions: DateValidationOptions = {},
    contactOptions: ContactValidationOptions = {}
  ) {
    this.dateValidationOptions = {
      allowPastDates: true,
      allowFutureDates: true,
      maxYearsInFuture: 5,
      requireClosingDate: true,
      validateDateSequence: true,
      ...dateOptions
    }

    this.contactValidationOptions = {
      requireEmail: false,
      requirePhone: false,
      validateEmailFormat: true,
      validatePhoneFormat: true,
      allowInternationalPhone: true,
      ...contactOptions
    }
  }

  /**
   * Extract and format all date information with multiple fallback strategies
   * Requirements: 2.3
   */
  extractDates(tender: Tender, release: Release): DateExtractionResult {
    const sources: DateSource[] = []
    const warnings: string[] = []
    const dates: KeyDates = {
      closingDate: '',
      publishedDate: release.date
    }

    // Extract Opening Date with multiple strategies
    const openingDateSources = this.extractOpeningDate(tender, release)
    if (openingDateSources.length > 0) {
      const bestOpeningDate = this.selectBestDateSource(openingDateSources)
      dates.openingDate = bestOpeningDate.value
      sources.push(bestOpeningDate)
    }

    // Extract Closing Date with multiple strategies (required)
    const closingDateSources = this.extractClosingDate(tender, release)
    if (closingDateSources.length > 0) {
      const bestClosingDate = this.selectBestDateSource(closingDateSources)
      dates.closingDate = bestClosingDate.value
      sources.push(bestClosingDate)
    } else {
      warnings.push('Closing date not found - this is required information')
      dates.closingDate = 'Not specified'
    }

    // Extract Modified Date with comprehensive search
    const modifiedDateSources = this.extractModifiedDate(tender, release)
    if (modifiedDateSources.length > 0) {
      const bestModifiedDate = this.selectBestDateSource(modifiedDateSources)
      dates.modifiedDate = bestModifiedDate.value
      sources.push(bestModifiedDate)
    }

    // Extract additional period dates
    const additionalDates = this.extractAdditionalDates(tender)
    sources.push(...additionalDates)

    // Assign additional dates
    const enquiryStartSource = additionalDates.find(s => s.field === 'enquiryPeriodStart')
    const enquiryEndSource = additionalDates.find(s => s.field === 'enquiryPeriodEnd')
    const awardStartSource = additionalDates.find(s => s.field === 'awardPeriodStart')
    const awardEndSource = additionalDates.find(s => s.field === 'awardPeriodEnd')

    if (enquiryStartSource) dates.enquiryPeriodStart = enquiryStartSource.value
    if (enquiryEndSource) dates.enquiryPeriodEnd = enquiryEndSource.value
    if (awardStartSource) dates.awardPeriodStart = awardStartSource.value
    if (awardEndSource) dates.awardPeriodEnd = awardEndSource.value

    // Validate dates
    const validationWarnings = this.validateDates(dates)
    warnings.push(...validationWarnings)

    // Calculate confidence score
    const confidence = this.calculateDateConfidence(sources, warnings)

    return {
      dates,
      confidence,
      sources,
      warnings
    }
  }

  /**
   * Extract opening date from multiple sources
   */
  private extractOpeningDate(tender: Tender, release: Release): DateSource[] {
    const sources: DateSource[] = []

    // Strategy 1: Tender period start date
    if (tender.tenderPeriod?.startDate) {
      sources.push({
        field: 'openingDate',
        value: tender.tenderPeriod.startDate,
        source: 'tenderPeriod',
        confidence: 0.9
      })
    }

    // Strategy 2: Enquiry period start date (if no tender period)
    if (tender.enquiryPeriod?.startDate && !tender.tenderPeriod?.startDate) {
      sources.push({
        field: 'openingDate',
        value: tender.enquiryPeriod.startDate,
        source: 'enquiryPeriod',
        confidence: 0.7
      })
    }

    // Strategy 3: Release date as fallback
    if (sources.length === 0) {
      sources.push({
        field: 'openingDate',
        value: release.date,
        source: 'release',
        confidence: 0.5
      })
    }

    // Strategy 4: Extract from milestones
    if (tender.milestones) {
      const openingMilestone = tender.milestones.find(m => 
        m.type.toLowerCase().includes('opening') ||
        m.title?.toLowerCase().includes('opening') ||
        m.description?.toLowerCase().includes('opening')
      )

      if (openingMilestone?.dueDate) {
        sources.push({
          field: 'openingDate',
          value: openingMilestone.dueDate,
          source: 'milestones',
          confidence: 0.8
        })
      }
    }

    return sources
  }

  /**
   * Extract closing date from multiple sources
   */
  private extractClosingDate(tender: Tender, release: Release): DateSource[] {
    const sources: DateSource[] = []

    // Strategy 1: Tender period end date (highest priority)
    if (tender.tenderPeriod?.endDate) {
      sources.push({
        field: 'closingDate',
        value: tender.tenderPeriod.endDate,
        source: 'tenderPeriod',
        confidence: 0.95
      })
    }

    // Strategy 2: Enquiry period end date
    if (tender.enquiryPeriod?.endDate) {
      sources.push({
        field: 'closingDate',
        value: tender.enquiryPeriod.endDate,
        source: 'enquiryPeriod',
        confidence: 0.8
      })
    }

    // Strategy 3: Extract from milestones
    if (tender.milestones) {
      const closingMilestone = tender.milestones.find(m => 
        m.type.toLowerCase().includes('closing') ||
        m.type.toLowerCase().includes('deadline') ||
        m.title?.toLowerCase().includes('closing') ||
        m.title?.toLowerCase().includes('deadline') ||
        m.description?.toLowerCase().includes('closing')
      )

      if (closingMilestone?.dueDate) {
        sources.push({
          field: 'closingDate',
          value: closingMilestone.dueDate,
          source: 'milestones',
          confidence: 0.85
        })
      }
    }

    // Strategy 4: Extract from documents (tender notices, etc.)
    if (tender.documents) {
      for (const doc of tender.documents) {
        if (doc.title.toLowerCase().includes('closing') ||
            doc.description?.toLowerCase().includes('closing') ||
            doc.title.toLowerCase().includes('deadline')) {
          
          // Try to extract date from document title or description
          const extractedDate = this.extractDateFromText(doc.title + ' ' + (doc.description || ''))
          if (extractedDate) {
            sources.push({
              field: 'closingDate',
              value: extractedDate,
              source: 'documents',
              confidence: 0.6
            })
          }
        }
      }
    }

    return sources
  }

  /**
   * Extract modified date from multiple sources
   */
  private extractModifiedDate(tender: Tender, release: Release): DateSource[] {
    const sources: DateSource[] = []

    // Strategy 1: Latest document modification date
    if (tender.documents) {
      const modifiedDates = tender.documents
        .filter(doc => doc.dateModified)
        .map(doc => ({
          date: doc.dateModified!,
          confidence: 0.8
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      if (modifiedDates.length > 0) {
        sources.push({
          field: 'modifiedDate',
          value: modifiedDates[0].date,
          source: 'documents',
          confidence: modifiedDates[0].confidence
        })
      }
    }

    // Strategy 2: Release date
    sources.push({
      field: 'modifiedDate',
      value: release.date,
      source: 'release',
      confidence: 0.6
    })

    // Strategy 3: Latest milestone date
    if (tender.milestones) {
      const milestoneDates = tender.milestones
        .filter(m => m.dateMet || m.dueDate)
        .map(m => ({
          date: m.dateMet || m.dueDate!,
          confidence: 0.5
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      if (milestoneDates.length > 0) {
        sources.push({
          field: 'modifiedDate',
          value: milestoneDates[0].date,
          source: 'milestones',
          confidence: milestoneDates[0].confidence
        })
      }
    }

    return sources
  }

  /**
   * Extract additional period dates
   */
  private extractAdditionalDates(tender: Tender): DateSource[] {
    const sources: DateSource[] = []

    // Enquiry period dates
    if (tender.enquiryPeriod) {
      if (tender.enquiryPeriod.startDate) {
        sources.push({
          field: 'enquiryPeriodStart',
          value: tender.enquiryPeriod.startDate,
          source: 'enquiryPeriod',
          confidence: 0.9
        })
      }
      if (tender.enquiryPeriod.endDate) {
        sources.push({
          field: 'enquiryPeriodEnd',
          value: tender.enquiryPeriod.endDate,
          source: 'enquiryPeriod',
          confidence: 0.9
        })
      }
    }

    // Award period dates
    if (tender.awardPeriod) {
      if (tender.awardPeriod.startDate) {
        sources.push({
          field: 'awardPeriodStart',
          value: tender.awardPeriod.startDate,
          source: 'awardPeriod',
          confidence: 0.9
        })
      }
      if (tender.awardPeriod.endDate) {
        sources.push({
          field: 'awardPeriodEnd',
          value: tender.awardPeriod.endDate,
          source: 'awardPeriod',
          confidence: 0.9
        })
      }
    }

    return sources
  }

  /**
   * Extract comprehensive contact information with multiple fallback strategies
   * Requirements: 2.4
   */
  extractContactInfo(parties: Party[], tender: Tender): ContactExtractionResult {
    const sources: ContactSource[] = []
    const warnings: string[] = []
    const contact: ContactInformation = {}

    // Strategy 1: Procuring entity contact (highest priority)
    if (tender.procuringEntity?.contactPoint) {
      const procuringContact = this.extractContactFromContactPoint(
        tender.procuringEntity.contactPoint,
        'procuringEntity'
      )
      sources.push(...procuringContact)
    }

    // Strategy 2: Buyer party contact
    const buyerParty = parties.find(p => p.roles.includes('buyer'))
    if (buyerParty?.contactPoint) {
      const buyerContact = this.extractContactFromContactPoint(
        buyerParty.contactPoint,
        'buyer'
      )
      sources.push(...buyerContact)
    }

    // Strategy 3: Procuring entity party contact
    const procuringParty = parties.find(p => p.roles.includes('procuringEntity'))
    if (procuringParty?.contactPoint && procuringParty !== buyerParty) {
      const procuringContact = this.extractContactFromContactPoint(
        procuringParty.contactPoint,
        'parties'
      )
      sources.push(...procuringContact)
    }

    // Strategy 4: Any party with contact information
    const otherPartiesWithContact = parties.filter(p => 
      p.contactPoint && 
      !p.roles.includes('buyer') && 
      !p.roles.includes('procuringEntity')
    )

    for (const party of otherPartiesWithContact) {
      const partyContact = this.extractContactFromContactPoint(
        party.contactPoint!,
        'parties'
      )
      sources.push(...partyContact)
    }

    // Strategy 5: Extract from documents
    if (tender.documents) {
      const contactFromDocs = this.extractContactFromDocuments(tender.documents)
      sources.push(...contactFromDocs)
    }

    // Select best sources for each contact field
    contact.contactPerson = this.selectBestContactValue(sources, 'contactPerson')
    contact.email = this.selectBestContactValue(sources, 'email')
    contact.telephone = this.selectBestContactValue(sources, 'telephone')
    contact.fax = this.selectBestContactValue(sources, 'fax')
    contact.url = this.selectBestContactValue(sources, 'url')

    // Set organization name
    if (tender.procuringEntity?.name) {
      contact.organizationName = tender.procuringEntity.name
    } else if (buyerParty?.name) {
      contact.organizationName = buyerParty.name
    } else if (procuringParty?.name) {
      contact.organizationName = procuringParty.name
    }

    // Set address
    if (tender.procuringEntity?.address) {
      contact.address = tender.procuringEntity.address
    } else if (buyerParty?.address) {
      contact.address = buyerParty.address
    } else if (procuringParty?.address) {
      contact.address = procuringParty.address
    }

    // Validate contact information
    const validationWarnings = this.validateContactInfo(contact)
    warnings.push(...validationWarnings)

    // Calculate confidence score
    const confidence = this.calculateContactConfidence(sources, warnings)

    return {
      contact,
      confidence,
      sources,
      warnings
    }
  }

  /**
   * Extract contact information from a ContactPoint
   */
  private extractContactFromContactPoint(
    contactPoint: ContactPoint, 
    source: ContactSource['source']
  ): ContactSource[] {
    const sources: ContactSource[] = []

    if (contactPoint.name) {
      sources.push({
        field: 'contactPerson',
        value: contactPoint.name,
        source,
        confidence: 0.9
      })
    }

    if (contactPoint.email) {
      sources.push({
        field: 'email',
        value: contactPoint.email,
        source,
        confidence: 0.9
      })
    }

    if (contactPoint.telephone) {
      sources.push({
        field: 'telephone',
        value: contactPoint.telephone,
        source,
        confidence: 0.9
      })
    }

    if (contactPoint.faxNumber) {
      sources.push({
        field: 'fax',
        value: contactPoint.faxNumber,
        source,
        confidence: 0.9
      })
    }

    if (contactPoint.url) {
      sources.push({
        field: 'url',
        value: contactPoint.url,
        source,
        confidence: 0.8
      })
    }

    return sources
  }

  /**
   * Extract contact information from documents
   */
  private extractContactFromDocuments(documents: Document[]): ContactSource[] {
    const sources: ContactSource[] = []

    for (const doc of documents) {
      const text = (doc.title + ' ' + (doc.description || '')).toLowerCase()

      // Extract email addresses
      const emailMatches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g)
      if (emailMatches) {
        emailMatches.forEach(email => {
          sources.push({
            field: 'email',
            value: email,
            source: 'documents',
            confidence: 0.7
          })
        })
      }

      // Extract phone numbers
      const phoneMatches = text.match(/\b(?:\+?27|0)(?:\d{2})\s?\d{3}\s?\d{4}\b/g) || // South African format
                          text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || // General format
                          text.match(/\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/g) // US format

      if (phoneMatches) {
        phoneMatches.forEach(phone => {
          sources.push({
            field: 'telephone',
            value: phone,
            source: 'documents',
            confidence: 0.6
          })
        })
      }

      // Extract fax numbers (look for "fax" keyword)
      if (text.includes('fax')) {
        const faxMatches = text.match(/fax[:\s]*(\+?[\d\s\-\(\)]+)/gi)
        if (faxMatches) {
          faxMatches.forEach(match => {
            const faxNumber = match.replace(/fax[:\s]*/gi, '').trim()
            sources.push({
              field: 'fax',
              value: faxNumber,
              source: 'documents',
              confidence: 0.6
            })
          })
        }
      }
    }

    return sources
  }

  // Utility methods

  /**
   * Select the best date source based on confidence
   */
  private selectBestDateSource(sources: DateSource[]): DateSource {
    return sources.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )
  }

  /**
   * Select the best contact value based on confidence
   */
  private selectBestContactValue(
    sources: ContactSource[], 
    field: keyof ContactInformation
  ): string | undefined {
    const fieldSources = sources.filter(s => s.field === field)
    if (fieldSources.length === 0) return undefined

    const bestSource = fieldSources.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )

    return bestSource.value
  }

  /**
   * Extract date from text using various patterns
   */
  private extractDateFromText(text: string): string | undefined {
    const datePatterns = [
      /\b(\d{4}-\d{2}-\d{2})\b/g, // ISO format YYYY-MM-DD
      /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g, // MM/DD/YYYY or DD/MM/YYYY
      /\b(\d{1,2}-\d{1,2}-\d{4})\b/g, // MM-DD-YYYY or DD-MM-YYYY
      /\b(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/gi,
      /\b((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi
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
   * Validate dates according to options
   */
  private validateDates(dates: KeyDates): string[] {
    const warnings: string[] = []
    const now = new Date()

    // Validate date formats
    Object.entries(dates).forEach(([key, value]) => {
      if (value && value !== 'Not specified') {
        try {
          const date = new Date(value)
          if (isNaN(date.getTime())) {
            warnings.push(`Invalid date format for ${key}: ${value}`)
          }
        } catch (error) {
          warnings.push(`Date parsing error for ${key}: ${value}`)
        }
      }
    })

    // Validate date sequence
    if (this.dateValidationOptions.validateDateSequence) {
      if (dates.openingDate && dates.closingDate) {
        const openingDate = new Date(dates.openingDate)
        const closingDate = new Date(dates.closingDate)
        
        if (openingDate >= closingDate) {
          warnings.push('Opening date should be before closing date')
        }
      }

      if (dates.enquiryPeriodStart && dates.enquiryPeriodEnd) {
        const start = new Date(dates.enquiryPeriodStart)
        const end = new Date(dates.enquiryPeriodEnd)
        
        if (start >= end) {
          warnings.push('Enquiry period start should be before end date')
        }
      }
    }

    // Validate future dates
    if (!this.dateValidationOptions.allowFutureDates) {
      Object.entries(dates).forEach(([key, value]) => {
        if (value && value !== 'Not specified') {
          const date = new Date(value)
          if (date > now) {
            warnings.push(`Future date not allowed for ${key}: ${value}`)
          }
        }
      })
    }

    // Validate maximum years in future
    if (this.dateValidationOptions.maxYearsInFuture) {
      const maxDate = new Date()
      maxDate.setFullYear(maxDate.getFullYear() + this.dateValidationOptions.maxYearsInFuture)

      Object.entries(dates).forEach(([key, value]) => {
        if (value && value !== 'Not specified') {
          const date = new Date(value)
          if (date > maxDate) {
            warnings.push(`Date too far in future for ${key}: ${value}`)
          }
        }
      })
    }

    return warnings
  }

  /**
   * Validate contact information according to options
   */
  private validateContactInfo(contact: ContactInformation): string[] {
    const warnings: string[] = []

    // Validate email format
    if (this.contactValidationOptions.validateEmailFormat && contact.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(contact.email)) {
        warnings.push(`Invalid email format: ${contact.email}`)
      }
    }

    // Validate phone format
    if (this.contactValidationOptions.validatePhoneFormat && contact.telephone) {
      const phoneRegex = this.contactValidationOptions.allowInternationalPhone
        ? /^[\+]?[\d\s\-\(\)]+$/
        : /^[\d\s\-\(\)]+$/
      
      if (!phoneRegex.test(contact.telephone) || 
          contact.telephone.replace(/\D/g, '').length < 7) {
        warnings.push(`Invalid phone format: ${contact.telephone}`)
      }
    }

    // Check required fields
    if (this.contactValidationOptions.requireEmail && !contact.email) {
      warnings.push('Email is required but not found')
    }

    if (this.contactValidationOptions.requirePhone && !contact.telephone) {
      warnings.push('Phone number is required but not found')
    }

    return warnings
  }

  /**
   * Calculate confidence score for dates
   */
  private calculateDateConfidence(sources: DateSource[], warnings: string[]): number {
    if (sources.length === 0) return 0

    const avgConfidence = sources.reduce((sum, source) => sum + source.confidence, 0) / sources.length
    const warningPenalty = Math.min(warnings.length * 0.1, 0.5) // Max 50% penalty
    
    return Math.max(0, avgConfidence - warningPenalty)
  }

  /**
   * Calculate confidence score for contact information
   */
  private calculateContactConfidence(sources: ContactSource[], warnings: string[]): number {
    if (sources.length === 0) return 0

    const avgConfidence = sources.reduce((sum, source) => sum + source.confidence, 0) / sources.length
    const warningPenalty = Math.min(warnings.length * 0.1, 0.5) // Max 50% penalty
    
    return Math.max(0, avgConfidence - warningPenalty)
  }
}

// Export utility functions
export const DateContactUtils = {
  formatDate: (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  },

  formatDateTime: (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  },

  isValidDate: (dateString: string): boolean => {
    try {
      const date = new Date(dateString)
      return !isNaN(date.getTime())
    } catch {
      return false
    }
  },

  formatPhoneNumber: (phone: string): string => {
    // Format South African phone numbers
    const cleaned = phone.replace(/\D/g, '')
    
    if (cleaned.startsWith('27') && cleaned.length === 11) {
      return `+27 ${cleaned.slice(2, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`
    }
    
    return phone // Return original if no pattern matches
  }
}