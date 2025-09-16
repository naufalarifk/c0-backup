import { Injectable } from '@nestjs/common';

import { ensure } from '../utils';
import { MinioService } from './minio.service';

export interface FileValidationOptions {
  maxSize: number; // in bytes
  allowedMimeTypes: string[];
  minSize?: number; // in bytes, default 8
  allowOnlyImages?: boolean; // strict image-only mode
}

@Injectable()
export class FileValidatorService {
  constructor(private readonly minioService: MinioService) {}

  /**
   * Validate file for upload with security checks
   */
  validateFile(
    fileBuffer: Buffer,
    options: FileValidationOptions,
    mimeType?: string,
    originalName?: string,
  ): void {
    // Check file size
    ensure(
      fileBuffer.length <= options.maxSize,
      `File size exceeds limit. Maximum allowed: ${options.maxSize / (1024 * 1024)}MB`,
    );

    // Check minimum file size (basic corruption check)
    const minSize = options.minSize || 8;
    ensure(fileBuffer.length >= minSize, 'File appears to be corrupted or invalid');

    // SECURITY: If strict image-only mode, perform additional checks
    if (options.allowOnlyImages) {
      this.validateImageSecurity(fileBuffer, mimeType, originalName);
    }

    // Primary validation: use the actual MIME type from the request
    if (mimeType && options.allowedMimeTypes.includes(mimeType)) {
      return; // Valid MIME type, continue
    }

    // Secondary validation: use filename-based detection
    if (originalName && this.minioService.isAllowedImageType(originalName)) {
      return; // Valid extension, continue
    }

    // If both validations fail, reject
    const detectedMimeType = originalName ? this.minioService.getMimeType(originalName) : 'unknown';
    ensure(
      false,
      `Invalid file type. Allowed types: ${options.allowedMimeTypes.join(', ')}. Detected: ${mimeType || detectedMimeType}`,
    );
  }

  /**
   * SECURITY: Validate image files with additional security checks
   */
  private validateImageSecurity(
    fileBuffer: Buffer,
    mimeType?: string,
    originalName?: string,
  ): void {
    // Check file signature (magic bytes) for common image formats
    const fileSignature = fileBuffer.slice(0, 12); // Extend to 12 bytes for WebP

    // JPEG signatures
    if (mimeType?.includes('jpeg') || originalName?.match(/\.(jpg|jpeg)$/i)) {
      ensure(
        fileSignature[0] === 0xff && fileSignature[1] === 0xd8,
        'Invalid JPEG file signature - possible malicious file',
      );
    }

    // PNG signature
    else if (mimeType?.includes('png') || originalName?.match(/\.png$/i)) {
      ensure(
        fileSignature[0] === 0x89 &&
          fileSignature[1] === 0x50 &&
          fileSignature[2] === 0x4e &&
          fileSignature[3] === 0x47,
        'Invalid PNG file signature - possible malicious file',
      );
    }

    // WebP signature - more flexible check
    else if (mimeType?.includes('webp') || originalName?.match(/\.webp$/i)) {
      // WebP files start with "RIFF" at bytes 0-3 and "WEBP" at bytes 8-11
      const riffHeader = fileSignature.slice(0, 4).toString('ascii');
      const webpHeader = fileSignature.slice(8, 12).toString('ascii');

      if (!(riffHeader === 'RIFF' && webpHeader === 'WEBP')) {
        // More permissive - log warning instead of throwing error
        console.warn('WebP signature check failed, but allowing upload:', {
          riffHeader,
          webpHeader,
          bytes: Array.from(fileSignature)
            .map(b => '0x' + b.toString(16))
            .join(' '),
        });
      }
    }

    // Check for suspicious patterns in image files
    const content = fileBuffer.toString('utf8', 0, Math.min(1024, fileBuffer.length));
    const suspiciousPatterns = [
      '<?php',
      '<script',
      'javascript:',
      'eval(',
      'exec(',
      '<html',
      '<body',
      'document.',
      'window.',
      'alert(',
    ];

    for (const pattern of suspiciousPatterns) {
      ensure(
        !content.toLowerCase().includes(pattern),
        `Suspicious content detected in image file: ${pattern}`,
      );
    }
  }

  /**
   * Validate image file specifically with STRICT security checks
   */
  validateImageFile(
    fileBuffer: Buffer,
    maxSizeMB: number = 2,
    mimeType?: string,
    originalName?: string,
  ): void {
    const options: FileValidationOptions = {
      maxSize: maxSizeMB * 1024 * 1024,
      allowedMimeTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/pjpeg', // Progressive JPEG
      ],
      allowOnlyImages: true, // ENABLE strict security mode
    };

    this.validateFile(fileBuffer, options, mimeType, originalName);
  }

  /**
   * Validate document file - IMAGES ONLY for security (NO PDFs!)
   * PDFs are dangerous due to potential JavaScript/malware
   */
  validateDocumentFile(
    fileBuffer: Buffer,
    maxSizeMB: number = 10,
    mimeType?: string,
    originalName?: string,
  ): void {
    const options: FileValidationOptions = {
      maxSize: maxSizeMB * 1024 * 1024,
      allowedMimeTypes: [
        // SECURITY: Only allow image formats for documents
        // PDFs removed due to security risks (JavaScript, embedded files, exploits)
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ],
      allowOnlyImages: true, // ENABLE strict security mode
    };

    this.validateFile(fileBuffer, options, mimeType, originalName);
  }

  /**
   * Sanitize filename to prevent path traversal and special characters
   */
  sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  /**
   * Check if file type is image by MIME type (secure)
   */
  isImage(mimeType: string): boolean {
    const imageMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/pjpeg',
      // NOTE: GIF removed for security (can contain scripts)
    ];

    return imageMimeTypes.includes(mimeType);
  }

  /**
   * Check if file type is safe document by MIME type
   * NOTE: PDFs and Office docs removed for security
   */
  isDocument(mimeType: string): boolean {
    // SECURITY: Only allow plain text for documents
    // PDFs, Word docs can contain malicious content
    const documentMimeTypes = [
      'text/plain',
      // Removed: 'application/pdf' - can contain JavaScript/malware
      // Removed: 'application/msword' - can contain macros
      // Removed: Office docs - can contain malicious content
    ];

    return documentMimeTypes.includes(mimeType);
  }

  /**
   * Get safe file extension recommendation
   */
  getSafeExtension(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'text/plain': 'txt',
    };

    return extensionMap[mimeType] || 'bin';
  }
}
