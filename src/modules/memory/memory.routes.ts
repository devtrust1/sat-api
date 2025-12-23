import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { memoryController } from './memory.controller';

const router = Router();

/**
 * Memory Routes
 * Base path: /api/users/me/memories
 */

// Create a new memory
router.post('/', authenticate, authorize(), memoryController.createMemory.bind(memoryController));

// Get all memories (with optional filtering)
router.get('/', authenticate, authorize(), memoryController.getMemories.bind(memoryController));

// Get memory count
router.get(
  '/count',
  authenticate,
  authorize(),
  memoryController.getMemoryCount.bind(memoryController)
);

// Get a specific memory by ID
router.get(
  '/:id',
  authenticate,
  authorize(),
  memoryController.getMemoryById.bind(memoryController)
);

// Update a memory
router.patch(
  '/:id',
  authenticate,
  authorize(),
  memoryController.updateMemory.bind(memoryController)
);

// Delete a memory
router.delete(
  '/:id',
  authenticate,
  authorize(),
  memoryController.deleteMemory.bind(memoryController)
);

export default router;
