import { ExpenseRecord, Category, ExtractedExpense } from '../types';

/**
 * Test utilities for expense management components
 */

/**
 * Create a mock expense record for testing
 */
export function createMockExpense(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
  const baseExpense: ExpenseRecord = {
    id: `expense-${Math.random().toString(36).substring(2, 9)}`,
    userId: 'test-user',
    amount: 25.99,
    currency: 'USD',
    date: new Date('2024-01-15'),
    merchant: 'Test Merchant',
    category: 'groceries',
    description: 'Test expense',
    receiptHash: `hash-${Math.random().toString(36).substring(2, 9)}`,
    ipfsHash: `ipfs-${Math.random().toString(36).substring(2, 9)}`,
    isBusinessExpense: false,
    businessPercentage: 0,
    tags: ['test'],
    paymentMethod: 'card',
    confidence: 0.95,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  };

  return { ...baseExpense, ...overrides };
}

/**
 * Create multiple mock expenses
 */
export function createMockExpenses(count: number): ExpenseRecord[] {
  const categories = ['groceries', 'transportation', 'entertainment', 'bills', 'healthcare'];
  const merchants = ['Grocery Store', 'Gas Station', 'Restaurant', 'Utility Company', 'Pharmacy'];
  const paymentMethods: ('card' | 'cash' | 'crypto' | 'other')[] = ['card', 'cash', 'crypto', 'other'];

  return Array.from({ length: count }, (_, index) => {
    const category = categories[index % categories.length];
    const merchant = merchants[index % merchants.length];
    const paymentMethod = paymentMethods[index % paymentMethods.length];
    
    return createMockExpense({
      id: `expense-${index + 1}`,
      amount: Math.round((Math.random() * 100 + 10) * 100) / 100,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
      merchant,
      category,
      paymentMethod,
      isBusinessExpense: Math.random() > 0.7, // 30% chance of business expense
      businessPercentage: Math.random() > 0.7 ? Math.floor(Math.random() * 100) : 0,
    });
  });
}

/**
 * Create a mock category for testing
 */
export function createMockCategory(overrides: Partial<Category> = {}): Category {
  const baseCategory: Category = {
    id: `category-${Math.random().toString(36).substring(2, 9)}`,
    name: 'Test Category',
    color: '#3B82F6',
    icon: '📁',
    keywords: ['test', 'mock'],
    merchantPatterns: [/test/i],
    isDefault: false,
    bucketMapping: 'spendable',
  };

  return { ...baseCategory, ...overrides };
}

/**
 * Create mock extracted expense data
 */
export function createMockExtractedExpense(overrides: Partial<ExtractedExpense> = {}): ExtractedExpense {
  const baseExtracted: ExtractedExpense = {
    date: new Date().toISOString().split('T')[0],
    amount: 25.99,
    merchant: 'Test Merchant',
    category: 'groceries',
    confidence: 0.85,
    rawText: 'Mock OCR text from receipt',
  };

  return { ...baseExtracted, ...overrides };
}

/**
 * Create mock file for testing file uploads
 */
export function createMockFile(
  name: string = 'test-receipt.jpg',
  type: string = 'image/jpeg',
  size: number = 1024 * 1024 // 1MB
): File {
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
}

/**
 * Create mock image data for canvas testing
 */
export function createMockImageData(width: number = 100, height: number = 100): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  
  // Fill with random pixel data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 256);     // Red
    data[i + 1] = Math.floor(Math.random() * 256); // Green
    data[i + 2] = Math.floor(Math.random() * 256); // Blue
    data[i + 3] = 255;                             // Alpha
  }

  return new ImageData(data, width, height);
}

/**
 * Mock localStorage for testing
 */
export class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

/**
 * Mock canvas context for testing
 */
export class MockCanvasContext {
  canvas = {
    width: 100,
    height: 100,
  };

  getImageData(x: number, y: number, width: number, height: number): ImageData {
    return createMockImageData(width, height);
  }

  putImageData(imageData: ImageData, x: number, y: number): void {
    // Mock implementation
  }

  drawImage(...args: any[]): void {
    // Mock implementation
  }

  translate(x: number, y: number): void {
    // Mock implementation
  }

  rotate(angle: number): void {
    // Mock implementation
  }
}

/**
 * Wait for a specified amount of time (useful for testing async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock promise that resolves after a delay
 */
export function createDelayedPromise<T>(value: T, delay: number = 100): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), delay);
  });
}

/**
 * Create a mock promise that rejects after a delay
 */
export function createDelayedRejection(error: Error, delay: number = 100): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(error), delay);
  });
}