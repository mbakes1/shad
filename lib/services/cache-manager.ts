/**
 * Intelligent Cache Manager
 * 
 * This service provides intelligent caching with TTL, invalidation strategies,
 * cache key generation, and performance metrics monitoring.
 */

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size in entries
  compressionEnabled: boolean;
  cleanupInterval: number; // Cleanup interval in milliseconds
  maxMemoryUsage: number; // Maximum memory usage in MB
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
  size: number; // Estimated size in bytes
  compressed: boolean;
  key: string;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number; // Total size in bytes
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  averageAccessTime: number;
  memoryUsage: number; // Memory usage in MB
  oldestEntry: number; // Timestamp of oldest entry
  newestEntry: number; // Timestamp of newest entry
  compressionRatio: number;
}

export interface CacheKeyOptions {
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
  maxConcurrency?: number;
  filters?: Record<string, any>;
  includeMetadata?: boolean;
}

export interface CacheInvalidationRule {
  pattern: string | RegExp;
  condition: 'time' | 'size' | 'access' | 'manual';
  threshold?: number;
  priority: number;
}

export class TenderCacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
    totalAccessTime: number;
    accessCount: number;
  };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private invalidationRules: CacheInvalidationRule[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: 5 * 60 * 1000, // 5 minutes default
      maxSize: 1000, // 1000 entries max
      compressionEnabled: true,
      cleanupInterval: 60 * 1000, // 1 minute cleanup interval
      maxMemoryUsage: 100, // 100MB max
      ...config,
    };

    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      totalAccessTime: 0,
      accessCount: 0,
    };

    // Start cleanup timer
    this.startCleanupTimer();

    // Set up default invalidation rules
    this.setupDefaultInvalidationRules();

    console.log('TenderCacheManager initialized:', {
      ttl: this.config.ttl,
      maxSize: this.config.maxSize,
      compressionEnabled: this.config.compressionEnabled,
      cleanupInterval: this.config.cleanupInterval,
    });
  }

  /**
   * Generate cache key based on request parameters
   */
  generateCacheKey(options: CacheKeyOptions): string {
    const keyParts: string[] = [];

    // Add date range
    if (options.dateFrom && options.dateTo) {
      keyParts.push(`dates:${options.dateFrom}-${options.dateTo}`);
    }

    // Add pagination info
    if (options.pageSize) {
      keyParts.push(`pageSize:${options.pageSize}`);
    }

    // Add concurrency info (affects data freshness)
    if (options.maxConcurrency) {
      keyParts.push(`concurrency:${options.maxConcurrency}`);
    }

    // Add filters
    if (options.filters && Object.keys(options.filters).length > 0) {
      const filterString = Object.entries(options.filters)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistent keys
        .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
        .join(',');
      keyParts.push(`filters:${filterString}`);
    }

    // Add metadata flag
    if (options.includeMetadata) {
      keyParts.push('metadata:true');
    }

    // Create hash for long keys
    const keyString = keyParts.join('|');
    if (keyString.length > 100) {
      return `hash:${this.hashString(keyString)}`;
    }

    return keyString || 'default';
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check TTL
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = now;
      this.stats.hits++;

      // Decompress if needed
      let data = entry.data;
      if (entry.compressed && this.config.compressionEnabled) {
        data = await this.decompress(entry.data);
      }

      return data;
    } finally {
      this.stats.totalAccessTime += Date.now() - startTime;
      this.stats.accessCount++;
    }
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, customTTL?: number): Promise<void> {
    const now = Date.now();
    const ttl = customTTL || this.config.ttl;
    
    // Estimate data size
    const dataSize = this.estimateSize(data);
    
    // Check memory limits
    if (this.shouldRejectDueToMemory(dataSize)) {
      console.warn('Cache entry rejected due to memory limits:', {
        key,
        size: dataSize,
        currentMemory: this.getCurrentMemoryUsage(),
        maxMemory: this.config.maxMemoryUsage,
      });
      return;
    }

    // Compress if enabled and data is large
    let finalData = data;
    let compressed = false;
    if (this.config.compressionEnabled && dataSize > 10000) { // 10KB threshold
      finalData = await this.compress(data);
      compressed = true;
    }

    const entry: CacheEntry<T> = {
      data: finalData,
      timestamp: now,
      accessCount: 0,
      lastAccessed: now,
      ttl,
      size: dataSize,
      compressed,
      key,
    };

    // Check size limits and evict if necessary
    if (this.cache.size >= this.config.maxSize) {
      await this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, entry);

    console.log('Cache entry set:', {
      key,
      size: dataSize,
      compressed,
      ttl,
      totalEntries: this.cache.size,
    });
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidate(pattern: string | RegExp): Promise<number> {
    let invalidatedCount = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    console.log('Cache invalidation completed:', {
      pattern: pattern.toString(),
      invalidatedCount,
      remainingEntries: this.cache.size,
    });

    return invalidatedCount;
  }

  /**
   * Invalidate cache entries by date range
   */
  async invalidateByDateRange(dateFrom: string, dateTo: string): Promise<number> {
    const pattern = new RegExp(`dates:${dateFrom}-${dateTo}`);
    return this.invalidate(pattern);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.stats.hits + this.stats.misses;
    
    const compressedEntries = entries.filter(e => e.compressed);
    const uncompressedSize = entries.reduce((sum, entry) => {
      return sum + (entry.compressed ? entry.size * 2 : entry.size); // Estimate
    }, 0);

    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      averageAccessTime: this.stats.accessCount > 0 
        ? this.stats.totalAccessTime / this.stats.accessCount 
        : 0,
      memoryUsage: this.getCurrentMemoryUsage(),
      oldestEntry: entries.length > 0 
        ? Math.min(...entries.map(e => e.timestamp)) 
        : 0,
      newestEntry: entries.length > 0 
        ? Math.max(...entries.map(e => e.timestamp)) 
        : 0,
      compressionRatio: uncompressedSize > 0 ? totalSize / uncompressedSize : 1,
    };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      totalAccessTime: 0,
      accessCount: 0,
    };

    console.log('Cache cleared:', { entriesCleared });
  }

  /**
   * Add invalidation rule
   */
  addInvalidationRule(rule: CacheInvalidationRule): void {
    this.invalidationRules.push(rule);
    this.invalidationRules.sort((a, b) => b.priority - a.priority);
    
    console.log('Invalidation rule added:', rule);
  }

  /**
   * Apply invalidation rules
   */
  async applyInvalidationRules(): Promise<number> {
    let totalInvalidated = 0;
    const now = Date.now();

    for (const rule of this.invalidationRules) {
      let invalidatedCount = 0;

      switch (rule.condition) {
        case 'time':
          if (rule.threshold) {
            for (const [key, entry] of this.cache.entries()) {
              if (now - entry.timestamp > rule.threshold) {
                const regex = typeof rule.pattern === 'string' 
                  ? new RegExp(rule.pattern) 
                  : rule.pattern;
                if (regex.test(key)) {
                  this.cache.delete(key);
                  invalidatedCount++;
                }
              }
            }
          }
          break;

        case 'access':
          if (rule.threshold) {
            for (const [key, entry] of this.cache.entries()) {
              if (now - entry.lastAccessed > rule.threshold) {
                const regex = typeof rule.pattern === 'string' 
                  ? new RegExp(rule.pattern) 
                  : rule.pattern;
                if (regex.test(key)) {
                  this.cache.delete(key);
                  invalidatedCount++;
                }
              }
            }
          }
          break;

        case 'size':
          if (rule.threshold && this.getCurrentMemoryUsage() > rule.threshold) {
            invalidatedCount = await this.invalidate(rule.pattern);
          }
          break;
      }

      totalInvalidated += invalidatedCount;
    }

    return totalInvalidated;
  }

  /**
   * Destroy cache manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.cache.clear();
    console.log('TenderCacheManager destroyed');
  }

  // Private methods

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanup();
    }, this.config.cleanupInterval);
  }

  private async cleanup(): Promise<void> {
    const startTime = Date.now();
    let cleanedCount = 0;
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    // Apply invalidation rules
    const ruleInvalidated = await this.applyInvalidationRules();
    cleanedCount += ruleInvalidated;

    // Check memory usage and evict if necessary
    while (this.getCurrentMemoryUsage() > this.config.maxMemoryUsage) {
      const evicted = await this.evictLeastRecentlyUsed();
      if (!evicted) break; // No more entries to evict
      cleanedCount++;
    }

    const cleanupTime = Date.now() - startTime;
    
    if (cleanedCount > 0) {
      console.log('Cache cleanup completed:', {
        cleanedCount,
        remainingEntries: this.cache.size,
        cleanupTime,
        memoryUsage: this.getCurrentMemoryUsage(),
      });
    }
  }

  private async evictLeastRecentlyUsed(): Promise<boolean> {
    if (this.cache.size === 0) return false;

    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      return true;
    }

    return false;
  }

  private setupDefaultInvalidationRules(): void {
    // Rule 1: Invalidate entries older than 1 hour
    this.addInvalidationRule({
      pattern: '.*',
      condition: 'time',
      threshold: 60 * 60 * 1000, // 1 hour
      priority: 1,
    });

    // Rule 2: Invalidate unused entries after 30 minutes
    this.addInvalidationRule({
      pattern: '.*',
      condition: 'access',
      threshold: 30 * 60 * 1000, // 30 minutes
      priority: 2,
    });

    // Rule 3: Invalidate all entries if memory usage exceeds 80MB
    this.addInvalidationRule({
      pattern: '.*',
      condition: 'size',
      threshold: 80, // 80MB
      priority: 3,
    });
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1000; // Default estimate
    }
  }

  private getCurrentMemoryUsage(): number {
    const entries = Array.from(this.cache.values());
    const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
    return totalBytes / (1024 * 1024); // Convert to MB
  }

  private shouldRejectDueToMemory(dataSize: number): boolean {
    const currentUsage = this.getCurrentMemoryUsage();
    const newDataSizeMB = dataSize / (1024 * 1024);
    return (currentUsage + newDataSizeMB) > this.config.maxMemoryUsage;
  }

  private async compress(data: any): Promise<string> {
    // Simple compression using JSON stringify + base64
    // In production, you might want to use a proper compression library
    try {
      const jsonString = JSON.stringify(data);
      return Buffer.from(jsonString).toString('base64');
    } catch {
      return JSON.stringify(data);
    }
  }

  private async decompress(compressedData: string): Promise<any> {
    try {
      const jsonString = Buffer.from(compressedData, 'base64').toString();
      return JSON.parse(jsonString);
    } catch {
      return compressedData;
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Singleton instance for global use
let globalCacheManager: TenderCacheManager | null = null;

export function getCacheManager(config?: Partial<CacheConfig>): TenderCacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new TenderCacheManager(config);
  }
  return globalCacheManager;
}

export function destroyCacheManager(): void {
  if (globalCacheManager) {
    globalCacheManager.destroy();
    globalCacheManager = null;
  }
}