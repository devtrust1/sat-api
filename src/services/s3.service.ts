import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import logger from '../utils/logger';
import path from 'path';

class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET || '';

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    if (!this.bucketName) {
      logger.warn('AWS_S3_BUCKET not configured. S3 uploads will not work.');
    }
  }

  /**
   * Upload a file to S3
   * @param file - Express Multer file object
   * @param folder - Folder path in S3 (e.g., 'chat-media')
   * @returns S3 file URL
   */
  async uploadFile(file: Express.Multer.File, folder: string = 'chat-media'): Promise<string> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${timestamp}-${randomString}-${sanitizedName}${ext}`;

      // S3 key (path)
      const key = `${folder}/${filename}`;

      // Upload to S3
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read', // Make file publicly accessible
        },
      });

      await upload.done();

      // Construct public URL
      const fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      logger.info(`File uploaded to S3: ${fileUrl}`);

      return fileUrl;
    } catch (error: any) {
      logger.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Upload multiple files to S3
   * @param files - Array of Express Multer file objects
   * @param folder - Folder path in S3
   * @returns Array of S3 file URLs
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'chat-media'
  ): Promise<string[]> {
    try {
      const uploadPromises = files.map(file => this.uploadFile(file, folder));
      const urls = await Promise.all(uploadPromises);
      return urls;
    } catch (error: any) {
      logger.error('S3 multiple upload error:', error);
      throw new Error(`Failed to upload files to S3: ${error.message}`);
    }
  }

  /**
   * Delete a file from S3
   * @param fileUrl - Full S3 URL or just the key
   * @returns Success boolean
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Extract key from URL if full URL is provided
      let key = fileUrl;
      if (fileUrl.includes('amazonaws.com/')) {
        key = fileUrl.split('amazonaws.com/')[1];
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      logger.info(`File deleted from S3: ${key}`);
      return true;
    } catch (error: any) {
      logger.error('S3 delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple files from S3
   * @param fileUrls - Array of S3 URLs
   * @returns Number of files deleted
   */
  async deleteMultipleFiles(fileUrls: string[]): Promise<number> {
    let deletedCount = 0;
    for (const url of fileUrls) {
      const success = await this.deleteFile(url);
      if (success) deletedCount++;
    }
    return deletedCount;
  }

  /**
   * Check if S3 is configured
   * @returns Boolean indicating if S3 is ready
   */
  isConfigured(): boolean {
    return !!(
      this.bucketName &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );
  }
}

export const s3Service = new S3Service();
export default s3Service;
