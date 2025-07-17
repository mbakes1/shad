/**
 * Briefing Session and Special Conditions Extractor
 * 
 * Specialized service for extracting briefing session information and special conditions
 * from OCDS tender data with comprehensive text analysis and pattern matching.
 * 
 * Requirements:
 * - 2.5: Extract briefing session information including compulsory status
 * - 2.6: Extract briefing date and venue information, special conditions
 * - 5.2: Data validation and transformation
 */

import { 
  Tender, 
  Release, 
  Document,
  BriefingSession,
  SpecialConditions,
  ContactInformation,
  TransformationError 
} from './tender-data-transformer'

export interface BriefingExtractionResult {
  briefingSession?: BriefingSession
  confidence: number // 0-1 score indicating confidence in extracted briefing info
  sources: BriefingSource[]
  warnings: string[]
}

export interface ConditionsExtractionResult {
  specialConditions: SpecialConditions
  confidence: number // 0-1 score indicating confidence in extracted conditions
  sources: ConditionSource[]
  warnings: string[]
}

export interface BriefingSource {
  field: keyof BriefingSession
  value: any
  source: 'description' | 'milestones' | 'documents' | 'submissionDetails' | 'eligibility'
  confidence: number
  extractionMethod: string
}

export interface ConditionSource {
  field: keyof SpecialConditions
  value: any
  source: 'eligibility' | 'submission' | 'award' | 'procurement' | 'description' | 'documents'
  confidence: number
  extractionMethod: string
}

export interface BriefingPatterns {
  briefingKeywords: string[]
  compulsoryKeywords: string[]
  datePatterns: RegExp[]
  venuePatterns: RegExp[]
  timePatterns: RegExp[]
}

export interface ConditionPatterns {
  requirementKeywords: string[]
  eligibilityKeywords: string[]
  submissionKeywords: string[]
  evaluationKeywords: string[]
  documentKeywords: string[]
}

/**
 * Briefing Session and Special Conditions Extractor Service
 */
export class BriefingConditionsExtractor {
  private briefingPatterns: BriefingPatterns
  private conditionPatterns: ConditionPatterns

