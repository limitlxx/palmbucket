'use client'

import { useEffect, useRef, useState } from 'react'
import { Hands, Results } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { HAND_CONNECTIONS } from '@mediapipe/hands'
import { GestureData, GestureType, HandLandmarks } from '@/types'

interface GestureControllerProps {
  onGesture: (gesture: GestureData) => void
  enabled: boolean
}

export function GestureController({ onGesture, enabled }: GestureControllerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

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
            confidence: 0.8, // Placeholder confidence
            gestureType,
            timestamp: Date.now()
          }
          
          onGesture(gestureData)
        }
      }
    }

    const detectGesture = (landmarks: any[]): GestureType => {
      // Pinch detection: distance between index finger tip and thumb tip
      const thumbTip = landmarks[4]
      const indexTip = landmarks[8]
      
      const distance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) + 
        Math.pow(thumbTip.y - indexTip.y, 2)
      )
      
      // Convert to pixel distance (assuming 640px width)
      const pixelDistance = distance * 640
      
      if (pixelDistance < 40) {
        return 'pinch'
      }

      // Swipe detection: check if all fingers are extended and hand is moving
      const fingertips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]]
      const fingerBases = [landmarks[3], landmarks[6], landmarks[10], landmarks[14], landmarks[18]]
      
      // Check if fingers are extended (fingertips above bases in y-coordinate)
      const fingersExtended = fingertips.every((tip, i) => tip.y < fingerBases[i].y)
      
      if (fingersExtended) {
        // This is a simplified swipe detection - in a real implementation,
        // you'd track hand movement over time
        const palmCenter = landmarks[9] // Middle finger MCP joint
        
        // Placeholder swipe detection based on palm position
        if (palmCenter.x > 0.7) return 'swipe_right'
        if (palmCenter.x < 0.3) return 'swipe_left'
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
  }, [enabled, onGesture])

  if (!enabled) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50">
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
        {error && (
          <div className="absolute top-0 left-0 w-full h-full bg-red-500 bg-opacity-75 flex items-center justify-center text-white text-sm p-2 rounded-lg">
            {error}
          </div>
        )}
        {!isInitialized && !error && (
          <div className="absolute top-0 left-0 w-full h-full bg-blue-500 bg-opacity-75 flex items-center justify-center text-white text-sm">
            Initializing...
          </div>
        )}
      </div>
    </div>
  )
}