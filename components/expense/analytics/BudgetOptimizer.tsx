import { 
  ExpenseRecord, 
  BudgetOptimization, 
  BucketRatio, 
  CategorySpending, 
  SpendingAnalysis 
} from '../types';
import { SpendingAnalyzer } from './SpendingAnalyzer';

/**
 * BudgetOptimizer Class
 * 
 * Analyzes spending patterns and suggests optimal bucket allocations.
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5
 */
export class BudgetOptimizer {
  /**
   * Generate budget optimization suggestions based on spending patterns
   */
  static optimizeBucketAllocations(
    expenses: ExpenseRecord[],
    currentAllocation: BucketRatio[]
  ): BudgetOptimization {
    const analysis = SpendingAnalyzer.analyzeSpending(expenses);
    const actualSpending = this.mapCategoriesToBuckets(analysis.categoryBreakdown);
    const suggestedAllocation = this.calculateOptimalAllocation(actualSpending, currentAllocation);
    
    return {
      currentAllocation,
      actualSpending: analysis.categoryBreakdown,
      suggestedAllocation,
      potentialSavings: this.calculatePotentialSavings(currentAllocation, suggestedAllocation, analysis.totalSpending),
      riskAssessment: this.assessRisk(suggestedAllocation, currentAllocation),
      confidence: this.calculateConfidence(expenses, analysis),
      reasoning: this.generateReasoning(currentAllocation, suggestedAllocation, actualSpending),
    };
  }

  /**
   * Map expense categories to bucket types
   */
  private static mapCategoriesToBuckets(categorySpending: CategorySpending[]): Record<string, number> {
    const bucketMapping: Record<string, string> = {
      // Bills bucket
      bills: 'bills',
      utilities: 'bills',
      rent: 'bills',
      mortgage: 'bills',
      insurance: 'bills',
      subscriptions: 'bills',
      
      // Savings bucket
      savings: 'savings',
      emergency: 'savings',
      
      // Growth bucket
      investment: 'growth',
      retirement: 'growth',
      education: 'growth',
      
      // Spendable bucket
      groceries: 'spendable',
      dining: 'spendable',
      entertainment: 'spendable',
      shopping: 'spendable',
      transportation: 'spendable',
      healthcare: 'spendable',
      travel: 'spendable',
      uncategorized: 'spendable',
    };

    const bucketTotals: Record<string, number> = {
      bills: 0,
      savings: 0,
      growth: 0,
      spendable: 0,
    };

    categorySpending.forEach(category => {
      const bucket = bucketMapping[category.category] || 'spendable';
      bucketTotals[bucket] += category.amount;
    });

    return bucketTotals;
  }

  /**
   * Calculate optimal allocation based on spending patterns
   */
  private static calculateOptimalAllocation(
    actualSpending: Record<string, number>,
    currentAllocation: BucketRatio[]
  ): BucketRatio[] {
    const totalSpending = Object.values(actualSpending).reduce((sum, amount) => sum + amount, 0);
    
    if (totalSpending === 0) {
      return currentAllocation; // No spending data, keep current allocation
    }

    // Calculate actual spending percentages
    const actualPercentages: Record<string, number> = {};
    Object.entries(actualSpending).forEach(([bucket, amount]) => {
      actualPercentages[bucket] = (amount / totalSpending) * 100;
    });

    // Apply optimization rules
    const optimized = currentAllocation.map(bucket => {
      const actualPercent = actualPercentages[bucket.bucket] || 0;
      const currentPercent = bucket.percentage;
      
      // Optimization logic
      let suggestedPercent = currentPercent;
      
      if (bucket.bucket === 'bills') {
        // Bills should match actual spending closely
        suggestedPercent = Math.max(actualPercent, 25); // Minimum 25% for bills
      } else if (bucket.bucket === 'savings') {
        // Maintain or increase savings if possible
        suggestedPercent = Math.max(currentPercent, 10); // Minimum 10% for savings
      } else if (bucket.bucket === 'growth') {
        // Growth should be at least 5% if possible
        suggestedPercent = Math.max(currentPercent, 5);
      } else if (bucket.bucket === 'spendable') {
        // Spendable adjusts based on actual spending patterns
        suggestedPercent = actualPercent * 1.1; // 10% buffer for spendable
      }

      return {
        bucket: bucket.bucket,
        percentage: Math.round(suggestedPercent),
      };
    });

    // Normalize to 100%
    return this.normalizePercentages(optimized);
  }

  /**
   * Normalize percentages to sum to 100%
   */
  private static normalizePercentages(buckets: BucketRatio[]): BucketRatio[] {
    const total = buckets.reduce((sum, bucket) => sum + bucket.percentage, 0);
    
    if (total === 100) return buckets;
    
    // Adjust proportionally
    return buckets.map(bucket => ({
      bucket: bucket.bucket,
      percentage: Math.round((bucket.percentage / total) * 100),
    }));
  }

