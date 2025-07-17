/**
 * Comprehensive Data Aggregation Service
 * 
 * This service combines results from multiple API pages, implements
 * data deduplication and validation logic, and provides progress tracking.
 */

import { PageResult, BatchResult } from './concurrent-request-manager';

export interface AggregationResult {
  releases: any[];
  totalProcessed: number;
  duplicatesRemoved: number;
  validationErrors: ValidationError[];
  progress: ProgressInfo;
  metadata: AggregationMetadata;
}

export interface ProgressInfo {
  totalPages: number;
  processedPages: number;
  successfulPages: number;
  failedPages: number;
  percentage: number;
  estimatedTimeRemaining: number;
  currentPhase: 'fetching' | 'aggregating' | 'validating' | 'complete';
}

export interface ValidationError {
  releaseId: string;
  pageNumber: number;
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface AggregationMetadata {
  startTime: number;
  endTime?: number;
  totalProcessingTime?: number;
  averagePageProcessingTime: number;
  dataQualityScore: number;
  uniqueOcids: number;
  dateRange: {
    earliest?: string;
    latest?: string;
  };
}

export interface DeduplicationStats {
  totalReleases: number;
  uniqueReleases: number;
  duplicatesFound: number;
  duplicatesByOcid: Map<string, number>;
}

export class DataAggregationService {
  private releases: Map<string, any> = new Map(); // Using OCID as key for deduplication
  private validationErrors: ValidationError[] = [];
  private progressInfo: ProgressInfo;
  private metadata: AggregationMetadata;
  private pageProcessingTimes: number[] = [];

  constructor() {
    this.progressInfo = {
      totalPages: 0,
      processedPages: 0,
      successfulPages: 0,
      failedPages: 0,
      percentage: 0,
      estimatedTimeRemaining: 0,
      currentPhase: 'fetching',
    };

    this.metadata = {
      startTime: Date.now(),
      averagePageProcessingTime: 0,
      dataQualityScore: 100,
      uniqueOcids: 0,
      dateRange: {},
    };
  }

  /**
   * Initialize aggregation with total expected pages
   */
  initialize(totalPages: number): void {
    this.progressInfo.totalPages = totalPages;
    this.progressInfo.currentPhase = 'fetching';
    this.metadata.startTime = Date.now();
    
    console.log(`Initializing data aggregation for ${totalPages} pages`);
  }

  /**
   * Process a batch result and aggregate the data
   */
  async processBatchResult(batchResult: BatchResult): Promise<void> {
    const startTime = Date.now();
    this.progressInfo.currentPhase = 'aggregating';
    
    console.log(`Processing batch with ${batchResult.results.length} results`);
    
    // Process each page result
    for (const pageResult of batchResult.results) {
      await this.processPageResult(pageResult);
    }
    
    // Update progress
    this.updateProgress(batchResult);
    
    const processingTime = Date.now() - startTime;
    this.pageProcessingTimes.push(processingTime);
    this.updateMetadata();
    
    console.log(`Batch processed in ${processingTime}ms. Total unique releases: ${this.releases.size}`);
  }

  /**
   * Process a single page result
   */
  private async processPageResult(pageResult: PageResult): Promise<void> {
    if (!pageResult.success || !pageResult.releases) {
      this.progressInfo.failedPages++;
      return;
    }

    this.progressInfo.successfulPages++;
    
    // Process each release in the page
    for (const release of pageResult.releases) {
      await this.processRelease(release, pageResult.pageNumber);
    }
  }

  /**
   * Process and validate a single release
   */
  private async processRelease(release: any, pageNumber: number): Promise<void> {
    // Validate release structure
    const validationResult = this.validateRelease(release, pageNumber);
    
    if (validationResult.isValid) {
      // Use OCID as key for deduplication
      const ocid = release.ocid;
      
      if (this.releases.has(ocid)) {
        // Handle duplicate - keep the most recent or complete version
        const existing = this.releases.get(ocid);
        const updated = this.mergeDuplicateReleases(existing, release);
        this.releases.set(ocid, updated);
      } else {
        this.releases.set(ocid, release);
      }
      
      // Update date range metadata
      this.updateDateRange(release);
    } else {
      this.validationErrors.push(...validationResult.errors);
    }
  }

