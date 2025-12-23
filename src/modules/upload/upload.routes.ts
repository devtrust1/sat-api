import express from 'express';
import { uploadController } from './upload.controller';
import {
  uploadSingle,
  uploadMultiple,
  validateFileSizes,
  handleUploadError,
} from '../../middleware/upload.middleware';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = express.Router();

// Upload single file
router.post(
  '/single',
  authenticate,
  authorize(),
  uploadSingle,
  validateFileSizes,
  handleUploadError,
  uploadController.uploadSingle
);

// Upload multiple files
router.post(
  '/multiple',
  uploadMultiple,
  validateFileSizes,
  handleUploadError,
  uploadController.uploadMultiple
);

// Get file info
router.get('/info/:filename', uploadController.getFileInfo);

export default router;
