'use client';

import React from 'react';
import { ExpenseListProps } from './types';

/**
 * ExpenseList Component
 * 
 * Displays a list of expenses with filtering and search capabilities.
 * 
 * Requirements: 3.3, 3.4
 */
export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  filters,
  onFilterChange,
}) => {
  return (
    <div className="w-full space-y-4">
      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h3 className="text-lg font-medium mb-3">Filter Expenses</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <div className="space-y-2">
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={filters.dateRange.start.toISOString().split('T')[0]}
                onChange={(e) => onFilterChange({
                  ...filters,
                  dateRange: {
                    ...filters.dateRange,
                    start: new Date(e.target.value)
                  }
                })}
              />
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={filters.dateRange.end.toISOString().split('T')[0]}
                onChange={(e) => onFilterChange({
                  ...filters,
                  dateRange: {
                    ...filters.dateRange,
                    end: new Date(e.target.value)
                  }
                })}
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categories
            </label>
            <select
              multiple
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={filters.categories}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                onFilterChange({
                  ...filters,
                  categories: selected
                });
              }}
            >
              <option value="groceries">Groceries</option>
              <option value="transportation">Transportation</option>
              <option value="entertainment">Entertainment</option>
              <option value="bills">Bills</option>
              <option value="healthcare">Healthcare</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Search merchant or description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={filters.searchText}
              onChange={(e) => onFilterChange({
                ...filters,
                searchText: e.target.value
              })}
            />
          </div>
        </div>
      </div>

      {/* Expense List */}
      <div className="space-y-2">
        {expenses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No expenses found matching your filters.</p>
            <p className="text-sm mt-1">Try adjusting your search criteria.</p>
          </div>
        ) : (
          expenses.map((expense) => (
            <div
              key={expense.id}
              className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">{expense.merchant}</h4>
                    <span className={`
                      px-2 py-1 text-xs rounded-full
                      ${expense.isBusinessExpense 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                      }
                    `}>
                      {expense.isBusinessExpense ? 'Business' : 'Personal'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{expense.category}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {expense.date.toLocaleDateString()} • {expense.paymentMethod}
                  </p>
                  {expense.description && (
                    <p className="text-sm text-gray-600 mt-2">{expense.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">
                    ${expense.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">{expense.currency}</p>
                </div>
              </div>
              
              {/* Tags */}
              {expense.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {expense.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};