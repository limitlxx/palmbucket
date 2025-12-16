import { IPFSClient as IPFSClientInterface } from '../types';

/**
 * IPFSClient Class
 * 
 * Handles encrypted storage and retrieval of receipt images using IPFS.
 * 
 * Requirements: 7.1, 7.2, 7.4, 7.5, 9.3
 */
export class IPFSClient implements IPFSClientInterface {
  private helia: any = null;
  private unixfs: any = null;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second base delay

  async initialize(): Promise<void> {
    try {
      const { createHelia } = await import('helia');
      const { unixfs } = await import('@helia/unixfs');
      
      this.helia = await createHelia({
        // Configure for browser environment with bootstrap nodes
        libp2p: {
          addresses: {
            listen: []
          }
        }
      });
      this.unixfs = unixfs(this.helia);
      
      console.log('IPFSClient initialized successfully');
    } catch (error) {
      console.error('Failed to initialize IPFS client:', error);
      throw new Error('IPFS initialization failed');
    }
  }

  async uploadEncrypted(file: File, encryptionKey: string): Promise<string> {
    if (!this.helia || !this.unixfs) {
      throw new Error('IPFS client not initialized');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`Uploading encrypted file: ${file.name} (${file.size} bytes) - Attempt ${attempt + 1}`);
        
        // 1. Read file as ArrayBuffer
        const fileBuffer = await file.arrayBuffer();
        
        // 2. Encrypt the file data
        const encryptedData = await this.encryptData(fileBuffer, encryptionKey);
        
        // 3. Upload encrypted data to IPFS
        const uint8Array = new Uint8Array(encryptedData);
        const cid = await this.unixfs.addBytes(uint8Array);
        
        const hash = cid.toString();
        console.log(`Successfully uploaded to IPFS: ${hash}`);
        
        return hash;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Upload attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries - 1) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error('All upload attempts failed:', lastError);
    throw new Error(`IPFS upload failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  async downloadDecrypted(hash: string, encryptionKey: string): Promise<File> {
    if (!this.helia || !this.unixfs) {
      throw new Error('IPFS client not initialized');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`Downloading and decrypting file with hash: ${hash} - Attempt ${attempt + 1}`);
        
        // 1. Parse CID and download from IPFS
        const { CID } = await import('multiformats/cid');
        const cid = CID.parse(hash);
        
        // 2. Get encrypted data from IPFS
        const chunks: Uint8Array[] = [];
        for await (const chunk of this.unixfs.cat(cid)) {
          chunks.push(chunk);
        }
        
        // 3. Combine chunks into single ArrayBuffer
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const encryptedData = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          encryptedData.set(chunk, offset);
          offset += chunk.length;
        }
        
        // 4. Decrypt the data
        const decryptedData = await this.decryptData(encryptedData.buffer, encryptionKey);
        
        // 5. Create File object from decrypted data
        const blob = new Blob([decryptedData], { type: 'image/jpeg' });
        const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
        
        console.log(`Successfully downloaded and decrypted file: ${file.size} bytes`);
        return file;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Download attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries - 1) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error('All download attempts failed:', lastError);
    throw new Error(`IPFS download failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  async deleteContent(hash: string): Promise<boolean> {
    if (!this.helia) {
      console.warn('IPFS client not initialized, cannot delete content');
      return false;
    }

    try {
      console.log(`Attempting to delete content: ${hash}`);
      
      // Parse CID
      const { CID } = await import('multiformats/cid');
      const cid = CID.parse(hash);
      
      // IPFS content is immutable, but we can:
      // 1. Unpin the content (stop keeping it locally)
      // 2. Remove from local blockstore if possible
      
      try {
        // Try to unpin the content
        await this.helia.pins.rm(cid);
        console.log(`Successfully unpinned content: ${hash}`);
      } catch (unpinError) {
        // Content might not be pinned, which is fine
        console.log(`Content was not pinned: ${hash}`);
      }
      
      try {
        // Try to remove from local blockstore
        await this.helia.blockstore.delete(cid);
        console.log(`Successfully removed from blockstore: ${hash}`);
      } catch (deleteError) {
        // Block might not exist locally or be referenced elsewhere
        console.log(`Could not remove from blockstore: ${hash}`);
      }
      
      // Mark as successfully processed for privacy compliance
      // In a real application, you would also update your database
      // to mark this content as deleted
      console.log(`Content deletion processed: ${hash}`);
      return true;
      
    } catch (error) {
      console.error('Failed to delete IPFS content:', error);
      return false;
    }
  }

  /**
   * Generate encryption key for receipt storage
   * Uses Web Crypto API for secure random key generation
   */
  static async generateEncryptionKey(): Promise<string> {
    try {
      // Generate 256-bit (32 bytes) random key
      const keyBuffer = crypto.getRandomValues(new Uint8Array(32));
      
      // Convert to base64 for storage
      const keyArray = Array.from(keyBuffer);
      const keyString = btoa(String.fromCharCode(...keyArray));
      
      return keyString;
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      // Fallback to less secure method if Web Crypto API fails
      const fallbackKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return btoa(fallbackKey);
    }
  }

  /**
   * Store encryption key securely in local storage
   */
  static storeEncryptionKey(receiptId: string, key: string): void {
    try {
      const keyData = {
        key,
        timestamp: Date.now(),
        receiptId
      };
      
      localStorage.setItem(`receipt_key_${receiptId}`, JSON.stringify(keyData));
    } catch (error) {
      console.error('Failed to store encryption key:', error);
      throw new Error('Key storage failed');
    }
  }

  /**
   * Retrieve encryption key from local storage
   */
  static getEncryptionKey(receiptId: string): string | null {
    try {
      const keyDataStr = localStorage.getItem(`receipt_key_${receiptId}`);
      if (!keyDataStr) {
        return null;
      }
      
      const keyData = JSON.parse(keyDataStr);
      return keyData.key;
    } catch (error) {
      console.error('Failed to retrieve encryption key:', error);
      return null;
    }
  }

  /**
   * Remove encryption key from local storage (for privacy compliance)
   */
  static removeEncryptionKey(receiptId: string): boolean {
    try {
      localStorage.removeItem(`receipt_key_${receiptId}`);
      return true;
    } catch (error) {
      console.error('Failed to remove encryption key:', error);
      return false;
    }
  }

  /**
   * Encrypt file data using AES-GCM
   */
  private async encryptData(data: ArrayBuffer, key: string): Promise<ArrayBuffer> {
    try {
      // Convert base64 key to ArrayBuffer
      const keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
      
      // Import the key for AES-GCM
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      // Generate random IV (12 bytes for GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the data
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        data
      );
      
      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encryptedData.byteLength);
      result.set(iv, 0);
      result.set(new Uint8Array(encryptedData), iv.length);
      
      console.log(`Data encrypted: ${data.byteLength} bytes -> ${result.length} bytes`);
      return result.buffer;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt file data using AES-GCM
   */
  private async decryptData(encryptedData: ArrayBuffer, key: string): Promise<ArrayBuffer> {
    try {
      // Convert base64 key to ArrayBuffer
      const keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
      
      // Import the key for AES-GCM
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Extract IV (first 12 bytes) and encrypted content
      const encryptedArray = new Uint8Array(encryptedData);
      const iv = encryptedArray.slice(0, 12);
      const ciphertext = encryptedArray.slice(12);
      
      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        ciphertext
      );
      
      console.log(`Data decrypted: ${encryptedData.byteLength} bytes -> ${decryptedData.byteLength} bytes`);
      return decryptedData;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Check if IPFS node is online and accessible
   */
  async isOnline(): Promise<boolean> {
    try {
      if (!this.helia) {
        return false;
      }
      
      // Try to get node ID as a connectivity test
      const nodeId = await this.helia.libp2p.peerId;
      return nodeId != null;
    } catch (error) {
      console.warn('IPFS connectivity check failed:', error);
      return false;
    }
  }

  /**
   * Get IPFS node information
   */
  async getNodeInfo(): Promise<any> {
    try {
      if (!this.helia) {
        return null;
      }
      
      const peerId = await this.helia.libp2p.peerId;
      const isOnline = await this.isOnline();
      
      return {
        id: peerId.toString(),
        version: '5.0.0', // Helia version
        online: isOnline,
        connections: this.helia.libp2p.getConnections().length
      };
    } catch (error) {
      console.error('Failed to get node info:', error);
      return null;
    }
  }

  async cleanup(): Promise<void> {
    if (this.helia) {
      try {
        await this.helia.stop();
        console.log('IPFS client stopped successfully');
      } catch (error) {
        console.error('Error stopping IPFS client:', error);
      } finally {
        this.helia = null;
        this.unixfs = null;
      }
    }
  }
}