  constructor() {
    this.briefingPatterns = {
      briefingKeywords: [
        'briefing', 'briefing session', 'information session', 'pre-bid meeting',
        'pre-tender meeting', 'site visit', 'site inspection', 'clarification meeting',
        'tender briefing', 'bid briefing', 'project briefing', 'technical briefing'
      ],
      compulsoryKeywords: [
        'compulsory', 'mandatory', 'required', 'must attend', 'attendance required',
        'attendance is mandatory', 'attendance is compulsory', 'obligatory'
      ],
      datePatterns: [
        /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/g, // DD/MM/YYYY or DD-MM-YYYY
        /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g, // YYYY/MM/DD or YYYY-MM-DD
        /\b(\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi,
        /\b((January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi,
        /\b((Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/gi
      ],
      venuePatterns: [
        /(?:venue|location|address|at|held at|meeting at|venue:)\s*([^.\n]+)/gi,
        /(?:room|hall|building|office|boardroom)\s+([^.\n]+)/gi,
        /(?:address:)\s*([^.\n]+)/gi,
        /(?:located at|situated at|taking place at)\s*([^.\n]+)/gi
      ],
      timePatterns: [
        /\b(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)\b/g,
        /\b(\d{1,2}\s*[AaPp][Mm])\b/g,
        /\b(at\s+\d{1,2}:\d{2})\b/gi,
        /\b(from\s+\d{1,2}:\d{2})\b/gi
      ]
    }

    this.conditionPatterns = {
      requirementKeywords: [
        'requirement', 'requirements', 'must', 'shall', 'should', 'mandatory',
        'compulsory', 'obligatory', 'necessary', 'essential', 'required'
      ],
      eligibilityKeywords: [
        'eligible', 'eligibility', 'qualify', 'qualification', 'criteria',
        'minimum requirements', 'pre-qualification', 'registration'
      ],
      submissionKeywords: [
        'submission', 'submit', 'tender submission', 'bid submission',
        'proposal submission', 'delivery', 'format', 'method'
      ],
      evaluationKeywords: [
        'evaluation', 'assessment', 'scoring', 'criteria', 'award',
        'selection', 'adjudication', 'judgment'
      ],
      documentKeywords: [
        'document', 'documentation', 'certificate', 'proof', 'evidence',
        'attachment', 'supporting documents', 'required documents'
      ]
    }
  }

  /**
   * Extract briefing session information with comprehensive text analysis
   * Requirements: 2.5, 2.6
   */
  extractBriefingSession(tender: Tender, release: Release): BriefingExtractionResult {
    const sources: BriefingSource[] = []
    const warnings: string[] = []
    let briefingSession: BriefingSession | undefined

    // Check if briefing is mentioned anywhere
    const hasBriefingResult = this.detectBriefingMention(tender)
    
    if (!hasBriefingResult.hasBriefing) {
      return {
        briefingSession: undefined,
        confidence: 0,
        sources: [],
        warnings: ['No briefing session information found']
      }
    }

    sources.push(...hasBriefingResult.sources)

    // Extract detailed briefing information
    const briefingDetails = this.extractBriefingDetails(tender)
    sources.push(...briefingDetails.sources)

    // Construct briefing session object
    briefingSession = {
      hasBriefing: true,
      isCompulsory: this.extractCompulsoryStatus(tender, sources),
      date: this.extractBriefingDate(tender, sources),
      venue: this.extractBriefingVenue(tender, sources),
      description: this.extractBriefingDescription(tender, sources),
      contactInfo: this.extractBriefingContact(tender, sources)
    }

    // Validate briefing information
    const validationWarnings = this.validateBriefingSession(briefingSession)
    warnings.push(...validationWarnings)

    // Calculate confidence score
    const confidence = this.calculateBriefingConfidence(sources, warnings)

    return {
      briefingSession,
      confidence,
      sources,
      warnings
    }
  }

  /**
   * Detect if briefing is mentioned in tender data
   */
  private detectBriefingMention(tender: Tender): { hasBriefing: boolean; sources: BriefingSource[] } {
    const sources: BriefingSource[] = []
    let hasBriefing = false

    // Check tender description
    const description = tender.description?.toLowerCase() || ''
    for (const keyword of this.briefingPatterns.briefingKeywords) {
      if (description.includes(keyword.toLowerCase())) {
        hasBriefing = true
        sources.push({
          field: 'hasBriefing',
          value: true,
          source: 'description',
          confidence: 0.8,
          extractionMethod: `keyword_match: ${keyword}`
        })
        break
      }
    }

    // Check milestones
    if (tender.milestones) {
      for (const milestone of tender.milestones) {
        const milestoneText = (milestone.title + ' ' + milestone.description + ' ' + milestone.type).toLowerCase()
        for (const keyword of this.briefingPatterns.briefingKeywords) {
          if (milestoneText.includes(keyword.toLowerCase())) {
            hasBriefing = true
            sources.push({
              field: 'hasBriefing',
              value: true,
              source: 'milestones',
              confidence: 0.9,
              extractionMethod: `milestone_keyword_match: ${keyword}`
            })
            break
          }
        }
        if (hasBriefing) break
      }
    }

    // Check documents
    if (tender.documents) {
      for (const doc of tender.documents) {
        const docText = (doc.title + ' ' + (doc.description || '')).toLowerCase()
        for (const keyword of this.briefingPatterns.briefingKeywords) {
          if (docText.includes(keyword.toLowerCase())) {
            hasBriefing = true
            sources.push({
              field: 'hasBriefing',
              value: true,
              source: 'documents',
              confidence: 0.7,
              extractionMethod: `document_keyword_match: ${keyword}`
            })
            break
          }
        }
        if (hasBriefing) break
      }
    }

    // Check submission method details
    if (tender.submissionMethodDetails) {
      const submissionText = tender.submissionMethodDetails.toLowerCase()
      for (const keyword of this.briefingPatterns.briefingKeywords) {
        if (submissionText.includes(keyword.toLowerCase())) {
          hasBriefing = true
          sources.push({
            field: 'hasBriefing',
            value: true,
            source: 'submissionDetails',
            confidence: 0.6,
            extractionMethod: `submission_keyword_match: ${keyword}`
          })
          break
        }
      }
    }

    return { hasBriefing, sources }
  }

  /**
   * Extract detailed briefing information
   */
  private extractBriefingDetails(tender: Tender): { sources: BriefingSource[] } {
    const sources: BriefingSource[] = []

    // Extract from description
    if (tender.description) {
      const descriptionSources = this.extractFromText(
        tender.description,
        'description',
        0.8
      )
      sources.push(...descriptionSources)
    }

    // Extract from milestones
    if (tender.milestones) {
      for (const milestone of tender.milestones) {
        const milestoneText = milestone.title + ' ' + milestone.description + ' ' + milestone.type
        const milestoneSources = this.extractFromText(
          milestoneText,
          'milestones',
          0.9
        )
        sources.push(...milestoneSources)

        // Use milestone date if available
        if (milestone.dueDate) {
          sources.push({
            field: 'date',
            value: milestone.dueDate,
            source: 'milestones',
            confidence: 0.9,
            extractionMethod: 'milestone_due_date'
          })
        }
      }
    }

    // Extract from documents
    if (tender.documents) {
      for (const doc of tender.documents) {
        const docText = doc.title + ' ' + (doc.description || '')
        const docSources = this.extractFromText(
          docText,
          'documents',
          0.7
        )
        sources.push(...docSources)
      }
    }

    return { sources }
  }

  /**
   * Extract briefing information from text using patterns
   */
  private extractFromText(
    text: string,
    source: BriefingSource['source'],
    baseConfidence: number
  ): BriefingSource[] {
    const sources: BriefingSource[] = []

    // Extract dates
    for (const pattern of this.briefingPatterns.datePatterns) {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          sources.push({
            field: 'date',
            value: match,
            source,
            confidence: baseConfidence,
            extractionMethod: `date_pattern: ${pattern.source}`
          })
        })
      }
    }

    // Extract venues
    for (const pattern of this.briefingPatterns.venuePatterns) {
      const matches = [...text.matchAll(pattern)]
      matches.forEach(match => {
        if (match[1]) {
          sources.push({
            field: 'venue',
            value: match[1].trim(),
            source,
            confidence: baseConfidence * 0.8,
            extractionMethod: `venue_pattern: ${pattern.source}`
          })
        }
      })
    }

    // Extract times (add to description)
    for (const pattern of this.briefingPatterns.timePatterns) {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          sources.push({
            field: 'description',
            value: `Time: ${match}`,
            source,
            confidence: baseConfidence * 0.6,
            extractionMethod: `time_pattern: ${pattern.source}`
          })
        })
      }
    }

