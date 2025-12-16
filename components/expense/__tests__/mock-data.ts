import { ExpenseRecord, Category, BucketRatio } from '../types';

/**
 * Mock data for testing expense management functionality
 */

export const mockExpenses: ExpenseRecord[] = [
  {
    id: '1',
    userId: 'user-123',
    amount: 45.67,
    currency: 'USD',
    date: new Date('2024-01-15T10:30:00Z'),
    merchant: 'Whole Foods Market',
    category: 'groceries',
    description: 'Weekly grocery shopping',
    receiptHash: 'hash-grocery-001',
    ipfsHash: 'QmGrocery001',
    isBusinessExpense: false,
    businessPercentage: 0,
    tags: ['food', 'weekly', 'organic'],
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Market St, San Francisco, CA'
    },
    paymentMethod: 'card',
    confidence: 0.95,
    createdAt: new Date('2024-01-15T10:35:00Z'),
    updatedAt: new Date('2024-01-15T10:35:00Z'),
  },
  {
    id: '2',
    userId: 'user-123',
    amount: 52.30,
    currency: 'USD',
    date: new Date('2024-01-16T14:20:00Z'),
    merchant: 'Shell Gas Station',
    category: 'transportation',
    description: 'Fuel for business trip',
    receiptHash: 'hash-gas-002',
    ipfsHash: 'QmGas002',
    isBusinessExpense: true,
    businessPercentage: 100,
    tags: ['fuel', 'business', 'travel'],
    paymentMethod: 'card',
    confidence: 0.92,
    createdAt: new Date('2024-01-16T14:25:00Z'),
    updatedAt: new Date('2024-01-16T14:25:00Z'),
  },
  {
    id: '3',
    userId: 'user-123',
    amount: 28.99,
    currency: 'USD',
    date: new Date('2024-01-17T19:45:00Z'),
    merchant: 'Netflix',
    category: 'entertainment',
    description: 'Monthly subscription',
    receiptHash: 'hash-netflix-003',
    ipfsHash: 'QmNetflix003',
    isBusinessExpense: false,
    businessPercentage: 0,
    tags: ['subscription', 'streaming', 'monthly'],
    paymentMethod: 'card',
    confidence: 0.98,
    createdAt: new Date('2024-01-17T19:50:00Z'),
    updatedAt: new Date('2024-01-17T19:50:00Z'),
  },
  {
    id: '4',
    userId: 'user-123',
    amount: 125.00,
    currency: 'USD',
    date: new Date('2024-01-18T09:15:00Z'),
    merchant: 'PG&E',
    category: 'bills',
    description: 'Monthly electricity bill',
    receiptHash: 'hash-pge-004',
    ipfsHash: 'QmPGE004',
    isBusinessExpense: false,
    businessPercentage: 0,
    tags: ['utility', 'monthly', 'electricity'],
    paymentMethod: 'card',
    confidence: 0.99,
    createdAt: new Date('2024-01-18T09:20:00Z'),
    updatedAt: new Date('2024-01-18T09:20:00Z'),
  },
  {
    id: '5',
    userId: 'user-123',
    amount: 15.75,
    currency: 'USD',
    date: new Date('2024-01-19T12:30:00Z'),
    merchant: 'Starbucks',
    category: 'dining',
    description: 'Coffee and pastry',
    receiptHash: 'hash-starbucks-005',
    ipfsHash: 'QmStarbucks005',
    isBusinessExpense: true,
    businessPercentage: 50,
    tags: ['coffee', 'meeting', 'business'],
    paymentMethod: 'card',
    confidence: 0.88,
    createdAt: new Date('2024-01-19T12:35:00Z'),
    updatedAt: new Date('2024-01-19T12:35:00Z'),
  },
];

export const mockCategories: Category[] = [
  {
    id: 'cat-1',
    name: 'Groceries',
    parentId: undefined,
    color: '#10B981',
    icon: '🛒',
    keywords: ['grocery', 'food', 'market', 'supermarket'],
    merchantPatterns: [
      /whole foods/i,
      /safeway/i,
      /trader joe/i,
      /costco/i,
      /walmart/i,
    ],
    isDefault: true,
    bucketMapping: 'spendable',
  },
  {
    id: 'cat-2',
    name: 'Transportation',
    parentId: undefined,
    color: '#3B82F6',
    icon: '🚗',
    keywords: ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'parking'],
    merchantPatterns: [
      /shell/i,
      /chevron/i,
      /uber/i,
      /lyft/i,
      /parking/i,
    ],
    isDefault: true,
    bucketMapping: 'spendable',
  },
  {
    id: 'cat-3',
    name: 'Entertainment',
    parentId: undefined,
    color: '#8B5CF6',
    icon: '🎬',
    keywords: ['movie', 'netflix', 'spotify', 'game', 'entertainment'],
    merchantPatterns: [
      /netflix/i,
      /spotify/i,
      /amazon prime/i,
      /theater/i,
      /cinema/i,
    ],
    isDefault: true,
    bucketMapping: 'spendable',
  },
  {
    id: 'cat-4',
    name: 'Bills',
    parentId: undefined,
    color: '#EF4444',
    icon: '📄',
    keywords: ['utility', 'electric', 'gas', 'water', 'internet', 'phone'],
    merchantPatterns: [
      /pg&e/i,
      /comcast/i,
      /verizon/i,
      /at&t/i,
      /utility/i,
    ],
    isDefault: true,
    bucketMapping: 'bills',
  },
  {
    id: 'cat-5',
    name: 'Healthcare',
    parentId: undefined,
    color: '#F59E0B',
    icon: '🏥',
    keywords: ['doctor', 'pharmacy', 'medical', 'health', 'prescription'],
    merchantPatterns: [
      /cvs/i,
      /walgreens/i,
      /kaiser/i,
      /medical/i,
      /pharmacy/i,
    ],
    isDefault: true,
    bucketMapping: 'spendable',
  },
  {
    id: 'cat-6',
    name: 'Dining',
    parentId: undefined,
    color: '#F97316',
    icon: '🍽️',
    keywords: ['restaurant', 'cafe', 'coffee', 'dining', 'food'],
    merchantPatterns: [
      /starbucks/i,
      /mcdonald/i,
      /restaurant/i,
      /cafe/i,
      /pizza/i,
    ],
    isDefault: true,
    bucketMapping: 'spendable',
  },
];

