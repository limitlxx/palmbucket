'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Hands, Results } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { HAND_CONNECTIONS } from '@mediapipe/hands'
import { GestureData, GestureType, HandLandmarks } from '@/types'

interface GestureControllerProps {
  onGesture?: (gesture: GestureData) => void
}

const GESTURE_ENABLED_KEY = 'palmbudget_gesture_enabled'
const PINCH_THRESHOLD = 40 // pixels
const SWIPE_THRESHOLD = 150 // pixels
const SWIPE_COOLDOWN = 500 // milliseconds

export function GestureController({ onGesture }: GestureControllerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [isPinching, setIsPinching] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'none'>('none')
  
  // Track hand position for swipe detection
  const previousPositionRef = useRef<{ x: number; y: number } | null>(null)
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastSwipeTimeRef = useRef<number>(0)

  // Load gesture enabled state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(GESTURE_ENABLED_KEY)
    if (stored !== null) {
      setEnabled(stored === 'true')
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

  // Dispatch custom gesture events to DOM
  const dispatchGestureEvent = useCallback((gestureType: GestureType, data: GestureData) => {
    const event = new CustomEvent('gesture', {
      detail: { gestureType, data },
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(event)
    
    // Also call the callback if provided
    if (onGesture) {
      onGesture(data)
    }
  }, [onGesture])

  useEffect(() => {
    if (!enabled) {
      // Reset state when disabled
      setIsInitialized(false)
      setIsPinching(false)
      setSwipeDirection('none')
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

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        })

        hands.onResults(onResults)

        // Initialize camera
        if (videoRef.current) {
          camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (hands && videoRef.current) {
                await hands.send({ image: videoRef.current })
              }
            },
            width: 640,
            height: 480
          })

          await camera.start()
          setIsInitialized(true)
        }
      } catch (err) {
        setError('Failed to initialize gesture recognition: ' + (err as Error).message)
      }
    }

    const onResults = (results: Results) => {
      if (!canvasRef.current) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw video frame
      if (videoRef.current) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      }

      // Process hand landmarks
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0]
        
        // Draw hand landmarks
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 })
        drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 })

        // Detect gestures
        const gestureType = detectGesture(landmarks)
        
        if (gestureType !== 'none') {
          const gestureData: GestureData = {
            landmarks: [landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z }))],
            confidence: 0.8,
            gestureType,
            timestamp: Date.now()
          }
          
          dispatchGestureEvent(gestureType, gestureData)
        }
      } else {
        // No hand detected - reset swipe tracking
        previousPositionRef.current = null
        swipeStartRef.current = null
        setSwipeDirection('none')
        setIsPinching(false)
      }
    }

    const detectGesture = (landmarks: any[]): GestureType => {
      // Pinch detection: distance between index finger tip and thumb tip
      const thumbTip = landmarks[4]
      const indexTip = landmarks[8]
      
      const distance = Math.sqrt(
        Math.pow((thumbTip.x - indexTip.x) * 640, 2) + 
        Math.pow((thumbTip.y - indexTip.y) * 480, 2)
      )
      
      const currentlyPinching = distance < PINCH_THRESHOLD
      setIsPinching(currentlyPinching)
      
      if (currentlyPinching) {
        return 'pinch'
      }

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
          return 'none'
        }
        
        // Calculate movement from start
        const deltaX = currentPosition.x - swipeStartRef.current.x
        const deltaY = Math.abs(currentPosition.y - swipeStartRef.current.y)
        
        // Check if movement is primarily horizontal and exceeds threshold
        const now = Date.now()
        if (Math.abs(deltaX) > SWIPE_THRESHOLD && deltaY < 100 && now - lastSwipeTimeRef.current > SWIPE_COOLDOWN) {
          lastSwipeTimeRef.current = now
          swipeStartRef.current = null
          previousPositionRef.current = null
          
          if (deltaX > 0) {
            setSwipeDirection('right')
            return 'swipe_right'
          } else {
            setSwipeDirection('left')
            return 'swipe_left'
          }
        }
        
        previousPositionRef.current = currentPosition
      } else {
        // Reset swipe tracking when hand closes
        swipeStartRef.current = null
        previousPositionRef.current = null
        setSwipeDirection('none')
      }

      return 'none'
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
  }, [enabled, dispatchGestureEvent])

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Toggle button */}
      <button
        onClick={toggleGesture}
        className={`mb-2 px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
          enabled 
            ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg' 
            : 'bg-gray-500 hover:bg-gray-600 text-white shadow-md'
        }`}
        aria-label={enabled ? 'Disable gesture control' : 'Enable gesture control'}
      >
        {enabled ? '👋 Gestures ON' : '🖱️ Gestures OFF'}
      </button>

      {enabled && (
        <div className="relative">
          <video
            ref={videoRef}
            className="hidden"
            autoPlay
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            width={320}
            height={240}
            className="border border-gray-300 rounded-lg bg-black"
          />
          
          {/* Gesture status indicators */}
          <div className="absolute bottom-2 left-2 flex gap-2">
            {/* Pinch indicator */}
            <div className={`px-2 py-1 rounded text-xs font-semibold ${
              isPinching ? 'bg-green-500 text-white' : 'bg-gray-500 text-gray-300'
            }`}>
              👌 Pinch
            </div>
            
            {/* Swipe indicator */}
            {swipeDirection !== 'none' && (
              <div className="px-2 py-1 rounded text-xs font-semibold bg-blue-500 text-white animate-pulse">
                {swipeDirection === 'right' ? '👉 Swipe Right' : '👈 Swipe Left'}
              </div>
            )}
          </div>
          
          {error && (
            <div className="absolute top-0 left-0 w-full h-full bg-red-500 bg-opacity-75 flex items-center justify-center text-white text-sm p-2 rounded-lg">
              {error}
            </div>
          )}
          {!isInitialized && !error && (
            <div className="absolute top-0 left-0 w-full h-full bg-blue-500 bg-opacity-75 flex items-center justify-center text-white text-sm">
              Initializing camera...
            </div>
          )}
        </div>
      )}
    </div>
  )
}