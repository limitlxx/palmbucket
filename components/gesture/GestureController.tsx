'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Hands, Results } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'
import { GestureData, GestureType } from '@/types'
import { useGestureFallback, getGestureErrorMessage } from '@/lib/hooks'

interface GestureControllerProps {
  onGesture?: (gesture: GestureData) => void
}

const GESTURE_ENABLED_KEY = 'palmbudget_gesture_enabled'
const BATTERY_SAVING_KEY = 'palmbudget_battery_saving'

// Device detection
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768)
}

// Mobile-optimized thresholds
const PINCH_THRESHOLD_DESKTOP = 40 // pixels
const PINCH_THRESHOLD_MOBILE = 50 // pixels - slightly larger for touch screens
const SWIPE_THRESHOLD_DESKTOP = 150 // pixels
const SWIPE_THRESHOLD_MOBILE = 120 // pixels - shorter for smaller screens
const SWIPE_COOLDOWN = 500 // milliseconds

// Battery saving mode settings
const BATTERY_SAVING_FPS = 15 // Lower frame rate for battery saving
const NORMAL_FPS = 30 // Normal frame rate

export function GestureController({ onGesture }: GestureControllerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [batterySaving, setBatterySaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isPinching, setIsPinching] = useState(false)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredElement, setHoveredElement] = useState<Element | null>(null)
  const [actionLog, setActionLog] = useState<string[]>([])
  
  // Gesture fallback handling
  const {
    isGestureAvailable,
    fallbackMode,
    gestureError,
    handleGestureError,
    retryGesture,
  } = useGestureFallback()
  
  // Track hand position for swipe detection
  const previousPositionRef = useRef<{ x: number; y: number } | null>(null)
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastSwipeTimeRef = useRef<number>(0)
  const lastPinchStateRef = useRef<boolean>(false)

  // Load gesture enabled state and detect mobile on mount
  useEffect(() => {
    const stored = localStorage.getItem(GESTURE_ENABLED_KEY)
    if (stored !== null) {
      setEnabled(stored === 'true')
    }
    
    const batterySaved = localStorage.getItem(BATTERY_SAVING_KEY)
    if (batterySaved !== null) {
      setBatterySaving(batterySaved === 'true')
    }
    
    // Detect if mobile device
    setIsMobile(isMobileDevice())
    
    // Auto-enable battery saving on mobile by default
    if (isMobileDevice() && batterySaved === null) {
      setBatterySaving(true)
      localStorage.setItem(BATTERY_SAVING_KEY, 'true')
    }
  }, [])

  // Persist gesture enabled state to localStorage
  const toggleGesture = useCallback(() => {
    setEnabled(prev => {
      const newValue = !prev
      localStorage.setItem(GESTURE_ENABLED_KEY, String(newValue))
      return newValue
    })
  }, [])
  
  // Toggle battery saving mode
  const toggleBatterySaving = useCallback(() => {
    setBatterySaving(prev => {
      const newValue = !prev
      localStorage.setItem(BATTERY_SAVING_KEY, String(newValue))
      return newValue
    })
  }, [])

  // Add action to log
  const logAction = useCallback((action: string) => {
    setActionLog(prev => {
      const newLog = [action, ...prev].slice(0, 3) // Keep last 3 actions
      return newLog
    })
  }, [])

  // Check what element is under the cursor
  const getElementAtPosition = useCallback((x: number, y: number): Element | null => {
    const elements = document.elementsFromPoint(x, y)
    // Find first clickable element
    for (const el of elements) {
      if (
        el.tagName === 'BUTTON' ||
        el.tagName === 'A' ||
        el.getAttribute('role') === 'button' ||
        (el as HTMLElement).onclick !== null ||
        window.getComputedStyle(el).cursor === 'pointer'
      ) {
        return el
      }
    }
    return null
  }, [])

  // Dispatch custom gesture events to DOM
  const dispatchGestureEvent = useCallback((gestureType: GestureType, data: GestureData) => {
    const event = new CustomEvent('gesture', {
      detail: { gestureType, data },
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(event)
    
    // Log the action
    const actionText = gestureType === 'pinch' ? '👌 Pinch Click' :
                      gestureType === 'swipe_right' ? '👉 Swipe Right (Confirm)' :
                      gestureType === 'swipe_left' ? '👈 Swipe Left (Cancel)' : ''
    if (actionText) {
      logAction(actionText)
    }
    
    // Also call the callback if provided
    if (onGesture) {
      onGesture(data)
    }
  }, [onGesture, logAction])

  // Handle pinch click on hovered element
  useEffect(() => {
    if (isPinching && !lastPinchStateRef.current && hoveredElement && cursorPosition) {
      // Pinch just started - trigger click
      const element = hoveredElement as HTMLElement
      
      // Log what was clicked
      const elementText = element.textContent?.trim().substring(0, 30) || element.tagName
      logAction(`🎯 Clicked: ${elementText}`)
      
      // Trigger the click - handle different element types
      try {
        if (typeof element.click === 'function') {
          element.click()
        } else {
          // Fallback: dispatch a click event
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          })
          element.dispatchEvent(clickEvent)
        }
      } catch (err) {
        console.error('Failed to click element:', err)
      }
      
      // Dispatch pinch gesture event
      const gestureData: GestureData = {
        landmarks: [],
        confidence: 0.8,
        gestureType: 'pinch',
        timestamp: Date.now()
      }
      dispatchGestureEvent('pinch', gestureData)
    }
    
    lastPinchStateRef.current = isPinching
  }, [isPinching, hoveredElement, cursorPosition, dispatchGestureEvent, logAction])

  // Update hovered element when cursor moves
  useEffect(() => {
    if (cursorPosition) {
      const element = getElementAtPosition(cursorPosition.x, cursorPosition.y)
      setHoveredElement(element)
    } else {
      setHoveredElement(null)
    }
  }, [cursorPosition, getElementAtPosition])

  useEffect(() => {
    if (!enabled) {
      // Reset state when disabled
      setIsInitialized(false)
      setIsPinching(false)
      setCursorPosition(null)
      setHoveredElement(null)
      setActionLog([])
      previousPositionRef.current = null
      swipeStartRef.current = null
      return
    }

    let hands: Hands | null = null
    let camera: Camera | null = null

    const initializeGestureRecognition = async () => {
      try {
        // Initialize MediaPipe Hands
        hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
          }
        })

        // Mobile-optimized settings
        const isMobileNow = isMobileDevice()
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: isMobileNow ? 0 : 1, // Lower complexity on mobile for performance
          minDetectionConfidence: isMobileNow ? 0.6 : 0.5, // Higher confidence on mobile to reduce false positives
          minTrackingConfidence: isMobileNow ? 0.6 : 0.5
        })

        hands.onResults(onResults)

        // Initialize camera with mobile-optimized settings
        if (videoRef.current) {
          const isMobileNow = isMobileDevice()
          const targetFps = batterySaving ? BATTERY_SAVING_FPS : NORMAL_FPS
          
          camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (hands && videoRef.current) {
                await hands.send({ image: videoRef.current })
              }
            },
            // Lower resolution on mobile for better performance
            width: isMobileNow ? 480 : 640,
            height: isMobileNow ? 360 : 480,
            // Use front camera on mobile
            facingMode: isMobileNow ? 'user' : undefined
          })

          await camera.start()
          setIsInitialized(true)
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError('Failed to initialize gesture recognition: ' + error.message)
        
        // Determine error type
        if (error.message.includes('camera') || error.message.includes('Camera')) {
          handleGestureError(error, 'camera')
        } else if (error.message.includes('permission') || error.message.includes('Permission')) {
          handleGestureError(error, 'permission')
        } else if (error.message.includes('MediaPipe') || error.message.includes('mediapipe')) {
          handleGestureError(error, 'mediapipe')
        } else {
          handleGestureError(error, 'unknown')
        }
      }
    }

    const onResults = (results: Results) => {
      // Process hand landmarks
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0]
        
        // Get index finger tip position (landmark 8)
        const indexTip = landmarks[8]
        
        // Convert normalized coordinates to screen coordinates and flip horizontally for mirror effect
        const screenX = window.innerWidth - (indexTip.x * window.innerWidth)
        const screenY = indexTip.y * window.innerHeight
        
        setCursorPosition({ x: screenX, y: screenY })

        // Detect gestures
        detectGesture(landmarks)
      } else {
        // No hand detected
        setCursorPosition(null)
        previousPositionRef.current = null
        swipeStartRef.current = null
        setIsPinching(false)
      }
    }

    const detectGesture = (landmarks: any[]) => {
      // Pinch detection: distance between index finger tip and thumb tip
      const thumbTip = landmarks[4]
      const indexTip = landmarks[8]
      
      // Use device-specific thresholds
      const isMobileNow = isMobileDevice()
      const pinchThreshold = isMobileNow ? PINCH_THRESHOLD_MOBILE : PINCH_THRESHOLD_DESKTOP
      const swipeThreshold = isMobileNow ? SWIPE_THRESHOLD_MOBILE : SWIPE_THRESHOLD_DESKTOP
      
      const distance = Math.sqrt(
        Math.pow((thumbTip.x - indexTip.x) * 640, 2) + 
        Math.pow((thumbTip.y - indexTip.y) * 480, 2)
      )
      
      const currentlyPinching = distance < pinchThreshold
      setIsPinching(currentlyPinching)

      // Swipe detection: check if all 5 fingers are extended (open palm)
      const thumbTipY = landmarks[4].y
      const thumbIP = landmarks[3].y
      const indexTipY = landmarks[8].y
      const indexPIP = landmarks[6].y
      const middleTipY = landmarks[12].y
      const middlePIP = landmarks[10].y
      const ringTipY = landmarks[16].y
      const ringPIP = landmarks[14].y
      const pinkyTipY = landmarks[20].y
      const pinkyPIP = landmarks[18].y
      
      // Check if all fingers are extended (tips are above PIPs in y-coordinate)
      const thumbExtended = thumbTipY < thumbIP
      const indexExtended = indexTipY < indexPIP
      const middleExtended = middleTipY < middlePIP
      const ringExtended = ringTipY < ringPIP
      const pinkyExtended = pinkyTipY < pinkyPIP
      
      const allFingersExtended = thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended
      
      if (allFingersExtended) {
        const palmCenter = landmarks[9] // Wrist
        const currentPosition = { x: palmCenter.x * 640, y: palmCenter.y * 480 }
        
        // Initialize swipe tracking
        if (!swipeStartRef.current) {
          swipeStartRef.current = currentPosition
          previousPositionRef.current = currentPosition
          return
        }
        
        // Calculate movement from start - flip deltaX for mirror correction
        const deltaX = -(currentPosition.x - swipeStartRef.current.x)
        const deltaY = Math.abs(currentPosition.y - swipeStartRef.current.y)
        
        // Check if movement is primarily horizontal and exceeds threshold
        const now = Date.now()
        if (Math.abs(deltaX) > swipeThreshold && deltaY < 100 && now - lastSwipeTimeRef.current > SWIPE_COOLDOWN) {
          lastSwipeTimeRef.current = now
          swipeStartRef.current = null
          previousPositionRef.current = null
          
          const gestureType = deltaX > 0 ? 'swipe_right' : 'swipe_left'
          const gestureData: GestureData = {
            landmarks: [landmarks.map((lm: any) => ({ x: lm.x, y: lm.y, z: lm.z }))],
            confidence: 0.8,
            gestureType,
            timestamp: Date.now()
          }
          dispatchGestureEvent(gestureType, gestureData)
        }
        
        previousPositionRef.current = currentPosition
      } else {
        // Reset swipe tracking when hand closes
        swipeStartRef.current = null
        previousPositionRef.current = null
      }
    }

    initializeGestureRecognition()

    return () => {
      if (camera) {
        camera.stop()
      }
      if (hands) {
        hands.close()
      }
    }
  }, [enabled, batterySaving, dispatchGestureEvent, handleGestureError, retryGesture])

  return (
    <>
      {/* Toggle buttons */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        <button
          onClick={toggleGesture}
          className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 shadow-lg ${
            enabled 
              ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white' 
              : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
          }`}
          aria-label={enabled ? 'Disable gesture control' : 'Enable gesture control'}
        >
          {enabled ? '👋 Gestures ON' : '🖱️ Gestures OFF'}
          {isMobile && <span className="ml-1 text-xs">📱</span>}
        </button>
        
        {enabled && isMobile && (
          <button
            onClick={toggleBatterySaving}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 shadow-md ${
              batterySaving 
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white' 
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
            }`}
            aria-label={batterySaving ? 'Disable battery saving' : 'Enable battery saving'}
          >
            {batterySaving ? '🔋 Battery Saving' : '⚡ Performance'}
          </button>
        )}
      </div>

      {enabled && (
        <>
          {/* Hidden video element for camera feed */}
          <video
            ref={videoRef}
            className="hidden"
            autoPlay
            muted
            playsInline
          />
          
          {/* AR Cursor with Orbiting Dots and Ribbons */}
          {cursorPosition && (
            <div
              className="fixed pointer-events-none z-[9999] transition-transform duration-75"
              style={{
                left: `${cursorPosition.x}px`,
                top: `${cursorPosition.y}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {/* Ribbon trail effect */}
              <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
                hoveredElement 
                  ? 'w-20 h-20 -m-10 bg-gradient-to-r from-green-400/20 via-green-300/10 to-transparent animate-spin-slow' 
                  : 'w-16 h-16 -m-8 bg-gradient-to-r from-blue-400/20 via-blue-300/10 to-transparent animate-spin-slow'
              }`} style={{ animationDuration: '3s' }} />
              
              {/* Outer glow ring */}
              <div className={`absolute inset-0 rounded-full transition-all duration-200 ${
                hoveredElement 
                  ? 'w-16 h-16 -m-8 bg-green-400/30 animate-pulse' 
                  : 'w-12 h-12 -m-6 bg-blue-400/20'
              }`} />
              
              {/* Orbiting dots */}
              <div className="absolute inset-0 w-12 h-12 -m-6 animate-spin" style={{ animationDuration: '2s' }}>
                <div className="absolute top-0 left-1/2 w-2 h-2 -ml-1 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50" />
              </div>
              <div className="absolute inset-0 w-12 h-12 -m-6 animate-spin" style={{ animationDuration: '2.5s', animationDirection: 'reverse' }}>
                <div className="absolute bottom-0 left-1/2 w-2 h-2 -ml-1 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50" />
              </div>
              <div className="absolute inset-0 w-12 h-12 -m-6 animate-spin" style={{ animationDuration: '3s' }}>
                <div className="absolute left-0 top-1/2 w-2 h-2 -mt-1 bg-pink-400 rounded-full shadow-lg shadow-pink-400/50" />
              </div>
              
              {/* Main cursor orb with enhanced glow */}
              <div className={`relative w-8 h-8 rounded-full transition-all duration-200 ${
                isPinching 
                  ? 'bg-gradient-to-br from-green-400 to-green-600 scale-75 shadow-2xl shadow-green-500/70 animate-pulse' 
                  : hoveredElement
                  ? 'bg-gradient-to-br from-green-300 to-green-500 scale-110 shadow-2xl shadow-green-400/70'
                  : 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-2xl shadow-blue-500/70'
              }`}>
                {/* Inner highlight */}
                <div className="absolute top-1.5 left-1.5 w-3 h-3 bg-white/70 rounded-full blur-sm" />
                <div className="absolute top-2 left-2 w-2 h-2 bg-white rounded-full" />
              </div>
              
              {/* Hover indicator */}
              {hoveredElement && !isPinching && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg animate-bounce">
                  👆 Pinch to click
                </div>
              )}
            </div>
          )}
          
          {/* Action log at bottom left */}
          {actionLog.length > 0 && (
            <div className="fixed bottom-4 left-4 z-50 space-y-2">
              {actionLog.map((action, index) => (
                <div
                  key={`${action}-${index}`}
                  className={`px-3 py-2 rounded-lg text-sm font-medium bg-black/80 text-white shadow-lg transition-all duration-300 ${
                    index === 0 ? 'scale-100 opacity-100' : 'scale-95 opacity-70'
                  }`}
                  style={{ 
                    transform: `translateY(${index * -5}px)`,
                    zIndex: 50 - index
                  }}
                >
                  {action}
                </div>
              ))}
            </div>
          )}
          
          {/* Status indicator at bottom right */}
          <div className="fixed bottom-4 right-4 z-50 space-y-2">
            <div className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              isPinching 
                ? 'bg-green-500 text-white shadow-lg scale-110' 
                : cursorPosition
                ? 'bg-blue-500/80 text-white shadow-md'
                : 'bg-gray-700/80 text-gray-300 shadow-md'
            }`}>
              {isPinching ? '👌 Pinching!' : cursorPosition ? '👋 Hand Detected' : '🖐️ Show Your Hand'}
            </div>
            
            {/* Debug info with mobile indicators */}
            {isInitialized && (
              <div className="px-2 py-1 rounded text-xs bg-black/60 text-white">
                {isMobile && '📱 '}Camera: {isInitialized ? '✓' : '✗'} | 
                {batterySaving && ' 🔋 '}
                Cursor: {cursorPosition ? `${Math.round(cursorPosition.x)},${Math.round(cursorPosition.y)}` : 'None'}
              </div>
            )}
          </div>
          
          {/* Error message with fallback info */}
          {(error || gestureError) && (
            <div className="fixed top-20 right-4 z-50 max-w-sm bg-red-500 text-white text-sm p-4 rounded-lg shadow-lg">
              <p className="font-semibold">Gesture Recognition Error</p>
              <p className="mt-1">{error || getGestureErrorMessage(gestureError)}</p>
              {fallbackMode && (
                <p className="mt-2 text-xs opacity-90">
                  ℹ️ Traditional input methods are available
                </p>
              )}
              {gestureError && (
                <button
                  onClick={async () => {
                    setError(null)
                    const success = await retryGesture()
                    if (success) {
                      // Re-enable gestures
                      setEnabled(true)
                    }
                  }}
                  className="mt-2 px-3 py-1 bg-white text-red-600 rounded text-xs font-medium hover:bg-red-50 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          
          {/* Initializing message */}
          {!isInitialized && !error && (
            <div className="fixed top-20 right-4 z-50 bg-blue-500 text-white text-sm px-4 py-3 rounded-lg shadow-lg animate-pulse">
              <p className="font-semibold">📷 Initializing camera...</p>
            </div>
          )}
        </>
      )}
    </>
  )
}
