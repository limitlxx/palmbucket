'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ExtractedExpense, ExpenseRecord } from './types';

interface ExpenseFormProps {
  extractedData?: ExtractedExpense;
  onSubmit: (expense: Partial<ExpenseRecord>) => void;
  onCancel: () => void;
}

/**
 * ExpenseForm Component
 * 
 * Allows users to confirm and edit extracted expense data before submission.
 * 
 * Requirements: 1.4, 1.5, 3.2, 3.5
 */
export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  extractedData,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    date: extractedData?.date || new Date().toISOString().split('T')[0],
    amount: extractedData?.amount || 0,
    merchant: extractedData?.merchant || '',
    category: extractedData?.category || 'uncategorized',
    description: '',
    isBusinessExpense: false,
    businessPercentage: 0,
    paymentMethod: 'card' as const,
    tags: [] as string[],
    currency: 'USD' as string,
  });

  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [merchantSuggestions, setMerchantSuggestions] = useState<string[]>([]);
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  const [dateError, setDateError] = useState('');
  const [amountInUSD, setAmountInUSD] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(1);
  const merchantInputRef = useRef<HTMLInputElement>(null);

  // Mock data for merchant autocomplete (in real app, this would come from API/localStorage)
  const previousMerchants = [
    'Walmart', 'Target', 'Amazon', 'Starbucks', 'McDonald\'s', 'Shell', 'Exxon',
    'Home Depot', 'Best Buy', 'Costco', 'Kroger', 'CVS Pharmacy', 'Walgreens'
  ];

  // Available categories with option to add custom
  const defaultCategories = [
    'groceries', 'transportation', 'entertainment', 'bills', 'healthcare',
    'shopping', 'dining', 'travel', 'education', 'utilities', 'insurance',
    'maintenance', 'subscriptions', 'gifts', 'uncategorized'
  ];

  const [availableCategories, setAvailableCategories] = useState(defaultCategories);

  // Currency options
  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  ];

  // Date validation
  useEffect(() => {
    const selectedDate = new Date(formData.date);
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    if (selectedDate > today) {
      setDateError('Date cannot be in the future');
    } else if (selectedDate < oneYearAgo) {
      setDateError('Date cannot be more than one year ago');
    } else {
      setDateError('');
    }
  }, [formData.date]);

  // Currency conversion (mock implementation)
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (formData.currency === 'USD') {
        setExchangeRate(1);
        setAmountInUSD(formData.amount);
      } else {
        // Mock exchange rates (in real app, fetch from API)
        const mockRates: { [key: string]: number } = {
          'EUR': 1.1,
          'GBP': 1.25,
          'JPY': 0.0067,
          'CAD': 0.74,
          'AUD': 0.65,
        };
        const rate = mockRates[formData.currency] || 1;
        setExchangeRate(rate);
        setAmountInUSD(formData.amount * rate);
      }
    };

    fetchExchangeRate();
  }, [formData.amount, formData.currency]);

  // Merchant autocomplete
  const handleMerchantChange = (value: string) => {
    setFormData({ ...formData, merchant: value });
    
    if (value.length > 0) {
      const suggestions = previousMerchants.filter(merchant =>
        merchant.toLowerCase().includes(value.toLowerCase())
      );
      setMerchantSuggestions(suggestions);
      setShowMerchantSuggestions(suggestions.length > 0);
    } else {
      setShowMerchantSuggestions(false);
    }
  };

  const selectMerchant = (merchant: string) => {
    setFormData({ ...formData, merchant });
    setShowMerchantSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (dateError) {
      alert('Please fix the date error before submitting.');
      return;
    }
    
    const expenseData: Partial<ExpenseRecord> = {
      ...formData,
      amount: Number(formData.amount),
      date: new Date(formData.date),
      currency: formData.currency,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onSubmit(expenseData);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const addCustomCategory = () => {
    if (newCategory.trim() && !availableCategories.includes(newCategory.trim().toLowerCase())) {
      const categoryName = newCategory.trim().toLowerCase();
      setAvailableCategories([...availableCategories, categoryName]);
      setFormData({ ...formData, category: categoryName });
      setNewCategory('');
      setShowNewCategory(false);
    }
  };

  const formatCurrency = (amount: number, currencyCode: string) => {
    const currency = currencies.find(c => c.code === currencyCode);
    return `${currency?.symbol || '$'}${amount.toFixed(2)}`;
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-sm border">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        {extractedData ? 'Confirm Expense Details' : 'Add New Expense'}
      </h2>

      {extractedData && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Confidence:</strong> {Math.round(extractedData.confidence * 100)}%
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Please review and correct any extracted information below.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              required
              className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                dateError ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
            />
            {dateError && (
              <p className="mt-1 text-sm text-red-600">{dateError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            >
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount * ({formData.currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            />
            {formData.currency !== 'USD' && (
              <p className="mt-1 text-sm text-gray-500">
                ≈ {formatCurrency(amountInUSD, 'USD')} (Rate: {exchangeRate.toFixed(4)})
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
            >
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="crypto">Crypto</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Merchant *
          </label>
          <input
            ref={merchantInputRef}
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={formData.merchant}
            onChange={(e) => handleMerchantChange(e.target.value)}
            onFocus={() => {
              if (formData.merchant.length > 0) {
                const suggestions = previousMerchants.filter(merchant =>
                  merchant.toLowerCase().includes(formData.merchant.toLowerCase())
                );
                setMerchantSuggestions(suggestions);
                setShowMerchantSuggestions(suggestions.length > 0);
              }
            }}
            onBlur={() => {
              // Delay hiding suggestions to allow for clicks
              setTimeout(() => setShowMerchantSuggestions(false), 200);
            }}
            placeholder="Enter merchant name..."
          />
          
          {/* Merchant Suggestions Dropdown */}
          {showMerchantSuggestions && merchantSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
              {merchantSuggestions.map((merchant, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  onClick={() => selectMerchant(merchant)}
                >
                  {merchant}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <div className="space-y-2">
            <select
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={formData.category}
              onChange={(e) => {
                if (e.target.value === 'add-new') {
                  setShowNewCategory(true);
                } else {
                  setFormData({ ...formData, category: e.target.value });
                }
              }}
            >
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
              <option value="add-new">+ Add New Category</option>
            </select>
            
            {/* Custom Category Input */}
            {showNewCategory && (
              <div className="flex space-x-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Enter new category name..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCategory())}
                />
                <button
                  type="button"
                  onClick={addCustomCategory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategory('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description or notes..."
          />
        </div>

        {/* Business Expense */}
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="businessExpense"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={formData.isBusinessExpense}
              onChange={(e) => setFormData({ 
                ...formData, 
                isBusinessExpense: e.target.checked,
                businessPercentage: e.target.checked ? 100 : 0
              })}
            />
            <label htmlFor="businessExpense" className="ml-2 text-sm text-gray-700">
              This is a business expense
            </label>
          </div>

          {formData.isBusinessExpense && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Percentage
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={formData.businessPercentage}
                onChange={(e) => setFormData({ ...formData, businessPercentage: Number(e.target.value) })}
              />
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <div className="flex space-x-2 mb-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag..."
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
          >
            Save Expense
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};