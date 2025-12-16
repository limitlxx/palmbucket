import { OCRProcessor, OCRResult, ExtractedExpense } from '../types';
import { ImagePreprocessor } from './ImagePreprocessor';
import { PDFParse } from "pdf-parse";

/**
 * TesseractProcessor Class
 * 
 * Handles OCR processing using Tesseract.js for receipt image analysis.
 * Implements image preprocessing, PDF extraction, and progress tracking.
 * 
 * Requirements: 1.1, 1.2, 6.3, 6.4, 9.4
 */
export class TesseractProcessor implements OCRProcessor {
  private worker: any = null;
  private isInitialized: boolean = false;
  private progressCallback?: (progress: number) => void;

  constructor(progressCallback?: (progress: number) => void) {
    this.progressCallback = progressCallback;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.reportProgress(10);
      const { createWorker } = await import('tesseract.js');
      
      this.reportProgress(30);
      this.worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            this.reportProgress(50 + (m.progress * 40));
          }
        }
      });

      this.reportProgress(70);
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/$-: \n',
        tessedit_pageseg_mode: '6', // Uniform block of text
        preserve_interword_spaces: '1'
      });

      this.reportProgress(100);
      this.isInitialized = true;
      console.log('TesseractProcessor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Tesseract worker:', error);
      throw new Error('OCR initialization failed');
    }
  }

  private reportProgress(progress: number): void {
    if (this.progressCallback) {
      this.progressCallback(Math.min(100, Math.max(0, progress)));
    }
  }

  async processReceipt(imageFile: File): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      this.reportProgress(0);

      // Handle PDF files
      if (imageFile.type === 'application/pdf') {
        const images = await this.extractImagesFromPDF(imageFile);
        if (images.length === 0) {
          throw new Error('No images found in PDF');
        }
        // Process the first image for now
        imageFile = images[0];
      }

      // Validate image format
      if (!this.isValidImageFormat(imageFile)) {
        throw new Error('Unsupported image format. Please use JPG, PNG, or HEIC.');
      }

      this.reportProgress(20);

      // Convert file to canvas for preprocessing
      const canvas = await ImagePreprocessor.fileToCanvas(imageFile);
      
      this.reportProgress(30);

      // Apply image enhancements
      const enhancedCanvas = await this.enhanceImageForOCR(canvas);
      
      this.reportProgress(40);

      // Convert enhanced canvas back to blob
      const enhancedBlob = await ImagePreprocessor.canvasToBlob(enhancedCanvas);
      
      this.reportProgress(50);

      // Perform OCR recognition
      const { data } = await this.worker.recognize(enhancedBlob);
      
      this.reportProgress(90);

      const extractedData = this.extractExpenseData(data.text);
      const processingTime = Date.now() - startTime;

      this.reportProgress(100);

      return {
        text: data.text,
        confidence: data.confidence / 100, // Convert to 0-1 range
        extractedData,
        processingTime,
      };
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error(`Failed to process receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractImagesFromPDF(pdfFile: File): Promise<File[]> {
    try {
      // const pdfParse = await import('pdf-parse');
      // const arrayBuffer = await pdfFile.arrayBuffer();
      // const data = await pdfParse.default(Buffer.from(arrayBuffer));
      
      // const { PDFParse } = await import('pdf-parse');

      const arrayBuffer = await pdfFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const parser = new PDFParse({ data: buffer });  // Pass Buffer or Uint8Array as 'data'
      const data = await parser.getText();

      // For now, we'll create a simple text-based image from PDF text
      // In a full implementation, you'd extract actual images from the PDF
      if (data.text.trim()) {
        // Create a canvas with the PDF text rendered as an image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        canvas.width = 800;
        canvas.height = 600;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        
        const lines = data.text.split('\n');
        lines.forEach((line: any, index: any) => {
          ctx.fillText(line, 20, 30 + (index * 20));
        });

        const blob = await ImagePreprocessor.canvasToBlob(canvas);
        return [new File([blob], 'pdf-extracted.jpg', { type: 'image/jpeg' })];
      }
      
      return [];
    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw new Error('Failed to extract images from PDF');
    }
  }

  private isValidImageFormat(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];
    return validTypes.includes(file.type.toLowerCase());
  }

  private async enhanceImageForOCR(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    // Detect and correct rotation
    const rotationAngle = ImagePreprocessor.detectRotation(canvas);
    let processedCanvas = canvas;
    
    if (rotationAngle !== 0) {
      processedCanvas = ImagePreprocessor.rotateImage(processedCanvas, rotationAngle);
    }

    // Resize if too large (optimize for OCR performance)
    processedCanvas = ImagePreprocessor.resizeImage(processedCanvas, 2000, 2000);

    // Apply OCR-specific enhancements
    processedCanvas = ImagePreprocessor.enhanceForOCR(processedCanvas);

    return processedCanvas;
  }

  enhanceImage(imageData: ImageData): ImageData {
    const data = imageData.data;
    
    // Apply brightness and contrast adjustment
    this.adjustBrightnessContrast(data, 1.2, 1.3);
    
    // Convert to grayscale for better OCR
    this.convertToGrayscale(data);
    
    // Apply noise reduction
    this.reduceNoise(data, imageData.width, imageData.height);
    
    // Apply sharpening filter
    this.applySharpen(data, imageData.width, imageData.height);
    
    return imageData;
  }

  private adjustBrightnessContrast(data: Uint8ClampedArray, brightness: number, contrast: number): void {
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness
      data[i] = Math.min(255, data[i] * brightness);
      data[i + 1] = Math.min(255, data[i + 1] * brightness);
      data[i + 2] = Math.min(255, data[i + 2] * brightness);
      
      // Apply contrast
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }
  }

  private convertToGrayscale(data: Uint8ClampedArray): void {
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  }

  private reduceNoise(data: Uint8ClampedArray, width: number, height: number): void {
    // Simple median filter for noise reduction
    const original = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Get surrounding pixels
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            neighbors.push(original[nIdx]);
          }
        }
        
        // Apply median value
        neighbors.sort((a, b) => a - b);
        const median = neighbors[Math.floor(neighbors.length / 2)];
        
        data[idx] = median;
        data[idx + 1] = median;
        data[idx + 2] = median;
      }
    }
  }

  private applySharpen(data: Uint8ClampedArray, width: number, height: number): void {
    // Sharpening kernel
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];
    
    const original = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        let sum = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const nIdx = ((y + ky) * width + (x + kx)) * 4;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            sum += original[nIdx] * kernel[kernelIdx];
          }
        }
        
        const sharpened = Math.min(255, Math.max(0, sum));
        data[idx] = sharpened;
        data[idx + 1] = sharpened;
        data[idx + 2] = sharpened;
      }
    }
  }

  extractExpenseData(text: string): ExtractedExpense {
    const cleanText = this.cleanOCRText(text);
    
    // Extract date with multiple format support
    const date = this.extractDate(cleanText);
    
    // Extract amount with currency symbol handling
    const amount = this.extractAmount(cleanText);
    
    // Extract merchant name using text analysis
    const merchant = this.extractMerchant(cleanText);
    
    // Classify category using keyword-based algorithm
    const category = this.classifyCategory(cleanText, merchant);
    
    // Calculate confidence score based on extraction quality
    const confidence = this.calculateConfidence(date, amount, merchant, cleanText);

    return {
      date,
      amount,
      merchant,
      category,
      confidence,
      rawText: text,
    };
  }

  private cleanOCRText(text: string): string {
    return text
      .replace(/[^\w\s\$\.\,\-\/\:]/g, ' ') // Remove special characters except common receipt ones
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private extractDate(text: string): string {
    // Multiple date format patterns
    const datePatterns = [
      // MM/DD/YYYY or MM/DD/YY
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      // DD/MM/YYYY or DD/MM/YY
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      // MM-DD-YYYY or MM-DD-YY
      /(\d{1,2}-\d{1,2}-\d{2,4})/,
      // DD-MM-YYYY or DD-MM-YY
      /(\d{1,2}-\d{1,2}-\d{2,4})/,
      // YYYY/MM/DD
      /(\d{4}\/\d{1,2}\/\d{1,2})/,
      // YYYY-MM-DD
      /(\d{4}-\d{1,2}-\d{1,2})/,
      // Month DD, YYYY
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
      // DD Month YYYY
      /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return this.normalizeDate(match[0]);
      }
    }

    // Fallback to current date
    return new Date().toLocaleDateString();
  }

  private normalizeDate(dateStr: string): string {
    try {
      // Try to parse and normalize the date
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    } catch (error) {
      console.warn('Date parsing failed:', error);
    }
    
    return dateStr; // Return original if parsing fails
  }

  private extractAmount(text: string): number {
    // Enhanced amount extraction patterns
    const amountPatterns = [
      // $XX.XX format
      /\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})/g,
      // XX.XX format (without $)
      /(?:^|\s)(\d{1,3}(?:,\d{3})*\.\d{2})(?:\s|$)/g,
      // Total/Amount followed by number
      /(?:total|amount|sum|charge|cost)[\s:]*\$?\s*(\d{1,3}(?:,\d{3})*\.\d{2})/gi,
      // Balance or final amount
      /(?:balance|final|grand\s*total)[\s:]*\$?\s*(\d{1,3}(?:,\d{3})*\.\d{2})/gi
    ];

    const amounts: number[] = [];
    
    for (const pattern of amountPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (amount > 0 && amount < 10000) { // Reasonable range for receipts
          amounts.push(amount);
        }
      }
    }

    if (amounts.length === 0) {
      return 0;
    }

    // Prefer amounts that appear near "total" keywords
    const totalKeywords = ['total', 'amount', 'sum', 'charge', 'balance'];
    const textLower = text.toLowerCase();
    
    for (const keyword of totalKeywords) {
      const keywordIndex = textLower.indexOf(keyword);
      if (keywordIndex !== -1) {
        // Find amounts near this keyword
        const nearbyAmounts = amounts.filter(amount => {
          const amountStr = amount.toString();
          const amountIndex = text.indexOf(amountStr);
          return Math.abs(amountIndex - keywordIndex) < 50; // Within 50 characters
        });
        
        if (nearbyAmounts.length > 0) {
          return Math.max(...nearbyAmounts); // Return largest nearby amount
        }
      }
    }

    // Fallback to largest amount found
    return Math.max(...amounts);
  }

  private extractMerchant(text: string): string {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    // Skip common receipt elements
    const skipPatterns = [
      /^\d+$/, // Pure numbers
      /\$\d+/, // Amounts
      /\d{1,2}\/\d{1,2}\/\d{2,4}/, // Dates
      /^(total|subtotal|tax|amount|balance|change|cash|credit|debit)$/i,
      /^(thank you|receipt|copy|customer|cashier)$/i,
      /^[a-z]{1,3}$/i, // Very short words
      /^\d{1,2}:\d{2}/, // Times
      /^[\d\s\-\(\)]+$/ // Phone numbers or similar
    ];

    // Look for merchant name (usually first meaningful line)
    for (const line of lines) {
      if (line.length < 3 || line.length > 50) continue;
      
      const shouldSkip = skipPatterns.some(pattern => pattern.test(line));
      if (!shouldSkip) {
        // Clean up the merchant name
        return this.cleanMerchantName(line);
      }
    }

    // Fallback: look for lines with mixed case or all caps that might be merchant names
    for (const line of lines) {
      if (line.length >= 3 && line.length <= 50) {
        const hasLetters = /[a-zA-Z]/.test(line);
        const hasNumbers = /\d/.test(line);
        
        if (hasLetters && !hasNumbers) {
          return this.cleanMerchantName(line);
        }
      }
    }

    return 'Unknown Merchant';
  }

  private cleanMerchantName(name: string): string {
    return name
      .replace(/[^\w\s&\-\.]/g, '') // Keep only alphanumeric, spaces, &, -, .
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private calculateConfidence(date: string, amount: number, merchant: string, text: string): number {
    let confidence = 0;
    
    // Date confidence
    if (date && date !== new Date().toLocaleDateString()) {
      confidence += 0.25;
    } else if (date) {
      confidence += 0.15; // Lower confidence for fallback date
    }
    
    // Amount confidence
    if (amount > 0) {
      confidence += 0.35;
      // Higher confidence for amounts with currency symbols
      if (text.includes('$')) {
        confidence += 0.1;
      }
    }
    
    // Merchant confidence
    if (merchant && merchant !== 'Unknown Merchant') {
      confidence += 0.25;
      // Higher confidence for longer, more descriptive names
      if (merchant.length > 5) {
        confidence += 0.05;
      }
    }
    
    // Text quality confidence
    const textLength = text.replace(/\s/g, '').length;
    if (textLength > 50) {
      confidence += 0.1; // More text usually means better OCR
    }
    
    return Math.min(1.0, Math.max(0.1, confidence));
  }

  private classifyCategory(text: string, merchant: string): string {
    const combinedText = (text + ' ' + merchant).toLowerCase();
    
    // Define category classification rules with keywords and merchant patterns
    const categoryRules = [
      {
        category: 'groceries',
        keywords: ['grocery', 'market', 'supermarket', 'food', 'produce', 'deli', 'bakery'],
        merchantPatterns: [
          /walmart/i, /target/i, /kroger/i, /safeway/i, /whole foods/i, 
          /trader joe/i, /costco/i, /sam's club/i, /aldi/i, /publix/i
        ]
      },
      {
        category: 'transportation',
        keywords: ['gas', 'fuel', 'station', 'shell', 'exxon', 'bp', 'chevron', 'mobil', 'parking', 'toll'],
        merchantPatterns: [
          /shell/i, /exxon/i, /bp/i, /chevron/i, /mobil/i, /citgo/i, 
          /speedway/i, /wawa/i, /parking/i, /uber/i, /lyft/i
        ]
      },
      {
        category: 'dining',
        keywords: ['restaurant', 'cafe', 'coffee', 'dining', 'bar', 'grill', 'pizza', 'burger', 'taco'],
        merchantPatterns: [
          /mcdonald/i, /burger king/i, /subway/i, /starbucks/i, /pizza/i,
          /taco bell/i, /kfc/i, /wendy/i, /chipotle/i, /panera/i
        ]
      },
      {
        category: 'healthcare',
        keywords: ['pharmacy', 'medical', 'health', 'doctor', 'clinic', 'hospital', 'dental', 'vision'],
        merchantPatterns: [
          /cvs/i, /walgreens/i, /rite aid/i, /pharmacy/i, /medical/i, 
          /clinic/i, /hospital/i, /dental/i, /vision/i
        ]
      },
      {
        category: 'entertainment',
        keywords: ['movie', 'theater', 'cinema', 'game', 'arcade', 'bowling', 'golf', 'gym', 'fitness'],
        merchantPatterns: [
          /amc/i, /regal/i, /cinemark/i, /netflix/i, /spotify/i, 
          /gym/i, /fitness/i, /planet fitness/i, /la fitness/i
        ]
      },
      {
        category: 'shopping',
        keywords: ['store', 'shop', 'retail', 'clothing', 'apparel', 'shoes', 'electronics', 'home'],
        merchantPatterns: [
          /amazon/i, /ebay/i, /best buy/i, /home depot/i, /lowes/i,
          /macy/i, /nordstrom/i, /gap/i, /nike/i, /apple/i
        ]
      },
      {
        category: 'bills',
        keywords: ['utility', 'electric', 'water', 'internet', 'phone', 'cable', 'insurance', 'rent', 'mortgage'],
        merchantPatterns: [
          /verizon/i, /att/i, /comcast/i, /electric/i, /water/i,
          /insurance/i, /rent/i, /mortgage/i, /utility/i
        ]
      },
      {
        category: 'personal_care',
        keywords: ['salon', 'spa', 'barber', 'beauty', 'cosmetic', 'hair', 'nail', 'massage'],
        merchantPatterns: [
          /salon/i, /spa/i, /barber/i, /beauty/i, /sephora/i, 
          /ulta/i, /massage/i, /hair/i, /nail/i
        ]
      }
    ];

    // Check each category rule
    for (const rule of categoryRules) {
      // Check keywords
      const hasKeyword = rule.keywords.some(keyword => combinedText.includes(keyword));
      
      // Check merchant patterns
      const matchesPattern = rule.merchantPatterns.some(pattern => pattern.test(combinedText));
      
      if (hasKeyword || matchesPattern) {
        return rule.category;
      }
    }

    // Advanced pattern matching for specific receipt formats
    if (this.isGasStationReceipt(combinedText)) {
      return 'transportation';
    }
    
    if (this.isRestaurantReceipt(combinedText)) {
      return 'dining';
    }
    
    if (this.isGroceryReceipt(combinedText)) {
      return 'groceries';
    }

    return 'uncategorized';
  }

  private isGasStationReceipt(text: string): boolean {
    const gasIndicators = ['gallon', 'gal', 'unleaded', 'premium', 'diesel', 'fuel', 'pump'];
    return gasIndicators.some(indicator => text.includes(indicator));
  }

  private isRestaurantReceipt(text: string): boolean {
    const restaurantIndicators = ['server', 'table', 'tip', 'gratuity', 'menu', 'order', 'dine'];
    return restaurantIndicators.some(indicator => text.includes(indicator));
  }

  private isGroceryReceipt(text: string): boolean {
    const groceryIndicators = ['produce', 'dairy', 'frozen', 'aisle', 'checkout', 'cashier', 'bag'];
    return groceryIndicators.some(indicator => text.includes(indicator));
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
        this.worker = null;
        this.isInitialized = false;
        console.log('TesseractProcessor cleaned up successfully');
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
  }

  // Additional utility methods for progress tracking and error handling
  
  setProgressCallback(callback: (progress: number) => void): void {
    this.progressCallback = callback;
  }

  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  async reinitialize(): Promise<void> {
    await this.cleanup();
    await this.initialize();
  }
}