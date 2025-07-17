"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react"
import { format } from "date-fns"
import { 
  TenderFilters, 
  SortConfig, 
  SortField, 
  SearchField,
  FilterOptions,
  FilteredTendersResult,
} from "@/lib/hooks/use-tender-filters"

export interface AdvancedTenderFiltersProps {
  filters: TenderFilters
  sortConfig: SortConfig
  filteredResult: FilteredTendersResult
  onFiltersChange: (filters: Partial<TenderFilters>) => void
  onSortChange: (field: SortField, direction?: 'asc' | 'desc') => void
  onClearFilters: () => void
  onClearSearch: () => void
  className?: string
  showResultsCount?: boolean
  collapsible?: boolean
}

const SEARCH_FIELD_OPTIONS: { value: SearchField; label: string; description?: string }[] = [
  { value: 'all', label: 'All Fields', description: 'Search across all available information' },
  { value: 'title', label: 'Title', description: 'Search in tender titles only' },
  { value: 'description', label: 'Description', description: 'Search in descriptions and bid details' },
  { value: 'department', label: 'Department', description: 'Search in department names' },
  { value: 'procuringEntity', label: 'Procuring Entity', description: 'Search in organization names' },
  { value: 'location', label: 'Location', description: 'Search in delivery locations' },
  { value: 'contactPerson', label: 'Contact Person', description: 'Search in contact information' },
  { value: 'specialConditions', label: 'Special Conditions', description: 'Search in special requirements' },
]

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'closingDate', label: 'Closing Date' },
  { value: 'publishDate', label: 'Publish Date' },
  { value: 'title', label: 'Title' },
  { value: 'department', label: 'Department' },
  { value: 'value', label: 'Value' },
  { value: 'status', label: 'Status' },
]

