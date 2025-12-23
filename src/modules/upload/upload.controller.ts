import { Request, Response } from 'express';
import { getFileUrl } from '../../middleware/upload.middleware';
import s3Service from '../../services/s3.service';
import logger from '../../utils/logger';

// Extend Request type to include Multer file properties
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

export const uploadController = {
  /**
   * Upload single file
   * POST /api/v1/upload/single
   */
  uploadSingle: async (req: MulterRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      // Check if S3 is configured
      if (!s3Service.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: 'S3 storage is not configured. Please contact administrator.',
        });
      }

      // Upload to S3
      const fileUrl = await s3Service.uploadFile(req.file, 'chat-media');

      // Extract filename from URL for backward compatibility
      const filename = fileUrl.split('/').pop() || req.file.originalname;

      logger.info(`File uploaded to S3: ${filename}`);

      return res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          filename: filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: fileUrl, // S3 public URL
          type: req.file.mimetype.startsWith('image/') ? 'image' : 'video',
        },
      });
    } catch (error: any) {
      logger.error('Upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file',
        error: error.message,
      });
    }
  },

  /**
   * Upload multiple files
   * POST /api/v1/upload/multiple
   */
  uploadMultiple: async (req: MulterRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
      }

      // Check if S3 is configured
      if (!s3Service.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: 'S3 storage is not configured. Please contact administrator.',
        });
      }

      // Upload all files to S3
      const uploadPromises = files.map(async file => {
        const fileUrl = await s3Service.uploadFile(file, 'chat-media');
        const filename = fileUrl.split('/').pop() || file.originalname;

        return {
          filename: filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: fileUrl, // S3 public URL
          type: file.mimetype.startsWith('image/') ? 'image' : 'video',
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      logger.info(`${files.length} files uploaded to S3 successfully`);

      return res.status(200).json({
        success: true,
        message: `${files.length} files uploaded successfully`,
        data: {
          files: uploadedFiles,
          count: files.length,
        },
      });
    } catch (error: any) {
      logger.error('Upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload files',
        error: error.message,
      });
    }
  },

  /**
   * Get file info
   * GET /api/v1/upload/info/:filename
   */
  getFileInfo: async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const fs = require('fs');
      const path = require('path');

      const filePath = path.join(__dirname, '../../../uploads/chat-media', filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      const stats = fs.statSync(filePath);
      const ext = path.extname(filename);
      const mimetype =
        ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.png'
            ? 'image/png'
            : ext === '.gif'
              ? 'image/gif'
              : ext === '.webp'
                ? 'image/webp'
                : ext === '.mp4'
                  ? 'video/mp4'
                  : ext === '.webm'
                    ? 'video/webm'
                    : ext === '.ogg'
                      ? 'video/ogg'
                      : 'application/octet-stream';

      return res.status(200).json({
        success: true,
        data: {
          filename,
          size: stats.size,
          mimetype,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          url: getFileUrl(req, filename),
        },
      });
    } catch (error: any) {
      logger.error('Get file info error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get file info',
        error: error.message,
      });
    }
  },
};
