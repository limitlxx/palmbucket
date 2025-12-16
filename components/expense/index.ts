// Expense Management System Components
export { ExpenseUpload } from './ExpenseUpload';
export { ExpenseList } from './ExpenseList';
export { ExpenseAnalytics } from './ExpenseAnalytics';
export { ExpenseForm } from './ExpenseForm';
export { CategoryManager } from './CategoryManager';

// OCR and Processing
export { TesseractProcessor } from './ocr/TesseractProcessor';
export { ImagePreprocessor } from './ocr/ImagePreprocessor';

// Storage
export { IPFSClient } from './storage/IPFSClient';
export { ExpenseStorage } from './storage/ExpenseStorage';

// Analytics
export { SpendingAnalyzer } from './analytics/SpendingAnalyzer';
export { BudgetOptimizer } from './analytics/BudgetOptimizer';

// Types
export * from './types';

// Test utilities (for development and testing)
export * from './__tests__/test-utils';
export * from './__tests__/mock-data';