  /**
   * Validate a release object
   */
  private validateRelease(release: any, pageNumber: number): {
    isValid: boolean;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];
    
    // Check required fields
    if (!release.ocid) {
      errors.push({
        releaseId: 'unknown',
        pageNumber,
        field: 'ocid',
        message: 'Missing required field: ocid',
        severity: 'error',
      });
    }
    
    if (!release.tender) {
      errors.push({
        releaseId: release.ocid || 'unknown',
        pageNumber,
        field: 'tender',
        message: 'Missing required field: tender',
        severity: 'error',
      });
    }
    
    // Validate tender structure if present
    if (release.tender) {
      if (!release.tender.title) {
        errors.push({
          releaseId: release.ocid || 'unknown',
          pageNumber,
          field: 'tender.title',
          message: 'Missing tender title',
          severity: 'warning',
        });
      }
      
      if (!release.tender.tenderPeriod?.endDate) {
        errors.push({
          releaseId: release.ocid || 'unknown',
          pageNumber,
          field: 'tender.tenderPeriod.endDate',
          message: 'Missing tender end date',
          severity: 'warning',
        });
      }
    }
    
    // Validate date format
    if (release.date && !this.isValidDate(release.date)) {
      errors.push({
        releaseId: release.ocid || 'unknown',
        pageNumber,
        field: 'date',
        message: 'Invalid date format',
        severity: 'warning',
      });
    }
    
    // Consider valid if no critical errors (only warnings are acceptable)
    const isValid = !errors.some(error => error.severity === 'error');
    
    return { isValid, errors };
  }

  /**
   * Merge duplicate releases, keeping the most complete version
   */
  private mergeDuplicateReleases(existing: any, duplicate: any): any {
    // Simple merge strategy - prefer the release with more complete data
    const existingScore = this.calculateCompletenessScore(existing);
    const duplicateScore = this.calculateCompletenessScore(duplicate);
    
    // Return the more complete release
    return duplicateScore > existingScore ? duplicate : existing;
  }

  /**
   * Calculate completeness score for a release
   */
  private calculateCompletenessScore(release: any): number {
    let score = 0;
    
    // Basic fields
    if (release.ocid) score += 10;
    if (release.date) score += 5;
    if (release.tender?.title) score += 10;
    if (release.tender?.description) score += 5;
    if (release.tender?.tenderPeriod?.endDate) score += 10;
    if (release.tender?.value?.amount) score += 5;
    if (release.parties && release.parties.length > 0) score += 10;
    
    // Additional completeness indicators
    if (release.tender?.procurementMethod) score += 3;
    if (release.tender?.mainProcurementCategory) score += 3;
    if (release.tender?.eligibilityCriteria) score += 2;
    if (release.tender?.submissionMethod) score += 2;
    
    return score;
  }

  /**
   * Update date range metadata
   */
  private updateDateRange(release: any): void {
    const releaseDate = release.date;
    if (!releaseDate || !this.isValidDate(releaseDate)) {
      return;
    }
    
    if (!this.metadata.dateRange.earliest || releaseDate < this.metadata.dateRange.earliest) {
      this.metadata.dateRange.earliest = releaseDate;
    }
    
    if (!this.metadata.dateRange.latest || releaseDate > this.metadata.dateRange.latest) {
      this.metadata.dateRange.latest = releaseDate;
    }
  }

  /**
   * Update progress information
   */
  private updateProgress(batchResult: BatchResult): void {
    this.progressInfo.processedPages += batchResult.results.length;
    this.progressInfo.percentage = Math.round(
      (this.progressInfo.processedPages / this.progressInfo.totalPages) * 100
    );
    
    // Estimate time remaining
    if (this.pageProcessingTimes.length > 0) {
      const avgTime = this.pageProcessingTimes.reduce((sum, time) => sum + time, 0) / this.pageProcessingTimes.length;
      const remainingPages = this.progressInfo.totalPages - this.progressInfo.processedPages;
      this.progressInfo.estimatedTimeRemaining = Math.round(avgTime * remainingPages);
    }
  }

