'use client'

import { Component, ReactNode } from 'react'
import { BucketType } from './BucketCard'

interface BucketErrorBoundaryProps {
  children: ReactNode
  bucketType: BucketType
  fallback?: ReactNode
}

interface BucketErrorBoundaryState {
  hasError: boolean
  error?: Error
}

const bucketConfig = {
  bills: {
    name: 'Bills',
    lightColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
  savings: {
    name: 'Savings',
    lightColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  growth: {
    name: 'Growth',
    lightColor: 'bg-green-50',
    textColor: 'text-green-700',
  },
  spendable: {
    name: 'Spendable',
    lightColor: 'bg-purple-50',
    textColor: 'text-purple-700',
  },
}

export class BucketErrorBoundary extends Component<BucketErrorBoundaryProps, BucketErrorBoundaryState> {
  constructor(props: BucketErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): BucketErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('BucketErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const config = bucketConfig[this.props.bucketType]
      
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className={`p-6 rounded-lg shadow-lg ${config.lightColor}`}>
          <div className="text-center">
            <div className={`text-lg font-semibold mb-2 ${config.textColor}`}>
              {config.name} Bucket
            </div>
            <div className="text-gray-600 mb-4">
              Unable to load bucket data
            </div>
            <div className="text-sm text-gray-500 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined })
                window.location.reload()
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium text-white bg-gray-500 hover:bg-gray-600 transition-colors`}
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}