export default function AdvancedTenderFilters({
  filters,
  sortConfig,
  filteredResult,
  onFiltersChange,
  onSortChange,
  onClearFilters,
  onClearSearch,
  className = "",
  showResultsCount = true,
  collapsible = true,
}: AdvancedTenderFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [savedSearches, setSavedSearches] = useState<Array<{name: string, query: string, fields: SearchField[]}>>([])
  const [showSavedSearches, setShowSavedSearches] = useState(false)

  // Generate search suggestions based on available data
  const generateSearchSuggestions = (query: string): string[] => {
    if (!query || query.length < 2) return []
    
    const suggestions = new Set<string>()
    const queryLower = query.toLowerCase()
    
    // Extract suggestions from filter options
    filteredResult.filterOptions.departments.forEach(dept => {
      if (dept.toLowerCase().includes(queryLower)) {
        suggestions.add(dept)
      }
    })
    
    filteredResult.filterOptions.categories.forEach(cat => {
      if (cat.toLowerCase().includes(queryLower)) {
        suggestions.add(cat)
      }
    })
    
    filteredResult.filterOptions.locations.forEach(loc => {
      if (loc.toLowerCase().includes(queryLower)) {
        suggestions.add(loc)
      }
    })
    
    // Add common search terms
    const commonTerms = [
      'construction', 'maintenance', 'supply', 'services', 'equipment',
      'software', 'hardware', 'consulting', 'training', 'security',
      'cleaning', 'catering', 'transport', 'medical', 'legal'
    ]
    
    commonTerms.forEach(term => {
      if (term.toLowerCase().includes(queryLower)) {
        suggestions.add(term)
      }
    })
    
    return Array.from(suggestions).slice(0, 8) // Limit to 8 suggestions
  }

  // Handle search query change with suggestions
  const handleSearchChange = (value: string) => {
    onFiltersChange({ searchQuery: value })
    
    // Generate and show suggestions
    if (value.length >= 2) {
      const suggestions = generateSearchSuggestions(value)
      setSearchSuggestions(suggestions)
      setShowSearchSuggestions(suggestions.length > 0)
    } else {
      setShowSearchSuggestions(false)
      setSearchSuggestions([])
    }
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    onFiltersChange({ searchQuery: suggestion })
    setShowSearchSuggestions(false)
    setSearchSuggestions([])
  }

  // Load saved searches from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('tender-saved-searches')
      if (saved) {
        setSavedSearches(JSON.parse(saved))
      }
    } catch (error) {
      console.warn('Failed to load saved searches:', error)
    }
  }, [])

  // Save current search
  const handleSaveSearch = () => {
    if (!filters.searchQuery.trim()) return
    
    const searchName = prompt('Enter a name for this search:')
    if (!searchName) return
    
    const newSearch = {
      name: searchName,
      query: filters.searchQuery,
      fields: filters.searchFields
    }
    
    const updatedSearches = [...savedSearches, newSearch]
    setSavedSearches(updatedSearches)
    
    try {
      localStorage.setItem('tender-saved-searches', JSON.stringify(updatedSearches))
    } catch (error) {
      console.warn('Failed to save search:', error)
    }
  }

  // Load saved search
  const handleLoadSearch = (search: {name: string, query: string, fields: SearchField[]}) => {
    onFiltersChange({ 
      searchQuery: search.query,
      searchFields: search.fields 
    })
    setShowSavedSearches(false)
  }

  // Delete saved search
  const handleDeleteSearch = (index: number) => {
    const updatedSearches = savedSearches.filter((_, i) => i !== index)
    setSavedSearches(updatedSearches)
    
    try {
      localStorage.setItem('tender-saved-searches', JSON.stringify(updatedSearches))
    } catch (error) {
      console.warn('Failed to delete search:', error)
    }
  }

  // Handle search fields change
  const handleSearchFieldsChange = (fields: SearchField[]) => {
    onFiltersChange({ searchFields: fields })
  }

  // Handle multi-select changes
  const handleMultiSelectChange = (
    key: keyof TenderFilters,
    value: string,
    checked: boolean
  ) => {
    const currentValues = (filters[key] as string[]) || []
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value)
    
    onFiltersChange({ [key]: newValues })
  }

  // Handle date changes
  const handleDateChange = (key: keyof TenderFilters, date: Date | undefined) => {
    onFiltersChange({ [key]: date ? date.toISOString().split('T')[0] : undefined })
  }

  // Handle boolean filter changes
  const handleBooleanChange = (key: keyof TenderFilters, value: boolean | undefined) => {
    onFiltersChange({ [key]: value })
  }

  // Handle number input changes
  const handleNumberChange = (key: keyof TenderFilters, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value)
    onFiltersChange({ [key]: numValue })
  }

  // Render multi-select filter
  const renderMultiSelectFilter = (
    title: string,
    key: keyof TenderFilters,
    options: string[]
  ) => {
    const selectedValues = (filters[key] as string[]) || []
    
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{title}</Label>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {options.map(option => (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                id={`${key}-${option}`}
                checked={selectedValues.includes(option)}
                onCheckedChange={(checked) => 
                  handleMultiSelectChange(key, option, checked as boolean)
                }
              />
              <Label 
                htmlFor={`${key}-${option}`}
                className="text-sm cursor-pointer flex-1"
              >
                {option}
              </Label>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render date filter
  const renderDateFilter = (
    title: string,
    key: keyof TenderFilters
  ) => {
    const value = filters[key] as string | undefined
    const date = value ? new Date(value) : undefined

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{title}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => handleDateChange(key, date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {date && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDateChange(key, undefined)}
            className="h-6 px-2 text-xs"
          >
            Clear
          </Button>
        )}
      </div>
    )
  }

  // Render boolean filter
  const renderBooleanFilter = (
    title: string,
    key: keyof TenderFilters,
    description?: string
  ) => {
    const value = filters[key] as boolean | undefined

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{title}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        <Select
          value={value === undefined ? 'any' : value.toString()}
          onValueChange={(val) => 
            handleBooleanChange(key, val === 'any' ? undefined : val === 'true')
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
            {filteredResult.appliedFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filteredResult.appliedFiltersCount} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showResultsCount && (
              <div className="text-sm text-muted-foreground">
                {filteredResult.filteredCount.toLocaleString()} of{' '}
                {filteredResult.totalCount.toLocaleString()} tenders
              </div>
            )}
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="space-y-2">
          <div className="flex gap-2 relative">
            <div className="flex-1 relative">
              <Input
                placeholder="Search tenders... (try 'construction', 'services', department names)"
                value={filters.searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (filters.searchQuery.length >= 2) {
                    const suggestions = generateSearchSuggestions(filters.searchQuery)
                    setSearchSuggestions(suggestions)
                    setShowSearchSuggestions(suggestions.length > 0)
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow for clicks
                  setTimeout(() => setShowSearchSuggestions(false), 200)
                }}
                className="pr-10"
              />
              
              {/* Search Suggestions Dropdown */}
              {showSearchSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground mb-2 px-2">Suggestions</div>
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded-sm transition-colors"
                        onClick={() => handleSuggestionSelect(suggestion)}
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur
                      >
                        <Search className="h-3 w-3 inline mr-2 text-muted-foreground" />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {filters.searchQuery && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveSearch}
                    className="px-3"
                    title="Save this search"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearSearch}
                    className="px-3"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
              {savedSearches.length > 0 && (
                <Popover open={showSavedSearches} onOpenChange={setShowSavedSearches}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-3"
                      title="Load saved search"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Saved Searches
                      </div>
                      {savedSearches.map((search, index) => (
                        <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-sm">
                          <button
                            className="flex-1 text-left text-sm truncate"
                            onClick={() => handleLoadSearch(search)}
                            title={`${search.name}: "${search.query}"`}
                          >
                            <div className="font-medium truncate">{search.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              "{search.query}"
                            </div>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSearch(index)}
                            className="h-6 w-6 p-0 ml-2"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* Search Fields Selection */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Search in:</Label>
              <div className="flex flex-wrap gap-1">
                {SEARCH_FIELD_OPTIONS.map(option => (
                  <Popover key={option.value}>
                    <PopoverTrigger asChild>
                      <Badge
                        variant={filters.searchFields.includes(option.value) ? "default" : "outline"}
                        className="cursor-pointer text-xs hover:bg-primary/80"
                        onClick={() => {
                          const newFields = filters.searchFields.includes(option.value)
                            ? filters.searchFields.filter(f => f !== option.value)
                            : [...filters.searchFields.filter(f => f !== 'all'), option.value]
                          
                          // If 'all' is selected, clear other selections
                          if (option.value === 'all') {
                            handleSearchFieldsChange(['all'])
                          } else {
                            handleSearchFieldsChange(newFields.length > 0 ? newFields : ['all'])
                          }
                        }}
                      >
                        {option.label}
                      </Badge>
                    </PopoverTrigger>
                    {option.description && (
                      <PopoverContent className="w-64 p-2" side="top">
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                ))}
              </div>
            </div>
            
            {/* Quick Search Filters */}
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Quick filters:</Label>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Construction', query: 'construction' },
                  { label: 'Services', query: 'services' },
                  { label: 'Supply', query: 'supply' },
                  { label: 'Maintenance', query: 'maintenance' },
                  { label: 'Consulting', query: 'consulting' },
                ].map(quickFilter => (
                  <Badge
                    key={quickFilter.query}
                    variant="outline"
                    className="cursor-pointer text-xs hover:bg-secondary"
                    onClick={() => handleSearchChange(quickFilter.query)}
                  >
                    {quickFilter.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Sort by:</Label>
          <Select
            value={sortConfig.field}
            onValueChange={(value) => onSortChange(value as SortField)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_FIELD_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSortChange(sortConfig.field, 
              sortConfig.direction === 'asc' ? 'desc' : 'asc'
            )}
          >
            {sortConfig.direction === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm"
          >
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
            {showAdvanced ? (
              <ArrowUp className="h-4 w-4 ml-2" />
            ) : (
              <ArrowDown className="h-4 w-4 ml-2" />
            )}
          </Button>
          
          {filteredResult.appliedFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-sm text-destructive hover:text-destructive"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Filters */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Date Filters</h4>
                {renderDateFilter("Published From", "dateFrom")}
                {renderDateFilter("Published To", "dateTo")}
                {renderDateFilter("Closing From", "closingDateFrom")}
                {renderDateFilter("Closing To", "closingDateTo")}
              </div>

              {/* Category Filters */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Categories</h4>
                {renderMultiSelectFilter("Categories", "categories", filteredResult.filterOptions.categories)}
                {renderMultiSelectFilter("Departments", "departments", filteredResult.filterOptions.departments)}
                {renderMultiSelectFilter("Status", "statuses", filteredResult.filterOptions.statuses)}
                {renderMultiSelectFilter("Locations", "locations", filteredResult.filterOptions.locations)}
              </div>

              {/* Value and Special Filters */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Value & Special Conditions</h4>
                
                {/* Value Range */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Value Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min value"
                      value={filters.minValue || ''}
                      onChange={(e) => handleNumberChange('minValue', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Max value"
                      value={filters.maxValue || ''}
                      onChange={(e) => handleNumberChange('maxValue', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Currency Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Currency</Label>
                  <Select
                    value={filters.currency || 'any'}
                    onValueChange={(value) => 
                      onFiltersChange({ currency: value === 'any' ? undefined : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Currency</SelectItem>
                      {filteredResult.filterOptions.currencies.map(currency => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Boolean Filters */}
                {renderBooleanFilter("Has Briefing Session", "hasBriefing", "Tenders that have briefing sessions")}
                {renderBooleanFilter("Compulsory Briefing", "isCompulsoryBriefing", "Briefing sessions that are mandatory")}
                {renderBooleanFilter("Has Special Conditions", "hasSpecialConditions", "Tenders with special conditions")}
                {renderBooleanFilter("Has Contact Info", "hasContactInfo", "Tenders with contact information")}
                {renderBooleanFilter("Has Email", "hasEmail", "Tenders with email contact")}
                {renderBooleanFilter("Has Phone", "hasPhone", "Tenders with phone contact")}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>