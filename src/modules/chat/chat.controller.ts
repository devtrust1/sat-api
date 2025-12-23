import { Response } from 'express';
import { AuthRequest } from '../../types';
import { openAIService } from '../../services/openai.service';
import logger from '../../utils/logger';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * POST /api/chat
 * Send message to AI chatbot with admin settings applied
 * @access Authenticated users
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Build messages array for OpenAI
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: ChatMessage, index: number) => {
        const hasImage =
          msg.content.includes('<img') &&
          (msg.content.includes('.s3.') || msg.content.includes('s3.amazonaws'));
        if (hasImage) {
          logger.info(`Conversation history message ${index} contains image`, {
            contentPreview: msg.content.substring(0, 300),
          });
        }
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Add user's new message
    messages.push({
      role: 'user',
      content: message,
    });

    logger.info(`Chat request from user ${req.user?.id}`, {
      messageLength: message.length,
      historyLength: conversationHistory?.length || 0,
      hasImgTag: message.includes('<img'),
      hasS3Url: message.includes('.s3.') || message.includes('s3.amazonaws'),
      messagePreview: message.substring(0, 200),
    });

    // Get AI response (admin settings and user personalization automatically applied in openAIService)
    const userId = req.user?.id;
    const aiResponse = await openAIService.getChatCompletion(messages, userId);

    return res.json({
      success: true,
      data: {
        response: aiResponse,
      },
    });
  } catch (error: any) {
    logger.error('Error processing chat message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get AI response',
      error: error.message,
    });
  }
};

/**
 * POST /api/chat/stream
 * Stream message response from AI chatbot with SSE
 * @access Authenticated users
 */
export const streamMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Build messages array for OpenAI
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: ChatMessage) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Add user's new message
    messages.push({
      role: 'user',
      content: message,
    });

    logger.info(`Streaming chat request from user ${req.user?.id}`, {
      messageLength: message.length,
      historyLength: conversationHistory?.length || 0,
    });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Flush headers immediately to establish SSE connection
    res.flushHeaders();

    // Get userId
    const userId = req.user?.id;

    // Stream AI response
    try {
      for await (const chunk of openAIService.streamChatCompletion(messages, userId)) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      logger.error('Error streaming chat:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    logger.error('Error processing streaming chat message:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to stream AI response',
        error: error.message,
      });
    }
  }
};
