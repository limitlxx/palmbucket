import { 
  ExpenseRecord, 
  SpendingAnalysis, 
  CategorySpending, 
  MonthlySpending, 
  BudgetVariance, 
  MerchantSpending 
} from '../types';

/**
 * SpendingAnalyzer Class
 * 
 * Analyzes spending patterns and generates insights.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export class SpendingAnalyzer {
  /**
   * Generate comprehensive spending analysis
   */
  static analyzeSpending(expenses: ExpenseRecord[]): SpendingAnalysis {
    const totalSpending = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    return {
      totalSpending,
      categoryBreakdown: this.analyzeCategorySpending(expenses),
      monthlyTrends: this.analyzeMonthlyTrends(expenses),
      budgetVariance: this.calculateBudgetVariance(expenses),
      topMerchants: this.analyzeTopMerchants(expenses),
      averageTransactionSize: totalSpending / (expenses.length || 1),
      spendingFrequency: this.calculateSpendingFrequency(expenses),
    };
  }

  /**
   * Analyze spending by category
   */
  private static analyzeCategorySpending(expenses: ExpenseRecord[]): CategorySpending[] {
    const categoryTotals: Record<string, {
      amount: number;
      count: number;
      transactions: ExpenseRecord[];
    }> = {};

    // Group expenses by category
    expenses.forEach(expense => {
      if (!categoryTotals[expense.category]) {
        categoryTotals[expense.category] = {
          amount: 0,
          count: 0,
          transactions: [],
        };
      }
      categoryTotals[expense.category].amount += expense.amount;
      categoryTotals[expense.category].count += 1;
      categoryTotals[expense.category].transactions.push(expense);
    });

    const totalSpending = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Convert to CategorySpending format
    return Object.entries(categoryTotals).map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: (data.amount / totalSpending) * 100,
      transactionCount: data.count,
      averageAmount: data.amount / data.count,
      trend: this.calculateCategoryTrend(data.transactions),
    })).sort((a, b) => b.amount - a.amount);
  }

  /**
   * Calculate spending trend for a category
   */
  private static calculateCategoryTrend(transactions: ExpenseRecord[]): 'increasing' | 'decreasing' | 'stable' {
    if (transactions.length < 2) return 'stable';

    // Sort by date
    const sorted = transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Compare first half vs second half
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    const firstHalfAvg = firstHalf.reduce((sum, t) => sum + t.amount, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, t) => sum + t.amount, 0) / secondHalf.length;

    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Analyze monthly spending trends
   */
  private static analyzeMonthlyTrends(expenses: ExpenseRecord[]): MonthlySpending[] {
    const monthlyData: Record<string, ExpenseRecord[]> = {};

    // Group expenses by month
    expenses.forEach(expense => {
      const monthKey = `${expense.date.getFullYear()}-${expense.date.getMonth() + 1}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = [];
      }
      monthlyData[monthKey].push(expense);
    });

    // Convert to MonthlySpending format
    return Object.entries(monthlyData).map(([monthKey, monthExpenses]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      
      return {
        month: monthName,
        year,
        totalAmount: monthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
        categoryBreakdown: this.analyzeCategorySpending(monthExpenses),
      };
    }).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return new Date(`${a.month} 1, ${a.year}`).getMonth() - new Date(`${b.month} 1, ${b.year}`).getMonth();
    });
  }

  /**
   * Calculate budget variance (placeholder - requires budget data)
   */
  private static calculateBudgetVariance(expenses: ExpenseRecord[]): BudgetVariance[] {
    // TODO: Implement actual budget comparison in task 7
    // This requires integration with budget/allocation data
    
    const categorySpending = this.analyzeCategorySpending(expenses);
    
    // Mock budget data for demonstration
    const mockBudgets: Record<string, number> = {
      groceries: 400,
      transportation: 200,
      entertainment: 150,
      dining: 200,
      bills: 800,
      healthcare: 100,
    };

    return categorySpending.map(category => {
      const budgeted = mockBudgets[category.category] || 0;
      const variance = category.amount - budgeted;
      const percentageVariance = budgeted > 0 ? (variance / budgeted) * 100 : 0;

      return {
        category: category.category,
        budgeted,
        actual: category.amount,
        variance,
        percentageVariance,
      };
    });
  }

  /**
   * Analyze top merchants by spending
   */
  private static analyzeTopMerchants(expenses: ExpenseRecord[]): MerchantSpending[] {
    const merchantData: Record<string, {
      amount: number;
      count: number;
      categories: Set<string>;
    }> = {};

    // Group expenses by merchant
    expenses.forEach(expense => {
      if (!merchantData[expense.merchant]) {
        merchantData[expense.merchant] = {
          amount: 0,
          count: 0,
          categories: new Set(),
        };
      }
      merchantData[expense.merchant].amount += expense.amount;
      merchantData[expense.merchant].count += 1;
      merchantData[expense.merchant].categories.add(expense.category);
    });

    // Convert to MerchantSpending format and sort by amount
    return Object.entries(merchantData)
      .map(([merchant, data]) => ({
        merchant,
        totalAmount: data.amount,
        transactionCount: data.count,
        averageAmount: data.amount / data.count,
        categories: Array.from(data.categories),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10); // Top 10 merchants
  }

  /**
   * Calculate spending frequency (transactions per day)
   */
  private static calculateSpendingFrequency(expenses: ExpenseRecord[]): number {
    if (expenses.length === 0) return 0;

    const dates = expenses.map(expense => expense.date.getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24) || 1;

    return expenses.length / daysDiff;
  }

  /**
   * Generate spending insights and recommendations
   */
  static generateInsights(analysis: SpendingAnalysis): string[] {
    const insights: string[] = [];

    // Top spending category insight
    if (analysis.categoryBreakdown.length > 0) {
      const topCategory = analysis.categoryBreakdown[0];
      insights.push(
        `Your highest spending category is ${topCategory.category} at $${topCategory.amount.toFixed(2)} (${topCategory.percentage.toFixed(1)}% of total spending).`
      );
    }

    // Spending frequency insight
    if (analysis.spendingFrequency > 2) {
      insights.push(
        `You make an average of ${analysis.spendingFrequency.toFixed(1)} transactions per day. Consider consolidating purchases to reduce transaction fees.`
      );
    }

    // Budget variance insights
    const overBudgetCategories = analysis.budgetVariance.filter(v => v.variance > 0);
    if (overBudgetCategories.length > 0) {
      const totalOverage = overBudgetCategories.reduce((sum, v) => sum + v.variance, 0);
      insights.push(
        `You're over budget by $${totalOverage.toFixed(2)} across ${overBudgetCategories.length} categories.`
      );
    }

    // Trend insights
    const increasingCategories = analysis.categoryBreakdown.filter(c => c.trend === 'increasing');
    if (increasingCategories.length > 0) {
      insights.push(
        `Spending is increasing in: ${increasingCategories.map(c => c.category).join(', ')}.`
      );
    }

    return insights;
  }
}