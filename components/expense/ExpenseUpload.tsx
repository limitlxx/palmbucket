'use client';

import React, { useState, useCallback, useRef } from 'react';
import { ExpenseUploadProps, ExtractedExpense } from './types';

/**
 * ExpenseUpload Component
 * 
 * Handles receipt upload via drag-and-drop or camera capture.
 * Processes images using OCR to extract expense data.
 * 
 * Requirements: 1.1, 1.2, 6.1, 6.2
 */
export const ExpenseUpload: React.FC<ExpenseUploadProps> = ({
  onExpenseExtracted,
  onUploadComplete,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const validateFile = (file: File): boolean => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'application/pdf'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      alert('Please upload a valid image (JPG, PNG, HEIC) or PDF file.');
      return false;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('File size must be less than 10MB.');
      return false;
    }

    return true;
  };

  const createImagePreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFiles = async (files: FileList) => {
    const file = files[0];
    if (!file || !validateFile(file)) return;

    setCurrentFile(file);
    createImagePreview(file);
    setRotation(0);
    setZoom(1);

    setIsProcessing(true);
    
    try {
      // TODO: Implement OCR processing in task 2
      // For now, create a mock extracted expense
      const mockExpense: ExtractedExpense = {
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        merchant: 'Unknown Merchant',
        category: 'Uncategorized',
        confidence: 0.5,
        rawText: 'OCR processing not yet implemented'
      };

      onExpenseExtracted(mockExpense);
      onUploadComplete('mock-receipt-hash');
    } catch (error) {
      console.error('Error processing receipt:', error);
      alert('Error processing receipt. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and create file
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCurrentFile(file);
        createImagePreview(file);
        stopCamera();
        
        // Process the captured image
        const fileList = new DataTransfer();
        fileList.items.add(file);
        handleFiles(fileList.files);
      }
    }, 'image/jpeg', 0.9);
  };

  const rotateImage = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const clearPreview = () => {
    setPreviewImage(null);
    setCurrentFile(null);
    setRotation(0);
    setZoom(1);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Camera View */}
      {isCameraActive && (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-64 object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Camera Controls */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
            <button
              onClick={capturePhoto}
              className="bg-white text-black p-3 rounded-full hover:bg-gray-100 transition-colors"
              title="Capture Photo"
            >
              📷
            </button>
            <button
              onClick={stopCamera}
              className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700 transition-colors"
              title="Close Camera"
            >
              ✕
            </button>
          </div>
          
          {/* Receipt Detection Overlay */}
          <div className="absolute inset-4 border-2 border-green-400 border-dashed rounded-lg pointer-events-none">
            <div className="absolute -top-6 left-0 bg-green-400 text-white px-2 py-1 rounded text-xs">
              Position receipt within frame
            </div>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {previewImage && !isCameraActive && (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden">
          <div className="relative overflow-hidden" style={{ height: '400px' }}>
            <img
              src={previewImage}
              alt="Receipt preview"
              className="w-full h-full object-contain transition-transform duration-200"
              style={{
                transform: `rotate(${rotation}deg) scale(${zoom})`,
                transformOrigin: 'center'
              }}
            />
          </div>
          
          {/* Image Controls */}
          <div className="absolute top-4 right-4 flex space-x-2">
            <button
              onClick={rotateImage}
              className="bg-white bg-opacity-90 p-2 rounded-full hover:bg-opacity-100 transition-all"
              title="Rotate Image"
            >
              🔄
            </button>
            <button
              onClick={() => handleZoom(0.1)}
              className="bg-white bg-opacity-90 p-2 rounded-full hover:bg-opacity-100 transition-all"
              title="Zoom In"
            >
              🔍+
            </button>
            <button
              onClick={() => handleZoom(-0.1)}
              className="bg-white bg-opacity-90 p-2 rounded-full hover:bg-opacity-100 transition-all"
              title="Zoom Out"
            >
              🔍-
            </button>
            <button
              onClick={clearPreview}
              className="bg-red-600 bg-opacity-90 text-white p-2 rounded-full hover:bg-opacity-100 transition-all"
              title="Remove Image"
            >
              ✕
            </button>
          </div>
          
          {/* Zoom indicator */}
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            Zoom: {Math.round(zoom * 100)}%
          </div>
        </div>
      )}

      {/* Upload Area */}
      {!previewImage && !isCameraActive && (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-all
            ${dragActive ? 'border-blue-400 bg-blue-50 scale-105' : 'border-gray-300'}
            ${isProcessing ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400 hover:bg-gray-50'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {isProcessing ? (
            <div className="space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-lg font-medium text-gray-900">Processing receipt...</p>
              <p className="text-sm text-gray-600">Extracting expense data using OCR</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-gray-400">
                <svg className="mx-auto h-16 w-16" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-medium text-gray-900">Upload Receipt</p>
                <p className="text-base text-gray-600 mt-2">Drag and drop your receipt here, or click to select</p>
                <p className="text-sm text-gray-500 mt-2">Supports JPG, PNG, HEIC, and PDF files (max 10MB)</p>
              </div>
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept="image/*,.pdf"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Action Buttons */}
      {!previewImage && !isCameraActive && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            disabled={isProcessing}
            onClick={startCamera}
          >
            📷 Capture with Camera
          </button>
          <label className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium text-center cursor-pointer">
            📁 Choose File
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </label>
        </div>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <div>
              <p className="font-medium text-blue-900">Processing Receipt</p>
              <p className="text-sm text-blue-700">Extracting expense details using OCR technology</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};