  /**
   * Calculate potential savings from optimization
   */
  private static calculatePotentialSavings(
    current: BucketRatio[],
    suggested: BucketRatio[],
    totalSpending: number
  ): number {
    const currentSavings = current.find(b => b.bucket === 'savings')?.percentage || 0;
    const suggestedSavings = suggested.find(b => b.bucket === 'savings')?.percentage || 0;
    
    const savingsIncrease = (suggestedSavings - currentSavings) / 100;
    return savingsIncrease * totalSpending;
  }

  /**
   * Assess risk level of suggested changes
   */
  private static assessRisk(
    suggested: BucketRatio[],
    current: BucketRatio[]
  ): 'low' | 'medium' | 'high' {
    let maxChange = 0;
    
    suggested.forEach(suggestedBucket => {
      const currentBucket = current.find(b => b.bucket === suggestedBucket.bucket);
      if (currentBucket) {
        const change = Math.abs(suggestedBucket.percentage - currentBucket.percentage);
        maxChange = Math.max(maxChange, change);
      }
    });

    if (maxChange <= 5) return 'low';
    if (maxChange <= 15) return 'medium';
    return 'high';
  }

  /**
   * Calculate confidence in optimization suggestions
   */
  private static calculateConfidence(expenses: ExpenseRecord[], analysis: SpendingAnalysis): number {
    let confidence = 0.5; // Base confidence
    
    // More transactions = higher confidence
    if (expenses.length > 50) confidence += 0.2;
    else if (expenses.length > 20) confidence += 0.1;
    
    // Longer time period = higher confidence
    if (expenses.length > 0) {
      const dates = expenses.map(e => e.date.getTime());
      const daySpan = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
      if (daySpan > 90) confidence += 0.2;
      else if (daySpan > 30) confidence += 0.1;
    }
    
    // Consistent spending patterns = higher confidence
    const stableCategories = analysis.categoryBreakdown.filter(c => c.trend === 'stable').length;
    const totalCategories = analysis.categoryBreakdown.length;
    if (totalCategories > 0) {
      confidence += (stableCategories / totalCategories) * 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate reasoning for optimization suggestions
   */
  private static generateReasoning(
    current: BucketRatio[],
    suggested: BucketRatio[],
    actualSpending: Record<string, number>
  ): string[] {
    const reasoning: string[] = [];
    
    suggested.forEach(suggestedBucket => {
      const currentBucket = current.find(b => b.bucket === suggestedBucket.bucket);
      if (!currentBucket) return;
      
      const change = suggestedBucket.percentage - currentBucket.percentage;
      const actualAmount = actualSpending[suggestedBucket.bucket] || 0;
      
      if (Math.abs(change) > 2) { // Only explain significant changes
        if (change > 0) {
          if (suggestedBucket.bucket === 'bills') {
            reasoning.push(`Increase ${suggestedBucket.bucket} allocation by ${change}% to better match your actual spending patterns.`);
          } else if (suggestedBucket.bucket === 'savings') {
            reasoning.push(`Increase ${suggestedBucket.bucket} allocation by ${change}% to improve your financial security.`);
          } else if (suggestedBucket.bucket === 'spendable') {
            reasoning.push(`Increase ${suggestedBucket.bucket} allocation by ${change}% based on your current spending habits.`);
          }
        } else {
          reasoning.push(`Reduce ${suggestedBucket.bucket} allocation by ${Math.abs(change)}% to optimize your budget distribution.`);
        }
      }
    });

    if (reasoning.length === 0) {
      reasoning.push('Your current allocation is well-aligned with your spending patterns.');
    }

    return reasoning;
  }

  /**
   * Track optimization effectiveness over time
   */
  static trackOptimizationEffectiveness(
    beforeExpenses: ExpenseRecord[],
    afterExpenses: ExpenseRecord[],
    optimization: BudgetOptimization
  ): {
    savingsRealized: number;
    budgetAdherence: number;
    overallImprovement: number;
  } {
    // TODO: Implement effectiveness tracking in task 8.1
    // This would compare spending patterns before and after optimization
    
    const beforeAnalysis = SpendingAnalyzer.analyzeSpending(beforeExpenses);
    const afterAnalysis = SpendingAnalyzer.analyzeSpending(afterExpenses);
    
    // Calculate actual improvements
    const savingsRealized = afterAnalysis.totalSpending - beforeAnalysis.totalSpending;
    
    // Calculate budget adherence (placeholder)
    const budgetAdherence = 0.85; // 85% adherence
    
    // Overall improvement score
    const overallImprovement = (budgetAdherence + (savingsRealized > 0 ? 0.2 : 0)) * 100;
    
    return {
      savingsRealized,
      budgetAdherence,
      overallImprovement,
    };
  }
}