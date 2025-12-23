import multer from 'multer';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

// Ensure upload directories exist (for fallback local storage)
const uploadDir = path.join(__dirname, '../../uploads/chat-media');
const tempDir = path.join(__dirname, '../../uploads/temp');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Use memory storage for S3 uploads (files stored in buffer, not disk)
const storage = multer.memoryStorage();

// File size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25MB for videos

// File filter for validation
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed mime types
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

  if (allowedTypes.includes(file.mimetype)) {
    // Check file size based on type
    const maxSize = file.mimetype.startsWith('image/') ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

    // Note: multer doesn't provide file size in fileFilter, so we'll check in error handler
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Only images (JPEG, PNG, GIF, WebP - max 10MB) and videos (MP4, WebM, OGG, MOV - max 25MB) are allowed.`
      )
    );
  }
};

// Multer configuration
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use max video size as overall limit (25MB)
    files: 5, // Max 5 files per request
  },
});

// Single file upload
export const uploadSingle = uploadMiddleware.single('file');

// Multiple files upload
export const uploadMultiple = uploadMiddleware.array('files', 5);

// Middleware to validate file sizes based on type
export const validateFileSizes = (req: any, res: any, next: any) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);

    for (const file of files) {
      const maxSize = file.mimetype.startsWith('image/') ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
      const maxSizeMB = file.mimetype.startsWith('image/') ? '10MB' : '25MB';

      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname} exceeds ${maxSizeMB} limit (${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
        });
      }
    }

    next();
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: 'File validation error',
    });
  }
};

// Error handling middleware
export const handleUploadError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds limit (Images: 10MB, Videos: 25MB)',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 files allowed per upload',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed',
    });
  }
  next();
};

// Helper function to get file URL
export const getFileUrl = (req: any, filename: string): string => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/api/v1/uploads/chat-media/${filename}`;
};

// Helper function to delete file
export const deleteFile = (filename: string): boolean => {
  try {
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Deleted file: ${filename}`);
      return true;
    }
    return false;
  } catch (error: any) {
    logger.error(`Error deleting file ${filename}:`, error.message);
    return false;
  }
};

// Helper function to delete multiple files
export const deleteFiles = (filenames: string[]): number => {
  let deletedCount = 0;
  filenames.forEach(filename => {
    if (deleteFile(filename)) {
      deletedCount++;
    }
  });
  return deletedCount;
};

// Cleanup old files based on retention policy
export const cleanupOldFiles = async (retentionDays: number): Promise<number> => {
  try {
    const files = fs.readdirSync(uploadDir);
    const now = Date.now();
    const maxAge = retentionDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.info(`Cleaned up old file: ${file}`);
      }
    }

    logger.info(`Cleanup completed: ${deletedCount} files deleted`);
    return deletedCount;
  } catch (error: any) {
    logger.error('Error during file cleanup:', error.message);
    return 0;
  }
};

export default {
  uploadSingle,
  uploadMultiple,
  validateFileSizes,
  handleUploadError,
  getFileUrl,
  deleteFile,
  deleteFiles,
  cleanupOldFiles,
};
