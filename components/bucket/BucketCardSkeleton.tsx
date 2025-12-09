'use client'

import { BucketType } from './BucketCard'

interface BucketCardSkeletonProps {
  type: BucketType
  className?: string
}

const bucketConfig = {
  bills: {
    name: 'Bills',
    lightColor: 'bg-red-50',
  },
  savings: {
    name: 'Savings',
    lightColor: 'bg-blue-50',
  },
  growth: {
    name: 'Growth',
    lightColor: 'bg-green-50',
  },
  spendable: {
    name: 'Spendable',
    lightColor: 'bg-purple-50',
  },
}

export function BucketCardSkeleton({ type, className = '' }: BucketCardSkeletonProps) {
  const config = bucketConfig[type]

  return (
    <div className={`p-6 rounded-lg shadow-lg ${config.lightColor} ${className}`}>
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
            <div className="h-5 bg-gray-300 rounded w-20"></div>
          </div>
          <div className="h-4 bg-gray-300 rounded w-16"></div>
        </div>

        {/* Balance skeleton */}
        <div className="mb-4">
          <div className="h-8 bg-gray-300 rounded w-24 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-32"></div>
        </div>

        {/* Progress bar skeleton */}
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <div className="h-3 bg-gray-300 rounded w-16"></div>
            <div className="h-3 bg-gray-300 rounded w-10"></div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="h-2 bg-gray-300 rounded-full w-1/3"></div>
          </div>
        </div>

        {/* Mobile indicator skeleton */}
        <div className="flex justify-center mt-2">
          <div className="w-6 h-1 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </div>
  )
}