    return sources
  }

  /**
   * Extract compulsory status
   */
  private extractCompulsoryStatus(tender: Tender, sources: BriefingSource[]): boolean | undefined {
    const allText = [
      tender.description || '',
      tender.submissionMethodDetails || '',
      tender.eligibilityCriteria || '',
      ...(tender.milestones?.map(m => m.title + ' ' + m.description) || []),
      ...(tender.documents?.map(d => d.title + ' ' + (d.description || '')) || [])
    ].join(' ').toLowerCase()

    for (const keyword of this.briefingPatterns.compulsoryKeywords) {
      if (allText.includes(keyword.toLowerCase())) {
        sources.push({
          field: 'isCompulsory',
          value: true,
          source: 'description',
          confidence: 0.8,
          extractionMethod: `compulsory_keyword: ${keyword}`
        })
        return true
      }
    }

    return undefined
  }

  /**
   * Extract briefing date
   */
  private extractBriefingDate(tender: Tender, sources: BriefingSource[]): string | undefined {
    const dateSources = sources.filter(s => s.field === 'date')
    if (dateSources.length === 0) return undefined

    // Return the date with highest confidence
    const bestDateSource = dateSources.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )

    return bestDateSource.value
  }

  /**
   * Extract briefing venue
   */
  private extractBriefingVenue(tender: Tender, sources: BriefingSource[]): string | undefined {
    const venueSources = sources.filter(s => s.field === 'venue')
    if (venueSources.length === 0) return undefined

    // Return the venue with highest confidence
    const bestVenueSource = venueSources.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )

    return bestVenueSource.value
  }

  /**
   * Extract briefing description
   */
  private extractBriefingDescription(tender: Tender, sources: BriefingSource[]): string | undefined {
    const descriptionSources = sources.filter(s => s.field === 'description')
    if (descriptionSources.length === 0) {
      // Use tender description if it mentions briefing
      if (tender.description && this.briefingPatterns.briefingKeywords.some(k => 
        tender.description!.toLowerCase().includes(k.toLowerCase())
      )) {
        return tender.description
      }
      return undefined
    }

    // Combine all description sources
    return descriptionSources.map(s => s.value).join('; ')
  }

  /**
   * Extract briefing contact information
   */
  private extractBriefingContact(tender: Tender, sources: BriefingSource[]): ContactInformation | undefined {
    // For now, use the main tender contact information
    // This could be enhanced to extract specific briefing contacts from text
    if (tender.procuringEntity?.contactPoint) {
      return {
        contactPerson: tender.procuringEntity.contactPoint.name,
        email: tender.procuringEntity.contactPoint.email,
        telephone: tender.procuringEntity.contactPoint.telephone,
        fax: tender.procuringEntity.contactPoint.faxNumber,
        organizationName: tender.procuringEntity.name,
        address: tender.procuringEntity.address
      }
    }

    return undefined
  }

  /**
   * Extract special conditions and requirements
   * Requirements: 2.6
   */
  extractSpecialConditions(tender: Tender, release: Release): ConditionsExtractionResult {
    const sources: ConditionSource[] = []
    const warnings: string[] = []
    const specialConditions: SpecialConditions = {}

    // Extract eligibility criteria
    if (tender.eligibilityCriteria) {
      specialConditions.eligibilityCriteria = tender.eligibilityCriteria
      sources.push({
        field: 'eligibilityCriteria',
        value: tender.eligibilityCriteria,
        source: 'eligibility',
        confidence: 0.95,
        extractionMethod: 'direct_field'
      })
    }

    // Extract submission requirements
    const submissionRequirements = this.extractSubmissionRequirements(tender, sources)
    if (submissionRequirements.length > 0) {
      specialConditions.submissionRequirements = submissionRequirements
    }

    // Extract evaluation criteria
    const evaluationCriteria = this.extractEvaluationCriteria(tender, sources)
    if (evaluationCriteria) {
      specialConditions.evaluationCriteria = evaluationCriteria
    }

    // Extract procurement method details
    if (tender.procurementMethodDetails) {
      specialConditions.procurementMethodDetails = tender.procurementMethodDetails
      sources.push({
        field: 'procurementMethodDetails',
        value: tender.procurementMethodDetails,
        source: 'procurement',
        confidence: 0.9,
        extractionMethod: 'direct_field'
      })
    }

    // Extract additional requirements from description
    const additionalRequirements = this.extractAdditionalRequirements(tender, sources)
    if (additionalRequirements.length > 0) {
      specialConditions.additionalRequirements = additionalRequirements
    }

    // Extract document requirements
    const documentRequirements = this.extractDocumentRequirements(tender, sources)
    if (documentRequirements.length > 0) {
      specialConditions.documentRequirements = documentRequirements
    }

    // Validate special conditions
    const validationWarnings = this.validateSpecialConditions(specialConditions)
    warnings.push(...validationWarnings)

    // Calculate confidence score
    const confidence = this.calculateConditionsConfidence(sources, warnings)

    return {
      specialConditions,
      confidence,
      sources,
      warnings
    }
  }

  /**
   * Extract submission requirements
   */
  private extractSubmissionRequirements(tender: Tender, sources: ConditionSource[]): string[] {
    const requirements: string[] = []

    // From submission methods
    if (tender.submissionMethod) {
      const methodText = `Submission methods: ${tender.submissionMethod.join(', ')}`
      requirements.push(methodText)
      sources.push({
        field: 'submissionRequirements',
        value: methodText,
        source: 'submission',
        confidence: 0.9,
        extractionMethod: 'submission_methods'
      })
    }

    // From submission method details
    if (tender.submissionMethodDetails) {
      requirements.push(tender.submissionMethodDetails)
      sources.push({
        field: 'submissionRequirements',
        value: tender.submissionMethodDetails,
        source: 'submission',
        confidence: 0.9,
        extractionMethod: 'submission_details'
      })
    }

    // Extract from description
    if (tender.description) {
      const extractedRequirements = this.extractRequirementsFromText(
        tender.description,
        this.conditionPatterns.submissionKeywords
      )
      requirements.push(...extractedRequirements)
      
      extractedRequirements.forEach(req => {
        sources.push({
          field: 'submissionRequirements',
          value: req,
          source: 'description',
          confidence: 0.7,
          extractionMethod: 'text_extraction'
        })
      })
    }

    return requirements
  }

  /**
   * Extract evaluation criteria
   */
  private extractEvaluationCriteria(tender: Tender, sources: ConditionSource[]): string | undefined {
    let evaluationCriteria = ''

    // From award criteria
    if (tender.awardCriteria) {
      evaluationCriteria = `Award criteria: ${tender.awardCriteria}`
      sources.push({
        field: 'evaluationCriteria',
        value: tender.awardCriteria,
        source: 'award',
        confidence: 0.95,
        extractionMethod: 'award_criteria'
      })
    }

    // From award criteria details
    if (tender.awardCriteriaDetails) {
      if (evaluationCriteria) {
        evaluationCriteria += `\n${tender.awardCriteriaDetails}`
      } else {
        evaluationCriteria = tender.awardCriteriaDetails
      }
      sources.push({
        field: 'evaluationCriteria',
        value: tender.awardCriteriaDetails,
        source: 'award',
        confidence: 0.9,
        extractionMethod: 'award_criteria_details'
      })
    }

    // Extract from description
    if (tender.description) {
      const extractedCriteria = this.extractRequirementsFromText(
        tender.description,
        this.conditionPatterns.evaluationKeywords
      )
      
      if (extractedCriteria.length > 0) {
        const criteriaText = extractedCriteria.join('; ')
        if (evaluationCriteria) {
          evaluationCriteria += `\nAdditional criteria: ${criteriaText}`
        } else {
          evaluationCriteria = criteriaText
        }
        
        sources.push({
          field: 'evaluationCriteria',
          value: criteriaText,
          source: 'description',
          confidence: 0.6,
          extractionMethod: 'text_extraction'
        })
      }
    }

    return evaluationCriteria || undefined
  }

  /**
   * Extract additional requirements from text
   */
  private extractAdditionalRequirements(tender: Tender, sources: ConditionSource[]): string[] {
    const requirements: string[] = []

    if (tender.description) {
      const extractedRequirements = this.extractRequirementsFromText(
        tender.description,
        this.conditionPatterns.requirementKeywords
      )
      requirements.push(...extractedRequirements)
      
      extractedRequirements.forEach(req => {
        sources.push({
          field: 'additionalRequirements',
          value: req,
          source: 'description',
          confidence: 0.7,
          extractionMethod: 'text_extraction'
        })
      })
    }

    return requirements
  }

  /**
   * Extract document requirements
   */
  private extractDocumentRequirements(tender: Tender, sources: ConditionSource[]): string[] {
    const requirements: string[] = []

    if (tender.documents) {
      tender.documents.forEach(doc => {
        const isRequirementDoc = 
          doc.documentType.toLowerCase().includes('requirement') ||
          doc.title.toLowerCase().includes('requirement') ||
          doc.documentType.toLowerCase().includes('specification') ||
          doc.title.toLowerCase().includes('specification')

        if (isRequirementDoc) {
          const docText = `${doc.title} (${doc.documentType})`
          requirements.push(docText)
          sources.push({
            field: 'documentRequirements',
            value: docText,
            source: 'documents',
            confidence: 0.8,
            extractionMethod: 'document_analysis'
          })
        }
      })
    }

    return requirements
  }

  /**
   * Extract requirements from text using keywords
   */
  private extractRequirementsFromText(text: string, keywords: string[]): string[] {
    const requirements: string[] = []
    const sentences = text.split(/[.!?]+/)

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase()
      if (keywords.some(keyword => lowerSentence.includes(keyword.toLowerCase()))) {
        const cleanSentence = sentence.trim()
        if (cleanSentence.length > 10) { // Avoid very short sentences
          requirements.push(cleanSentence)
        }
      }
    }

    return requirements
  }

  // Validation methods

  /**
   * Validate briefing session information
   */
  private validateBriefingSession(briefingSession: BriefingSession): string[] {
    const warnings: string[] = []

    if (briefingSession.hasBriefing) {
      if (!briefingSession.date) {
        warnings.push('Briefing session mentioned but date not found')
      }

      if (!briefingSession.venue) {
        warnings.push('Briefing session mentioned but venue not specified')
      }

      if (briefingSession.isCompulsory === undefined) {
        warnings.push('Briefing session compulsory status not clearly specified')
      }

      // Validate date format
      if (briefingSession.date) {
        try {
          const date = new Date(briefingSession.date)
          if (isNaN(date.getTime())) {
            warnings.push(`Invalid briefing date format: ${briefingSession.date}`)
          }
        } catch (error) {
          warnings.push(`Briefing date parsing error: ${briefingSession.date}`)
        }
      }
    }

    return warnings
  }

  /**
   * Validate special conditions
   */
  private validateSpecialConditions(conditions: SpecialConditions): string[] {
    const warnings: string[] = []

    const hasAnyConditions = Object.values(conditions).some(value => 
      value !== undefined && 
      (typeof value === 'string' ? value.length > 0 : value.length > 0)
    )

    if (!hasAnyConditions) {
      warnings.push('No special conditions or requirements found')
    }

    return warnings
  }

  // Confidence calculation methods

  /**
   * Calculate confidence score for briefing information
   */
  private calculateBriefingConfidence(sources: BriefingSource[], warnings: string[]): number {
    if (sources.length === 0) return 0

    const avgConfidence = sources.reduce((sum, source) => sum + source.confidence, 0) / sources.length
    const warningPenalty = Math.min(warnings.length * 0.1, 0.5) // Max 50% penalty
    
    return Math.max(0, avgConfidence - warningPenalty)
  }

  /**
   * Calculate confidence score for special conditions
   */
  private calculateConditionsConfidence(sources: ConditionSource[], warnings: string[]): number {
    if (sources.length === 0) return 0

    const avgConfidence = sources.reduce((sum, source) => sum + source.confidence, 0) / sources.length
    const warningPenalty = Math.min(warnings.length * 0.1, 0.5) // Max 50% penalty
    
    return Math.max(0, avgConfidence - warningPenalty)
  }
}

// Export utility functions
export const BriefingConditionsUtils = {
  formatBriefingInfo: (briefing: BriefingSession): string => {
    const parts: string[] = []
    
    if (briefing.date) {
      parts.push(`Date: ${briefing.date}`)
    }
    
    if (briefing.venue) {
      parts.push(`Venue: ${briefing.venue}`)
    }
    
    if (briefing.isCompulsory !== undefined) {
      parts.push(`Attendance: ${briefing.isCompulsory ? 'Compulsory' : 'Optional'}`)
    }
    
    return parts.join(' | ')
  },

  summarizeConditions: (conditions: SpecialConditions): string => {
    const summaryParts: string[] = []
    
    if (conditions.eligibilityCriteria) {
      summaryParts.push('Eligibility criteria specified')
    }
    
    if (conditions.submissionRequirements?.length) {
      summaryParts.push(`${conditions.submissionRequirements.length} submission requirements`)
    }
    
    if (conditions.evaluationCriteria) {
      summaryParts.push('Evaluation criteria specified')
    }
    
    if (conditions.documentRequirements?.length) {
      summaryParts.push(`${conditions.documentRequirements.length} document requirements`)
    }
    
    return summaryParts.join(', ') || 'No special conditions specified'
  }
}