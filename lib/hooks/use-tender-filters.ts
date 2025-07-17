"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { EnhancedTenderInfo } from "./use-comprehensive-tenders"

export interface TenderFilters {
  // Text search
  searchQuery: string
  searchFields: SearchField[]
  
  // Date filters
  dateFrom?: string
  dateTo?: string
  closingDateFrom?: string
  closingDateTo?: string
  
  // Category filters
  categories: string[]
  departments: string[]
  statuses: string[]
  
  // Value filters
  minValue?: number
  maxValue?: number
  currency?: string
  
  // Location filters
  locations: string[]
  
  // Special conditions
  hasBriefing?: boolean
  isCompulsoryBriefing?: boolean
  hasSpecialConditions?: boolean
  
  // Contact information
  hasContactInfo?: boolean
  hasEmail?: boolean
  hasPhone?: boolean
}

export type SearchField = 
  | 'title'
  | 'description' 
  | 'department'
  | 'procuringEntity'
  | 'location'
  | 'contactPerson'
  | 'specialConditions'
  | 'all'

export interface FilterOptions {
  categories: string[]
  departments: string[]
  statuses: string[]
  currencies: string[]
  locations: string[]
}

export interface SortConfig {
  field: SortField
  direction: 'asc' | 'desc'
}

export type SortField = 
  | 'title'
  | 'closingDate'
  | 'publishDate'
  | 'value'
  | 'department'
  | 'status'
  | 'relevance'

export interface FilteredTendersResult {
  filteredTenders: EnhancedTenderInfo[]
  totalCount: number
  filteredCount: number
  filterOptions: FilterOptions
  appliedFiltersCount: number
}

export interface UseTenderFiltersOptions {
  tenders: EnhancedTenderInfo[]
  enableUrlSync?: boolean
  debounceMs?: number
  defaultSort?: SortConfig
}

const DEFAULT_FILTERS: TenderFilters = {
  searchQuery: '',
  searchFields: ['all'],
  categories: [],
  departments: [],
  statuses: [],
  locations: [],
}

const DEFAULT_SORT: SortConfig = {
  field: 'closingDate',
  direction: 'asc',
}