  /**
   * Update aggregation metadata
   */
  private updateMetadata(): void {
    this.metadata.uniqueOcids = this.releases.size;
    
    if (this.pageProcessingTimes.length > 0) {
      this.metadata.averagePageProcessingTime = 
        this.pageProcessingTimes.reduce((sum, time) => sum + time, 0) / this.pageProcessingTimes.length;
    }
    
    // Calculate data quality score
    const totalValidationIssues = this.validationErrors.length;
    const totalReleases = this.releases.size;
    const errorRate = totalReleases > 0 ? totalValidationIssues / totalReleases : 0;
    this.metadata.dataQualityScore = Math.max(0, Math.round(100 - (errorRate * 100)));
  }

  /**
   * Finalize aggregation and return results
   */
  async finalize(): Promise<AggregationResult> {
    this.progressInfo.currentPhase = 'validating';
    
    // Final validation pass
    await this.performFinalValidation();
    
    this.progressInfo.currentPhase = 'complete';
    this.progressInfo.percentage = 100;
    
    this.metadata.endTime = Date.now();
    this.metadata.totalProcessingTime = this.metadata.endTime - this.metadata.startTime;
    
    const releases = Array.from(this.releases.values());
    
    const result: AggregationResult = {
      releases,
      totalProcessed: this.progressInfo.processedPages,
      duplicatesRemoved: this.calculateDuplicatesRemoved(),
      validationErrors: this.validationErrors,
      progress: { ...this.progressInfo },
      metadata: { ...this.metadata },
    };
    
    console.log('Data aggregation completed:', {
      totalReleases: releases.length,
      duplicatesRemoved: result.duplicatesRemoved,
      validationErrors: this.validationErrors.length,
      dataQualityScore: this.metadata.dataQualityScore,
      processingTime: this.metadata.totalProcessingTime,
    });
    
    return result;
  }

  /**
   * Perform final validation on aggregated data
   */
  private async performFinalValidation(): Promise<void> {
    // Check for data consistency issues
    const releases = Array.from(this.releases.values());
    
    // Validate date consistency
    for (const release of releases) {
      if (release.tender?.tenderPeriod) {
        const startDate = release.tender.tenderPeriod.startDate;
        const endDate = release.tender.tenderPeriod.endDate;
        
        if (startDate && endDate && startDate > endDate) {
          this.validationErrors.push({
            releaseId: release.ocid,
            pageNumber: -1,
            field: 'tender.tenderPeriod',
            message: 'Tender start date is after end date',
            severity: 'warning',
          });
        }
      }
    }
  }

  /**
   * Calculate number of duplicates removed
   */
  private calculateDuplicatesRemoved(): number {
    // This would be tracked during processing in a real implementation
    // For now, return 0 as we're using Map which automatically handles duplicates
    return 0;
  }

  /**
   * Get current progress information
   */
  getProgress(): ProgressInfo {
    return { ...this.progressInfo };
  }

  /**
   * Get deduplication statistics
   */
  getDeduplicationStats(): DeduplicationStats {
    const duplicatesByOcid = new Map<string, number>();
    
    // In a real implementation, we'd track this during processing
    return {
      totalReleases: this.releases.size,
      uniqueReleases: this.releases.size,
      duplicatesFound: 0,
      duplicatesByOcid,
    };
  }

  /**
   * Validate date string format
   */
  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.includes('-');
  }

  /**
   * Reset aggregation state for reuse
   */
  reset(): void {
    this.releases.clear();
    this.validationErrors = [];
    this.pageProcessingTimes = [];
    
    this.progressInfo = {
      totalPages: 0,
      processedPages: 0,
      successfulPages: 0,
      failedPages: 0,
      percentage: 0,
      estimatedTimeRemaining: 0,
      currentPhase: 'fetching',
    };
    
    this.metadata = {
      startTime: Date.now(),
      averagePageProcessingTime: 0,
      dataQualityScore: 100,
      uniqueOcids: 0,
      dateRange: {},
    };
  }
}