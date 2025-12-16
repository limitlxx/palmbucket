// Core expense data models based on design document

export interface ExpenseRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  date: Date;
  merchant: string;
  category: string;
  subcategory?: string;
  description?: string;
  receiptHash: string;
  ipfsHash: string;
  isBusinessExpense: boolean;
  businessPercentage: number;
  tags: string[];
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  paymentMethod: 'cash' | 'card' | 'crypto' | 'other';
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedExpense {
  date: string;
  amount: number;
  merchant: string;
  category: string;
  confidence: number;
  rawText: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  color: string;
  icon: string;
  keywords: string[];
  merchantPatterns: RegExp[];
  isDefault: boolean;
  bucketMapping: 'bills' | 'savings' | 'growth' | 'spendable';
}

export interface ExpenseFilters {
  dateRange: { start: Date; end: Date };
  categories: string[];
  amountRange: { min: number; max: number };
  searchText: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  extractedData: ExtractedExpense;
  processingTime: number;
}

export interface SpendingAnalysis {
  totalSpending: number;
  categoryBreakdown: CategorySpending[];
  monthlyTrends: MonthlySpending[];
  budgetVariance: BudgetVariance[];
  topMerchants: MerchantSpending[];
  averageTransactionSize: number;
  spendingFrequency: number;
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface MonthlySpending {
  month: string;
  year: number;
  totalAmount: number;
  categoryBreakdown: CategorySpending[];
}

export interface BudgetVariance {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentageVariance: number;
}

export interface MerchantSpending {
  merchant: string;
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  categories: string[];
}

export interface BudgetOptimization {
  currentAllocation: BucketRatio[];
  actualSpending: CategorySpending[];
  suggestedAllocation: BucketRatio[];
  potentialSavings: number;
  riskAssessment: 'low' | 'medium' | 'high';
  confidence: number;
  reasoning: string[];
}

export interface BucketRatio {
  bucket: 'bills' | 'savings' | 'growth' | 'spendable';
  percentage: number;
}

export interface SplitOptimization {
  currentRatios: BucketRatio[];
  suggestedRatios: BucketRatio[];
  reasoning: string;
  expectedImprovement: number;
}

// Component Props Interfaces
export interface ExpenseUploadProps {
  onExpenseExtracted: (expense: ExtractedExpense) => void;
  onUploadComplete: (receiptHash: string) => void;
}

export interface ExpenseListProps {
  expenses: ExpenseRecord[];
  filters: ExpenseFilters;
  onFilterChange: (filters: ExpenseFilters) => void;
}

export interface ExpenseAnalyticsProps {
  expenses: ExpenseRecord[];
  bucketAllocations: BucketRatio[];
  onOptimizationSuggestion: (suggestion: SplitOptimization) => void;
}

// OCR Processing Interfaces
export interface OCRProcessor {
  processReceipt(imageFile: File): Promise<OCRResult>;
  enhanceImage(imageData: ImageData): ImageData;
  extractExpenseData(text: string): ExtractedExpense;
}

// IPFS Storage Interface
export interface IPFSClient {
  uploadEncrypted(file: File, encryptionKey: string): Promise<string>;
  downloadDecrypted(hash: string, encryptionKey: string): Promise<File>;
  deleteContent(hash: string): Promise<boolean>;
}

// Smart Contract Types (matching Solidity structs)
export interface ExpenseRecordContract {
  amount: bigint;
  timestamp: bigint;
  merchant: string;
  category: string;
  receiptHash: string;
  isBusinessExpense: boolean;
  businessPercentage: number;
}

export interface ExpenseEvent {
  user: string;
  expenseId: bigint;
  amount: bigint;
  timestamp: bigint;
  merchant: string;
  category: string;
  receiptHash: string;
}