export const mockBucketRatios: BucketRatio[] = [
  { bucket: 'bills', percentage: 40 },
  { bucket: 'savings', percentage: 20 },
  { bucket: 'growth', percentage: 15 },
  { bucket: 'spendable', percentage: 25 },
];

export const mockReceiptTexts = {
  grocery: `
    WHOLE FOODS MARKET
    123 Market Street
    San Francisco, CA 94102
    
    Date: 01/15/2024
    Time: 10:30 AM
    
    Organic Bananas      $3.99
    Almond Milk          $4.50
    Bread - Whole Wheat  $5.99
    Spinach - Organic    $4.99
    
    Subtotal            $19.47
    Tax                  $1.75
    
    TOTAL               $21.22
    
    Card Payment        $21.22
    
    Thank you for shopping!
  `,
  
  gas: `
    SHELL
    456 Highway 101
    San Francisco, CA
    
    01/16/2024 2:20 PM
    
    Pump #3
    Regular Unleaded
    
    Gallons: 12.5
    Price/Gal: $4.18
    
    TOTAL: $52.25
    
    Payment: VISA ****1234
    
    Thank you!
  `,
  
  restaurant: `
    STARBUCKS COFFEE
    789 Union Square
    San Francisco, CA
    
    Store #1234
    01/19/2024 12:30 PM
    
    Grande Latte         $5.25
    Blueberry Muffin     $3.50
    
    Subtotal             $8.75
    Tax                  $0.79
    
    TOTAL                $9.54
    
    VISA ****5678        $9.54
    
    Thank you!
  `,
};

export const mockOCRResults = {
  high_confidence: {
    text: mockReceiptTexts.grocery,
    confidence: 0.95,
    extractedData: {
      date: '2024-01-15',
      amount: 21.22,
      merchant: 'Whole Foods Market',
      category: 'groceries',
      confidence: 0.95,
      rawText: mockReceiptTexts.grocery,
    },
    processingTime: 1250,
  },
  
  medium_confidence: {
    text: mockReceiptTexts.gas,
    confidence: 0.78,
    extractedData: {
      date: '2024-01-16',
      amount: 52.25,
      merchant: 'Shell',
      category: 'transportation',
      confidence: 0.78,
      rawText: mockReceiptTexts.gas,
    },
    processingTime: 1850,
  },
  
  low_confidence: {
    text: 'Blurry text... $15.99... 01/20/2024...',
    confidence: 0.45,
    extractedData: {
      date: '2024-01-20',
      amount: 15.99,
      merchant: 'Unknown Merchant',
      category: 'uncategorized',
      confidence: 0.45,
      rawText: 'Blurry text... $15.99... 01/20/2024...',
    },
    processingTime: 2100,
  },
};

export const mockSpendingAnalysis = {
  totalSpending: 267.71,
  categoryBreakdown: [
    {
      category: 'bills',
      amount: 125.00,
      percentage: 46.7,
      transactionCount: 1,
      averageAmount: 125.00,
      trend: 'stable' as const,
    },
    {
      category: 'transportation',
      amount: 52.30,
      percentage: 19.5,
      transactionCount: 1,
      averageAmount: 52.30,
      trend: 'stable' as const,
    },
    {
      category: 'groceries',
      amount: 45.67,
      percentage: 17.1,
      transactionCount: 1,
      averageAmount: 45.67,
      trend: 'stable' as const,
    },
    {
      category: 'entertainment',
      amount: 28.99,
      percentage: 10.8,
      transactionCount: 1,
      averageAmount: 28.99,
      trend: 'stable' as const,
    },
    {
      category: 'dining',
      amount: 15.75,
      percentage: 5.9,
      transactionCount: 1,
      averageAmount: 15.75,
      trend: 'stable' as const,
    },
  ],
  monthlyTrends: [
    {
      month: 'January',
      year: 2024,
      totalAmount: 267.71,
      categoryBreakdown: [
        {
          category: 'bills',
          amount: 125.00,
          percentage: 46.7,
          transactionCount: 1,
          averageAmount: 125.00,
          trend: 'stable' as const,
        },
      ],
    },
  ],
  budgetVariance: [
    {
      category: 'bills',
      budgeted: 800,
      actual: 125.00,
      variance: -675.00,
      percentageVariance: -84.4,
    },
  ],
  topMerchants: [
    {
      merchant: 'PG&E',
      totalAmount: 125.00,
      transactionCount: 1,
      averageAmount: 125.00,
      categories: ['bills'],
    },
  ],
  averageTransactionSize: 53.54,
  spendingFrequency: 1.25,
};