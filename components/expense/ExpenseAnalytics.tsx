'use client';

import React from 'react';
import { ExpenseAnalyticsProps } from './types';

/**
 * ExpenseAnalytics Component
 * 
 * Displays spending analytics and budget optimization suggestions.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.3
 */
export const ExpenseAnalytics: React.FC<ExpenseAnalyticsProps> = ({
  expenses,
  bucketAllocations,
  onOptimizationSuggestion,
}) => {
  // Calculate basic analytics
  const totalSpending = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categoryTotals = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="w-full space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Total Spending</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${totalSpending.toFixed(2)}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Transactions</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {expenses.length}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Average Transaction</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${expenses.length > 0 ? (totalSpending / expenses.length).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Spending by Category</h3>
        <div className="space-y-3">
          {topCategories.map(([category, amount]) => {
            const percentage = (amount / totalSpending) * 100;
            return (
              <div key={category} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {category}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-16 text-right">
                    ${amount.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Budget Optimization */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Optimization</h3>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Based on your spending patterns, here are your current bucket allocations:
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {bucketAllocations.map((bucket) => (
              <div key={bucket.bucket} className="text-center">
                <div className="text-sm font-medium text-gray-900 capitalize">
                  {bucket.bucket}
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {bucket.percentage}%
                </div>
              </div>
            ))}
          </div>

          <button
            className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            onClick={() => {
              // TODO: Implement actual optimization logic in task 8
              const mockOptimization = {
                currentRatios: bucketAllocations,
                suggestedRatios: bucketAllocations.map(bucket => ({
                  ...bucket,
                  percentage: bucket.percentage + (Math.random() - 0.5) * 10
                })),
                reasoning: 'Based on your spending patterns, we suggest adjusting your allocations.',
                expectedImprovement: 15.5
              };
              onOptimizationSuggestion(mockOptimization);
            }}
          >
            Generate Optimization Suggestions
          </button>
        </div>
      </div>

      {/* Monthly Trends Placeholder */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Trends</h3>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Chart visualization will be implemented in task 7</p>
        </div>
      </div>
    </div>
  );
};