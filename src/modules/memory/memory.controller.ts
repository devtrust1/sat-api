import { Response } from 'express';
import { memoryService } from './memory.service';
import { CreateMemoryData, UpdateMemoryData } from './memory.types';
import { AuthRequest } from '../user/user.types';

export class MemoryController {
  /**
   * Create a new memory
   * POST /api/users/me/memories
   */
  async createMemory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const data: CreateMemoryData = req.body;

      // Validate required fields
      if (!data.type || !data.title || !data.content) {
        return res.status(400).json({ error: 'Missing required fields: type, title, content' });
      }

      const memory = await memoryService.createMemory(userId, data);
      return res.status(201).json(memory);
    } catch (error) {
      console.error('Error creating memory:', error);
      return res.status(500).json({ error: 'Failed to create memory' });
    }
  }

  /**
   * Get all memories for the authenticated user
   * GET /api/users/me/memories?type=PROGRESS&limit=10&offset=0
   */
  async getMemories(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { type, limit, offset } = req.query;

      const memories = await memoryService.getMemories(userId, {
        type: type as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      return res.json(memories);
    } catch (error) {
      console.error('Error getting memories:', error);
      return res.status(500).json({ error: 'Failed to get memories' });
    }
  }

  /**
   * Get a specific memory by ID
   * GET /api/users/me/memories/:id
   */
  async getMemoryById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const memory = await memoryService.getMemoryById(id, userId);

      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }

      return res.json(memory);
    } catch (error) {
      console.error('Error getting memory:', error);
      return res.status(500).json({ error: 'Failed to get memory' });
    }
  }

  /**
   * Update a memory
   * PATCH /api/users/me/memories/:id
   */
  async updateMemory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const data: UpdateMemoryData = req.body;

      const memory = await memoryService.updateMemory(id, userId, data);
      return res.json(memory);
    } catch (error: any) {
      console.error('Error updating memory:', error);
      if (error.message === 'Memory not found or unauthorized') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to update memory' });
    }
  }

  /**
   * Delete a memory
   * DELETE /api/users/me/memories/:id
   */
  async deleteMemory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      await memoryService.deleteMemory(id, userId);

      return res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting memory:', error);
      if (error.message === 'Memory not found or unauthorized') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to delete memory' });
    }
  }

  /**
   * Get user's learning profile for AI personalization
   * GET /api/users/me/learning-profile
   */
  async getLearningProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const profile = await memoryService.getUserLearningProfile(userId);
      return res.json(profile);
    } catch (error) {
      console.error('Error getting learning profile:', error);
      return res.status(500).json({ error: 'Failed to get learning profile' });
    }
  }

  /**
   * Get memory count by type
   * GET /api/users/me/memories/count?type=PROGRESS
   */
  async getMemoryCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { type } = req.query;
      const count = await memoryService.getMemoryCount(userId, type as any);

      return res.json({ count });
    } catch (error) {
      console.error('Error getting memory count:', error);
      return res.status(500).json({ error: 'Failed to get memory count' });
    }
  }
}

export const memoryController = new MemoryController();