export function useTenderFilters({
  tenders,
  enableUrlSync = true,
  debounceMs = 300,
  defaultSort = DEFAULT_SORT,
}: UseTenderFiltersOptions) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // State management
  const [filters, setFilters] = useState<TenderFilters>(DEFAULT_FILTERS)
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultSort)
  const [debouncedFilters, setDebouncedFilters] = useState<TenderFilters>(DEFAULT_FILTERS)

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [filters, debounceMs])

  // Sync with URL parameters
  useEffect(() => {
    if (!enableUrlSync) return

    const urlFilters = parseFiltersFromUrl(searchParams)
    const urlSort = parseSortFromUrl(searchParams)
    
    setFilters(urlFilters)
    setSortConfig(urlSort)
  }, [searchParams, enableUrlSync])

  // Update URL when filters change
  useEffect(() => {
    if (!enableUrlSync) return

    const params = new URLSearchParams()
    
    // Add filter parameters
    if (debouncedFilters.searchQuery) {
      params.set('q', debouncedFilters.searchQuery)
    }
    
    if (debouncedFilters.searchFields.length > 0 && !debouncedFilters.searchFields.includes('all')) {
      params.set('fields', debouncedFilters.searchFields.join(','))
    }
    
    if (debouncedFilters.dateFrom) {
      params.set('dateFrom', debouncedFilters.dateFrom)
    }
    
    if (debouncedFilters.dateTo) {
      params.set('dateTo', debouncedFilters.dateTo)
    }
    
    if (debouncedFilters.closingDateFrom) {
      params.set('closingFrom', debouncedFilters.closingDateFrom)
    }
    
    if (debouncedFilters.closingDateTo) {
      params.set('closingTo', debouncedFilters.closingDateTo)
    }
    
    if (debouncedFilters.categories.length > 0) {
      params.set('categories', debouncedFilters.categories.join(','))
    }
    
    if (debouncedFilters.departments.length > 0) {
      params.set('departments', debouncedFilters.departments.join(','))
    }
    
    if (debouncedFilters.statuses.length > 0) {
      params.set('statuses', debouncedFilters.statuses.join(','))
    }
    
    if (debouncedFilters.locations.length > 0) {
      params.set('locations', debouncedFilters.locations.join(','))
    }
    
    if (debouncedFilters.minValue !== undefined) {
      params.set('minValue', debouncedFilters.minValue.toString())
    }
    
    if (debouncedFilters.maxValue !== undefined) {
      params.set('maxValue', debouncedFilters.maxValue.toString())
    }
    
    if (debouncedFilters.currency) {
      params.set('currency', debouncedFilters.currency)
    }
    
    if (debouncedFilters.hasBriefing !== undefined) {
      params.set('briefing', debouncedFilters.hasBriefing.toString())
    }
    
    if (debouncedFilters.isCompulsoryBriefing !== undefined) {
      params.set('compulsoryBriefing', debouncedFilters.isCompulsoryBriefing.toString())
    }
    
    if (debouncedFilters.hasSpecialConditions !== undefined) {
      params.set('specialConditions', debouncedFilters.hasSpecialConditions.toString())
    }
    
    if (debouncedFilters.hasContactInfo !== undefined) {
      params.set('contactInfo', debouncedFilters.hasContactInfo.toString())
    }
    
    if (debouncedFilters.hasEmail !== undefined) {
      params.set('hasEmail', debouncedFilters.hasEmail.toString())
    }
    
    if (debouncedFilters.hasPhone !== undefined) {
      params.set('hasPhone', debouncedFilters.hasPhone.toString())
    }
    
    // Add sort parameters
    if (sortConfig.field !== defaultSort.field || sortConfig.direction !== defaultSort.direction) {
      params.set('sort', `${sortConfig.field}:${sortConfig.direction}`)
    }
    
    // Update URL without causing navigation
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState({}, '', newUrl)
    
  }, [debouncedFilters, sortConfig, enableUrlSync, defaultSort])

  // Extract filter options from tenders
  const filterOptions = useMemo((): FilterOptions => {
    const categories = new Set<string>()
    const departments = new Set<string>()
    const statuses = new Set<string>()
    const currencies = new Set<string>()
    const locations = new Set<string>()

    tenders.forEach(tender => {
      if (tender.tender.mainProcurementCategory) {
        categories.add(tender.tender.mainProcurementCategory)
      }
      
      if (tender.tender.requestForBid?.department) {
        departments.add(tender.tender.requestForBid.department)
      }
      
      if (tender.tender.status) {
        statuses.add(tender.tender.status)
      }
      
      if (tender.tender.value?.currency) {
        currencies.add(tender.tender.value.currency)
      }
      
      if (tender.tender.requestForBid?.deliveryLocation) {
        locations.add(tender.tender.requestForBid.deliveryLocation)
      }
    })

    return {
      categories: Array.from(categories).sort(),
      departments: Array.from(departments).sort(),
      statuses: Array.from(statuses).sort(),
      currencies: Array.from(currencies).sort(),
      locations: Array.from(locations).sort(),
    }
  }, [tenders])

  // Enhanced full-text search function with relevance scoring and fuzzy matching
  const searchTender = useCallback((tender: EnhancedTenderInfo, query: string, fields: SearchField[]): { matches: boolean; score: number } => {
    if (!query.trim()) return { matches: true, score: 0 }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0)
    const searchableText = extractSearchableText(tender, fields).toLowerCase()
    
    let score = 0
    let matchedTerms = 0
    let exactMatches = 0

    // Check each search term
    for (const term of searchTerms) {
      let termMatched = false
      let termScore = 0

      // Exact term matching
      if (searchableText.includes(term)) {
        termMatched = true
        matchedTerms++
        
        // Boost score based on where the term appears (field-specific scoring)
        if (tender.tender.title.toLowerCase().includes(term)) {
          termScore += 15 // Title matches are most important
          if (tender.tender.title.toLowerCase().startsWith(term)) {
            termScore += 5 // Title starts with term bonus
          }
        }
        if (tender.tender.description?.toLowerCase().includes(term)) {
          termScore += 8 // Description matches are important
        }
        if (tender.tender.requestForBid?.bidDescription?.toLowerCase().includes(term)) {
          termScore += 7 // Bid description matches
        }
        if (tender.tender.requestForBid?.department?.toLowerCase().includes(term)) {
          termScore += 6 // Department matches are moderately important
        }
        if (tender.tender.procuringEntity?.name?.toLowerCase().includes(term)) {
          termScore += 6 // Entity matches are moderately important
        }
        if (tender.tender.contactInformation?.contactPerson?.toLowerCase().includes(term)) {
          termScore += 4 // Contact person matches
        }
        if (tender.tender.requestForBid?.deliveryLocation?.toLowerCase().includes(term)) {
          termScore += 4 // Location matches
        }
        if (tender.tender.specialConditions?.some(condition => condition.toLowerCase().includes(term))) {
          termScore += 3 // Special conditions matches
        }
        
        // Term frequency bonus (more occurrences = higher relevance)
        const termCount = (searchableText.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        termScore += Math.min(termCount - 1, 5) // Cap bonus at 5 points
        
        exactMatches++
      }
      
      // Fuzzy matching for partial words (only if no exact match and term is long enough)
      if (!termMatched && term.length >= 4) {
        const fuzzyPattern = term.split('').join('.*?')
        const fuzzyRegex = new RegExp(fuzzyPattern, 'i')
        
        if (fuzzyRegex.test(searchableText)) {
          termMatched = true
          matchedTerms++
          termScore += 2 // Lower score for fuzzy matches
        }
      }
      
      score += termScore
    }

    // Exact phrase bonus
    if (query.length > 3 && searchableText.includes(query.toLowerCase())) {
      score += 10
      exactMatches++
    }
    
    // Bonus for having all terms as exact matches
    if (exactMatches === searchTerms.length) {
      score += 5
    }
    
    // Penalty for very long content (less specific)
    if (searchableText.length > 1000) {
      score = Math.max(0, score - 2)
    }

    // All search terms must be found (AND logic)
    const matches = matchedTerms === searchTerms.length
    
    return { matches, score }
  }, [])

  // Apply all filters with search scoring
  const applyFilters = useCallback((tenders: EnhancedTenderInfo[], filters: TenderFilters): { tender: EnhancedTenderInfo; searchScore: number }[] => {
    return tenders.map(tender => {
      const searchResult = searchTender(tender, filters.searchQuery, filters.searchFields)
      return { tender, searchScore: searchResult.score, searchMatches: searchResult.matches }
    }).filter(({ tender, searchMatches }) => {
      // Text search
      if (!searchMatches) {
        return false
      }

      // Date filters
      if (filters.dateFrom) {
        const tenderDate = new Date(tender.date)
        if (tenderDate < new Date(filters.dateFrom)) return false
      }
      
      if (filters.dateTo) {
        const tenderDate = new Date(tender.date)
        if (tenderDate > new Date(filters.dateTo)) return false
      }

      // Closing date filters
      const closingDate = tender.tender.tenderPeriod?.endDate || tender.tender.keyDates?.closingDate
      if (closingDate) {
        if (filters.closingDateFrom && new Date(closingDate) < new Date(filters.closingDateFrom)) {
          return false
        }
        if (filters.closingDateTo && new Date(closingDate) > new Date(filters.closingDateTo)) {
          return false
        }
      }

      // Category filters
      if (filters.categories.length > 0) {
        if (!tender.tender.mainProcurementCategory || 
            !filters.categories.includes(tender.tender.mainProcurementCategory)) {
          return false
        }
      }

      // Department filters
      if (filters.departments.length > 0) {
        if (!tender.tender.requestForBid?.department || 
            !filters.departments.includes(tender.tender.requestForBid.department)) {
          return false
        }
      }

      // Status filters
      if (filters.statuses.length > 0) {
        if (!tender.tender.status || !filters.statuses.includes(tender.tender.status)) {
          return false
        }
      }

      // Location filters
      if (filters.locations.length > 0) {
        if (!tender.tender.requestForBid?.deliveryLocation || 
            !filters.locations.includes(tender.tender.requestForBid.deliveryLocation)) {
          return false
        }
      }

      // Value filters
      if (filters.minValue !== undefined || filters.maxValue !== undefined) {
        const value = tender.tender.value?.amount
        if (value === undefined) return false
        
        if (filters.minValue !== undefined && value < filters.minValue) return false
        if (filters.maxValue !== undefined && value > filters.maxValue) return false
      }

      // Currency filter
      if (filters.currency) {
        if (!tender.tender.value?.currency || tender.tender.value.currency !== filters.currency) {
          return false
        }
      }

      // Briefing filters
      if (filters.hasBriefing !== undefined) {
        const hasBriefing = tender.tender.briefingSession?.hasBriefing || false
        if (hasBriefing !== filters.hasBriefing) return false
      }

      if (filters.isCompulsoryBriefing !== undefined) {
        const isCompulsory = tender.tender.briefingSession?.isCompulsory || false
        if (isCompulsory !== filters.isCompulsoryBriefing) return false
      }

      // Special conditions filter
      if (filters.hasSpecialConditions !== undefined) {
        const hasConditions = (tender.tender.specialConditions?.length || 0) > 0
        if (hasConditions !== filters.hasSpecialConditions) return false
      }

      // Contact information filters
      if (filters.hasContactInfo !== undefined) {
        const hasContact = !!(tender.tender.contactInformation?.contactPerson || 
                            tender.tender.contactInformation?.email || 
                            tender.tender.contactInformation?.telephone)
        if (hasContact !== filters.hasContactInfo) return false
      }

      if (filters.hasEmail !== undefined) {
        const hasEmail = !!tender.tender.contactInformation?.email
        if (hasEmail !== filters.hasEmail) return false
      }

      if (filters.hasPhone !== undefined) {
        const hasPhone = !!tender.tender.contactInformation?.telephone
        if (hasPhone !== filters.hasPhone) return false
      }

      return true
    })
  }, [searchTender])

  // Apply sorting with search score support
  const applySorting = useCallback((tendersWithScores: { tender: EnhancedTenderInfo; searchScore: number }[], sort: SortConfig): EnhancedTenderInfo[] => {
    return [...tendersWithScores].sort((a, b) => {
      let comparison = 0

      switch (sort.field) {
        case 'relevance':
          // Use search scores for relevance sorting
          comparison = b.searchScore - a.searchScore
          // If scores are equal, fall back to closing date
          if (comparison === 0) {
            const aClosing = a.tender.tender.tenderPeriod?.endDate || a.tender.tender.keyDates?.closingDate || ''
            const bClosing = b.tender.tender.tenderPeriod?.endDate || b.tender.tender.keyDates?.closingDate || ''
            comparison = new Date(aClosing).getTime() - new Date(bClosing).getTime()
          }
          break
          
        case 'title':
          comparison = a.tender.tender.title.localeCompare(b.tender.tender.title)
          break
          
        case 'closingDate':
          const aClosing = a.tender.tender.tenderPeriod?.endDate || a.tender.tender.keyDates?.closingDate || ''
          const bClosing = b.tender.tender.tenderPeriod?.endDate || b.tender.tender.keyDates?.closingDate || ''
          comparison = new Date(aClosing).getTime() - new Date(bClosing).getTime()
          break
          
        case 'publishDate':
          comparison = new Date(a.tender.date).getTime() - new Date(b.tender.date).getTime()
          break
          
        case 'value':
          const aValue = a.tender.tender.value?.amount || 0
          const bValue = b.tender.tender.value?.amount || 0
          comparison = aValue - bValue
          break
          
        case 'department':
          const aDept = a.tender.tender.requestForBid?.department || a.tender.tender.procuringEntity?.name || ''
          const bDept = b.tender.tender.requestForBid?.department || b.tender.tender.procuringEntity?.name || ''
          comparison = aDept.localeCompare(bDept)
          break
          
        case 'status':
          comparison = a.tender.tender.status.localeCompare(b.tender.tender.status)
          break
      }

      return sort.direction === 'desc' ? -comparison : comparison
    }).map(item => item.tender)
  }, [])

  // Main filtered result
  const filteredResult = useMemo((): FilteredTendersResult => {
    const filtered = applyFilters(tenders, debouncedFilters)
    const sorted = applySorting(filtered, sortConfig)
    
    const appliedFiltersCount = countAppliedFilters(debouncedFilters)

    return {
      filteredTenders: sorted,
      totalCount: tenders.length,
      filteredCount: sorted.length,
      filterOptions,
      appliedFiltersCount,
    }
  }, [tenders, debouncedFilters, sortConfig, applyFilters, applySorting, filterOptions])

  // Action functions
  const updateFilters = useCallback((updates: Partial<TenderFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }))
  }, [])

  const updateSort = useCallback((field: SortField, direction?: 'asc' | 'desc') => {
    setSortConfig(prev => ({
      field,
      direction: direction || (prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'),
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setSortConfig(defaultSort)
  }, [defaultSort])

  const clearSearch = useCallback(() => {
    setFilters(prev => ({ ...prev, searchQuery: '', searchFields: ['all'] }))
  }, [])

  const addFilter = useCallback((key: keyof TenderFilters, value: any) => {
    setFilters(prev => {
      const currentValue = prev[key]
      if (Array.isArray(currentValue) && Array.isArray(value)) {
        return { ...prev, [key]: [...new Set([...currentValue, ...value])] }
      } else if (Array.isArray(currentValue)) {
        return { ...prev, [key]: [...new Set([...currentValue, value])] }
      } else {
        return { ...prev, [key]: value }
      }
    })
  }, [])

  const removeFilter = useCallback((key: keyof TenderFilters, value?: any) => {
    setFilters(prev => {
      const currentValue = prev[key]
      if (Array.isArray(currentValue) && value !== undefined) {
        return { ...prev, [key]: currentValue.filter(v => v !== value) }
      } else {
        return { ...prev, [key]: Array.isArray(currentValue) ? [] : undefined }
      }
    })
  }, [])

  return {
    filters,
    sortConfig,
    filteredResult,
    actions: {
      updateFilters,
      updateSort,
      clearFilters,
      clearSearch,
      addFilter,
      removeFilter,
    },
  }
}

// Helper functions
function extractSearchableText(tender: EnhancedTenderInfo, fields: SearchField[]): string {
  const texts: string[] = []

  if (fields.includes('all') || fields.includes('title')) {
    texts.push(tender.tender.title || '')
  }

  if (fields.includes('all') || fields.includes('description')) {
    texts.push(tender.tender.description || '')
    texts.push(tender.tender.requestForBid?.bidDescription || '')
  }

  if (fields.includes('all') || fields.includes('department')) {
    texts.push(tender.tender.requestForBid?.department || '')
  }

  if (fields.includes('all') || fields.includes('procuringEntity')) {
    texts.push(tender.tender.procuringEntity?.name || '')
    texts.push(tender.tender.procuringEntity?.id || '')
  }

  if (fields.includes('all') || fields.includes('location')) {
    texts.push(tender.tender.requestForBid?.deliveryLocation || '')
  }

  if (fields.includes('all') || fields.includes('contactPerson')) {
    texts.push(tender.tender.contactInformation?.contactPerson || '')
    texts.push(tender.tender.contactInformation?.email || '')
    texts.push(tender.tender.contactInformation?.telephone || '')
  }

  if (fields.includes('all') || fields.includes('specialConditions')) {
    texts.push(...(tender.tender.specialConditions || []))
  }

  // Additional comprehensive fields for 'all' search
  if (fields.includes('all')) {
    texts.push(tender.tender.id || '')
    texts.push(tender.ocid || '')
    texts.push(tender.tender.status || '')
    texts.push(tender.tender.mainProcurementCategory || '')
    texts.push(tender.tender.value?.currency || '')
    texts.push(tender.tender.briefingSession?.venue || '')
    
    // Include date information as searchable text
    if (tender.tender.keyDates?.openingDate) {
      texts.push(new Date(tender.tender.keyDates.openingDate).toLocaleDateString())
    }
    if (tender.tender.keyDates?.closingDate) {
      texts.push(new Date(tender.tender.keyDates.closingDate).toLocaleDateString())
    }
    if (tender.tender.tenderPeriod?.endDate) {
      texts.push(new Date(tender.tender.tenderPeriod.endDate).toLocaleDateString())
    }
  }

  return texts.filter(text => text.trim().length > 0).join(' ')
}

function parseFiltersFromUrl(searchParams: URLSearchParams): TenderFilters {
  const filters: TenderFilters = { ...DEFAULT_FILTERS }

  const q = searchParams.get('q')
  if (q) filters.searchQuery = q

  const fields = searchParams.get('fields')
  if (fields) filters.searchFields = fields.split(',') as SearchField[]

  const dateFrom = searchParams.get('dateFrom')
  if (dateFrom) filters.dateFrom = dateFrom

  const dateTo = searchParams.get('dateTo')
  if (dateTo) filters.dateTo = dateTo

  const closingFrom = searchParams.get('closingFrom')
  if (closingFrom) filters.closingDateFrom = closingFrom

  const closingTo = searchParams.get('closingTo')
  if (closingTo) filters.closingDateTo = closingTo

  const categories = searchParams.get('categories')
  if (categories) filters.categories = categories.split(',')

  const departments = searchParams.get('departments')
  if (departments) filters.departments = departments.split(',')

  const statuses = searchParams.get('statuses')
  if (statuses) filters.statuses = statuses.split(',')

  const locations = searchParams.get('locations')
  if (locations) filters.locations = locations.split(',')

  const minValue = searchParams.get('minValue')
  if (minValue) filters.minValue = parseFloat(minValue)

  const maxValue = searchParams.get('maxValue')
  if (maxValue) filters.maxValue = parseFloat(maxValue)

  const currency = searchParams.get('currency')
  if (currency) filters.currency = currency

  const briefing = searchParams.get('briefing')
  if (briefing) filters.hasBriefing = briefing === 'true'

  const compulsoryBriefing = searchParams.get('compulsoryBriefing')
  if (compulsoryBriefing) filters.isCompulsoryBriefing = compulsoryBriefing === 'true'

  const specialConditions = searchParams.get('specialConditions')
  if (specialConditions) filters.hasSpecialConditions = specialConditions === 'true'

  const contactInfo = searchParams.get('contactInfo')
  if (contactInfo) filters.hasContactInfo = contactInfo === 'true'

  const hasEmail = searchParams.get('hasEmail')
  if (hasEmail) filters.hasEmail = hasEmail === 'true'

  const hasPhone = searchParams.get('hasPhone')
  if (hasPhone) filters.hasPhone = hasPhone === 'true'

  return filters
}

function parseSortFromUrl(searchParams: URLSearchParams): SortConfig {
  const sort = searchParams.get('sort')
  if (sort) {
    const [field, direction] = sort.split(':')
    return {
      field: field as SortField,
      direction: direction as 'asc' | 'desc',
    }
  }
  return DEFAULT_SORT
}

function countAppliedFilters(filters: TenderFilters): number {
  let count = 0

  if (filters.searchQuery.trim()) count++
  if (filters.dateFrom) count++
  if (filters.dateTo) count++
  if (filters.closingDateFrom) count++
  if (filters.closingDateTo) count++
  if (filters.categories.length > 0) count++
  if (filters.departments.length > 0) count++
  if (filters.statuses.length > 0) count++
  if (filters.locations.length > 0) count++
  if (filters.minValue !== undefined) count++
  if (filters.maxValue !== undefined) count++
  if (filters.currency) count++
  if (filters.hasBriefing !== undefined) count++
  if (filters.isCompulsoryBriefing !== undefined) count++
  if (filters.hasSpecialConditions !== undefined) count++
  if (filters.hasContactInfo !== undefined) count++
  if (filters.hasEmail !== undefined) count++
  if (filters.hasPhone !== undefined) count++

  return count
}