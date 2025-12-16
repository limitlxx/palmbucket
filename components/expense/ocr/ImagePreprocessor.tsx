/**
 * ImagePreprocessor Class
 * 
 * Handles image enhancement and preprocessing before OCR.
 * 
 * Requirements: 6.3, 6.4
 */
export class ImagePreprocessor {
  /**
   * Enhance image quality for better OCR results
   */
  static enhanceForOCR(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Apply image enhancements
    this.adjustBrightnessContrast(data, 1.2, 1.3); // Increase brightness and contrast
    this.convertToGrayscale(data);
    this.applyThreshold(data, 128); // Binary threshold for better text recognition

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Adjust brightness and contrast
   */
  private static adjustBrightnessContrast(data: Uint8ClampedArray, brightness: number, contrast: number): void {
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness
      data[i] = Math.min(255, data[i] * brightness);     // Red
      data[i + 1] = Math.min(255, data[i + 1] * brightness); // Green
      data[i + 2] = Math.min(255, data[i + 2] * brightness); // Blue
      
      // Apply contrast
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }
  }

  /**
   * Convert to grayscale
   */
  private static convertToGrayscale(data: Uint8ClampedArray): void {
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;     // Red
      data[i + 1] = gray; // Green
      data[i + 2] = gray; // Blue
      // Alpha channel (data[i + 3]) remains unchanged
    }
  }

  /**
   * Apply binary threshold
   */
  private static applyThreshold(data: Uint8ClampedArray, threshold: number): void {
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0;
      data[i] = value;     // Red
      data[i + 1] = value; // Green
      data[i + 2] = value; // Blue
    }
  }

  /**
   * Detect and correct rotation
   */
  static detectRotation(canvas: HTMLCanvasElement): number {
    // TODO: Implement rotation detection algorithm in task 2.1
    // This would analyze the image to detect text orientation
    // and return the rotation angle needed to correct it
    return 0; // Placeholder - no rotation detected
  }

  /**
   * Rotate image by specified angle
   */
  static rotateImage(canvas: HTMLCanvasElement, angle: number): HTMLCanvasElement {
    if (angle === 0) return canvas;

    const rotatedCanvas = document.createElement('canvas');
    const ctx = rotatedCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Calculate new dimensions
    const radians = (angle * Math.PI) / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    
    rotatedCanvas.width = canvas.width * cos + canvas.height * sin;
    rotatedCanvas.height = canvas.width * sin + canvas.height * cos;

    // Rotate and draw
    ctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    ctx.rotate(radians);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

    return rotatedCanvas;
  }

  /**
   * Resize image while maintaining aspect ratio
   */
  static resizeImage(canvas: HTMLCanvasElement, maxWidth: number, maxHeight: number): HTMLCanvasElement {
    const { width, height } = canvas;
    
    // Calculate new dimensions
    let newWidth = width;
    let newHeight = height;
    
    if (width > maxWidth) {
      newWidth = maxWidth;
      newHeight = (height * maxWidth) / width;
    }
    
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = (newWidth * maxHeight) / newHeight;
    }

    // If no resizing needed, return original
    if (newWidth === width && newHeight === height) {
      return canvas;
    }

    // Create resized canvas
    const resizedCanvas = document.createElement('canvas');
    const ctx = resizedCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    resizedCanvas.width = newWidth;
    resizedCanvas.height = newHeight;
    
    ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
    return resizedCanvas;
  }

  /**
   * Convert File to Canvas for processing
   */
  static async fileToCanvas(file: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Convert Canvas to Blob for further processing
   */
  static canvasToBlob(canvas: HTMLCanvasElement, quality: number = 0.9): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/jpeg', quality);
    });
  }
}