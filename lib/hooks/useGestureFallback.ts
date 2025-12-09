import { useState, useEffect, useCallback } from 'react'

interface GestureError {
  type: 'camera' | 'mediapipe' | 'permission' | 'unknown'
  message: string
  timestamp: number
}

/**
 * Hook for graceful degradation when gesture recognition fails
 * Automatically falls back to traditional input methods
 */
export function useGestureFallback() {
  const [gestureError, setGestureError] = useState<GestureError | null>(null)
  const [isGestureAvailable, setIsGestureAvailable] = useState(true)
  const [fallbackMode, setFallbackMode] = useState(false)

  /**
   * Check if gesture recognition is supported
   */
  const checkGestureSupport = useCallback(async (): Promise<boolean> => {
    // Check for required APIs
    if (typeof window === 'undefined') {
      return false
    }

    // Check for camera support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setGestureError({
        type: 'camera',
        message: 'Camera API not supported in this browser',
        timestamp: Date.now(),
      })
      return false
    }

    // Check for camera permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setGestureError({
            type: 'permission',
            message: 'Camera permission denied',
            timestamp: Date.now(),
          })
        } else if (error.name === 'NotFoundError') {
          setGestureError({
            type: 'camera',
            message: 'No camera found',
            timestamp: Date.now(),
          })
        } else {
          setGestureError({
            type: 'unknown',
            message: error.message,
            timestamp: Date.now(),
          })
        }
      }
      return false
    }
  }, [])

  /**
   * Handle gesture initialization error
   */
  const handleGestureError = useCallback((error: Error, type: GestureError['type'] = 'unknown') => {
    console.error('Gesture recognition error:', error)
    
    setGestureError({
      type,
      message: error.message,
      timestamp: Date.now(),
    })
    
    setIsGestureAvailable(false)
    setFallbackMode(true)

    // Log to error tracking
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      (window as any).errorTracker.captureException(error, {
        context: 'GestureRecognition',
        type,
      })
    }
  }, [])

  /**
   * Retry gesture initialization
   */
  const retryGesture = useCallback(async () => {
    setGestureError(null)
    setFallbackMode(false)
    
    const isSupported = await checkGestureSupport()
    setIsGestureAvailable(isSupported)
    
    return isSupported
  }, [checkGestureSupport])

  /**
   * Manually enable fallback mode
   */
  const enableFallback = useCallback(() => {
    setFallbackMode(true)
  }, [])

  /**
   * Check support on mount
   */
  useEffect(() => {
    checkGestureSupport().then(isSupported => {
      setIsGestureAvailable(isSupported)
      if (!isSupported) {
        setFallbackMode(true)
      }
    })
  }, [checkGestureSupport])

  return {
    isGestureAvailable,
    fallbackMode,
    gestureError,
    handleGestureError,
    retryGesture,
    enableFallback,
  }
}

/**
 * Get user-friendly error message for gesture errors
 */
export function getGestureErrorMessage(error: GestureError | null): string {
  if (!error) return ''

  switch (error.type) {
    case 'camera':
      return 'Camera not available. Using traditional input methods.'
    case 'permission':
      return 'Camera permission denied. Please enable camera access to use gestures.'
    case 'mediapipe':
      return 'Gesture recognition failed to initialize. Using traditional input methods.'
    default:
      return 'Gesture recognition unavailable. Using traditional input methods.'
  }
}
