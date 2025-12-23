import { appConfig } from '../config/app';
import logger from '../utils/logger';
import adminService from '../modules/admin/admin.service';
import { buildSystemPrompt } from '../utils/buildSystemPrompt';
import { memoryService } from '../modules/memory/memory.service';
import videoService from './video.service';
import prisma from '../config/database';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class OpenAIService {
  private apiKey: string;
  private apiUrl: string;
  private model: string;

  constructor() {
    this.apiKey = appConfig.ai.apiKey || '';
    this.apiUrl = appConfig.ai.apiUrl || 'https://api.openai.com/v1/chat/completions';
    this.model = appConfig.ai.model || 'gpt-4o';

    if (!this.apiKey) {
      logger.warn('OpenAI API key not configured');
    }
  }
  private normalizeContent(content: string): string {
    return (
      content
        // Replace 3 or more consecutive newlines with just 2 newlines
        .replace(/\n{3,}/g, '\n\n')
        // Remove spaces at the beginning of lines
        .replace(/^[ \t]+/gm, '')
        // Replace multiple spaces with single space (but keep intentional indentation)
        .replace(/[ ]{2,}/g, ' ')
        // Clean up bullet points formatting
        .replace(/\n\s*[-•*]\s*/g, '\n- ')
        // Trim each line and the entire content
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .trim()
    );
  }
  /**
   * Extract image URLs from HTML content (excludes videos)
   * Handles whiteboard submissions with embedded images
   */
  private extractImageUrlsFromHtml(html: string): string[] {
    const urls: string[] = [];

    // Match img tags with src attributes
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const url = match[1];
      // Only include S3 URLs (not base64 data URLs)
      // Exclude video files (mp4, webm, ogg, mov)
      if (
        (url.includes('.s3.') || url.includes('s3.amazonaws.com')) &&
        !url.match(/\.(mp4|webm|ogg|mov)$/i)
      ) {
        urls.push(url);
      }
    }

    return urls;
  }

  /**
   * Strip HTML tags from content, keeping only text
   */
  private stripHtmlTags(html: string): string {
    let cleaned = html
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/\[Whiteboard Submission\]/gi, '') // Remove marker
      .replace(/Your browser does not support the video tag\.?/gi, '') // Remove video error message
      .replace(/Your browser does not support the audio element\.?/gi, '') // Remove audio error message
      .replace(/&nbsp;/g, ' ') // Replace HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    // If the cleaned text is empty or too short (likely just noise), return empty string
    if (cleaned.length < 3) {
      return '';
    }

    return cleaned;
  }

  /**
   * Process message content to handle HTML with embedded images
   * Converts HTML content to proper Vision API format
   */
  private processMessageContent(
    content: string
  ): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
    // Check if content contains HTML with images
    if (
      content.includes('<img') &&
      (content.includes('.s3.') || content.includes('s3.amazonaws.com'))
    ) {
      const imageUrls = this.extractImageUrlsFromHtml(content);
      if (imageUrls.length > 0) {
        // Extract text content (strip HTML)
        const textContent = this.stripHtmlTags(content);

        // Build content array for Vision API
        const contentArray: Array<{
          type: string;
          text?: string;
          image_url?: { url: string; detail?: string };
        }> = [];

        // Add text if present
        if (textContent) {
          contentArray.push({
            type: 'text',
            text: textContent,
          });
        }
        // Add all images
        imageUrls.forEach(url => {
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: url,
              detail: 'high', // Request high detail for better analysis
            },
          });
        });

        return contentArray;
      }
    }

    // Return as-is if no images found
    return content;
  }

  /**
   * Analyze whiteboard content (image and/or text)
   * Uses GPT-4 Vision for image analysis
   * @param canvasData - Base64 canvas image data
   * @param textContent - Text written on whiteboard
   * @param language - User's preferred language (en, es, hi, zh)
   */
  async analyzeWhiteboardContent(
    canvasData?: string,
    textContent?: string,
    language: string = 'en'
  ): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Language names for system prompt
      const languageNames: Record<string, string> = {
        en: 'English',
        es: 'Spanish',
        hi: 'Hindi',
        zh: 'Chinese',
      };

      const languageName = languageNames[language] || 'English';

      let systemPrompt = `You are a helpful SAT tutor assistant analyzing student's whiteboard submissions.

⚠️ CRITICAL: OBSERVE ACCURATELY - DO NOT MAKE ASSUMPTIONS

The student can submit ANY type of content:
- Text, essays, notes, or written explanations
- Math problems, equations, or calculations
- Geometric shapes, diagrams, or drawings
- Images, screenshots, or photos
- Videos or visual content
- Mixed content (text + images + drawings)
- Anything else they create

YOUR MANDATORY PROCESS:

1. **OBSERVE CAREFULLY**: Look at what is actually submitted
   - DO NOT assume or guess what the student "meant" to create
   - DO NOT jump to conclusions
   - Take time to observe all details

2. **IDENTIFY ACCURATELY**: Describe exactly what you see
   - If you see text: Read it carefully and quote key parts
   - If you see shapes: Count sides/corners and identify correctly
     * 3 sides = triangle
     * 4 sides = rectangle/square
     * Round = circle
   - If you see images: Describe what's in the images
   - If you see equations: Read the exact notation
   - If you see mixed content: Acknowledge all parts

3. **DESCRIBE FIRST**: Start your response by stating what you observed
   - Example: "I can see you've written the equation x² + 5x + 6 = 0"
   - Example: "I can see you've drawn a rectangle with sides labeled 4 and 3"
   - Example: "I can see you've uploaded an image showing a graph with..."
   - Example: "I can see you've written text explaining..."

4. **THEN ANALYZE & HELP**: Based on what you actually identified
   - Provide relevant guidance for the specific content type
   - If it's math: Show solution steps
   - If it's writing: Give feedback and suggestions
   - If it's a concept question: Explain clearly
   - Be specific to what they actually submitted

5. **BE SUPPORTIVE**: Encourage the student while maintaining accuracy

REMEMBER:
- Accuracy in observation is your PRIMARY task
- Different submissions need different types of help
- Never force content into a category it doesn't fit
- "I see X" should always match what's actually there`;

      // Add language instruction if not English
      if (language !== 'en') {
        systemPrompt += ` IMPORTANT: Always respond in ${languageName}. The user's preferred language is ${languageName}, so all your responses must be in ${languageName}.`;
      }

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
      ];

      // Check if textContent contains S3 image/video URLs (HTML format)
      let s3ImageUrls: string[] = [];
      let s3VideoUrls: string[] = [];
      let cleanTextContent = textContent;

      if (textContent) {
        const hasHtmlTags = textContent.includes('<');
        const hasS3Url = textContent.includes('.s3.') || textContent.includes('s3.amazonaws');

        if (hasHtmlTags && hasS3Url) {
          // Extract images and videos separately
          s3ImageUrls = this.extractImageUrlsFromHtml(textContent);
          s3VideoUrls = videoService.extractVideoUrlsFromHtml(textContent);
          cleanTextContent = this.stripHtmlTags(textContent);
        } else if (hasHtmlTags) {
          // HTML present but no S3 URLs - still strip HTML
          cleanTextContent = this.stripHtmlTags(textContent);
        }
      }

      // Process videos: extract frames from each video
      const videoFrames: string[] = [];
      if (s3VideoUrls.length > 0) {
        for (const videoUrl of s3VideoUrls) {
          try {
            const frames = await videoService.extractKeyFrames(videoUrl, 4); // Extract 4 frames
            videoFrames.push(...frames);
          } catch (error) {
            logger.error(`Failed to extract frames from video ${videoUrl}:`, error);
            // Continue with other videos even if one fails
          }
        }
      }

      // Build the user message with images, video frames, and text
      if (s3ImageUrls.length > 0 || videoFrames.length > 0) {
        // Build intro text
        let introText = '';
        const hasDrawing = !!canvasData;

        if (s3VideoUrls.length > 0 && s3ImageUrls.length > 0) {
          if (hasDrawing) {
            introText = cleanTextContent
              ? `I created a drawing on the whiteboard, uploaded ${s3VideoUrls.length} video(s) and ${s3ImageUrls.length} image(s), and wrote: "${cleanTextContent}". Please observe carefully and describe what you see in ALL of them, then help me with it.`
              : `I created a drawing on the whiteboard and uploaded ${s3VideoUrls.length} video(s) and ${s3ImageUrls.length} image(s). Please observe carefully and describe what you see in ALL of them, then help me understand or solve it.`;
          } else {
            introText = cleanTextContent
              ? `I uploaded ${s3VideoUrls.length} video(s) and ${s3ImageUrls.length} image(s), and wrote: "${cleanTextContent}". Please observe carefully and describe what you see, then help me with it.`
              : `I uploaded ${s3VideoUrls.length} video(s) and ${s3ImageUrls.length} image(s) from my whiteboard. Please observe carefully and describe what you see, then help me understand or solve it.`;
          }
        } else if (s3VideoUrls.length > 0) {
          if (hasDrawing) {
            introText = cleanTextContent
              ? `I created a drawing on the whiteboard and uploaded a video with text: "${cleanTextContent}". Below are key frames from the video. Please observe carefully and analyze BOTH the drawing and video, then help me with it.`
              : 'I created a drawing on the whiteboard and uploaded a video. Below are key frames from the video. Please observe carefully and analyze BOTH the drawing and video, then help me understand or solve it.';
          } else {
            introText = cleanTextContent
              ? `I uploaded a video and wrote: "${cleanTextContent}". Below are key frames from the video. Please observe carefully and describe what you see, then help me with it.`
              : 'I uploaded a video from my whiteboard. Below are key frames from the video. Please observe carefully and describe what you see, then help me understand or solve it.';
          }
        } else {
          if (hasDrawing) {
            introText = cleanTextContent
              ? `I created a drawing on the whiteboard and uploaded this image with text: "${cleanTextContent}". Please observe carefully and analyze BOTH the drawing and image, then help me with it.`
              : 'I created a drawing on the whiteboard and uploaded this image. Please observe carefully and analyze BOTH the drawing and image, then help me understand or solve it.';
          } else {
            introText = cleanTextContent
              ? `I uploaded this image and wrote: "${cleanTextContent}". Please observe carefully and describe what you see, then help me with it.`
              : 'I uploaded this image from my whiteboard. Please observe carefully and describe what you see, then help me understand or solve it.';
          }
        }

        const contentArray: Array<{
          type: string;
          text?: string;
          image_url?: { url: string; detail?: string };
        }> = [
          {
            type: 'text',
            text: introText,
          },
        ];

        // Add canvas drawing if present (IMPORTANT: Add this BEFORE videos/images)
        if (canvasData) {
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: canvasData,
              detail: 'high',
            },
          });
        }

        // Add all regular images
        s3ImageUrls.forEach(url => {
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: url,
              detail: 'high',
            },
          });
        });

        // Add all video frames
        videoFrames.forEach((frameBase64, index) => {
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: frameBase64,
              detail: 'high',
            },
          });
        });

        messages.push({
          role: 'user',
          content: contentArray,
        });
      } else if (canvasData && textContent) {
        // Canvas drawing + text
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `I created this on the whiteboard and also typed: "${textContent}". Please observe carefully and tell me exactly what you see, then help me with it.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: canvasData, // base64 data URL
                detail: 'high', // Use high detail for better accuracy
              },
            },
          ],
        });
      } else if (canvasData) {
        // Canvas drawing only
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'I created this on the whiteboard. Please observe carefully and describe exactly what you see (text, shapes, drawings, diagrams, etc.), then help me understand or solve it.',
            },
            {
              type: 'image_url',
              image_url: {
                url: canvasData,
                detail: 'high', // Use high detail for better accuracy
              },
            },
          ],
        });
      } else if (textContent) {
        // Text only (no images) - strip HTML if present
        const cleanText = textContent.includes('<') ? this.stripHtmlTags(textContent) : textContent;

        messages.push({
          role: 'user',
          content: cleanText
            ? `I wrote this on the whiteboard: "${cleanText}". Please help me understand or solve it.`
            : 'I submitted something from the whiteboard. Please help me with SAT practice.',
        });
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          max_tokens: 1500, // Increased to allow for detailed identification and explanation
          temperature: 0.3, // Very low temperature for maximum accuracy in shape identification
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = (await response.json()) as OpenAIResponse;
      const rawContent =
        data.choices[0]?.message?.content || 'Sorry, I could not analyze your whiteboard content.';

      return (
        this.normalizeContent(rawContent) || 'Sorry, I could not analyze your whiteboard content.'
      );
    } catch (error) {
      logger.error('Error analyzing whiteboard with OpenAI:', error);
      throw error;
    }
  }

  /**
   * Build personalized learning context from user profile
   */
  private async buildLearningContext(userId: string): Promise<string> {
    try {
      const profile = await memoryService.getUserLearningProfile(userId);

      if (!profile || profile.preferredSubjects.length === 0) {
        return ''; // No personalization data available
      }

      let context = '\n\n--- STUDENT LEARNING PROFILE ---\n';

      // Add preferred subjects
      if (profile.preferredSubjects.length > 0) {
        context += `Preferred subjects: ${profile.preferredSubjects.join(', ')}\n`;
      }

      // Add difficulty level
      context += `Current level: ${profile.difficulty}\n`;

      // Add strengths
      if (profile.strengths.length > 0) {
        context += `Strengths: ${profile.strengths.join(', ')}\n`;
      }

      // Add areas needing work
      if (profile.weaknesses.length > 0) {
        context += `Areas needing improvement: ${profile.weaknesses.join(', ')}\n`;
      }

      // Add recent topics
      if (profile.recentTopics.length > 0) {
        context += `Recent topics studied: ${profile.recentTopics.join(', ')}\n`;
      }

      // Add study stats
      context += `Total study time: ${profile.totalStudyMinutes} minutes\n`;
      context += `Average accuracy: ${profile.averageAccuracy}%\n`;

      // Add personalization instructions
      context += `
--- PERSONALIZATION INSTRUCTIONS ---
- Adjust difficulty to match the student's ${profile.difficulty} level
- Build on their strengths in ${profile.strengths.join(' and ') || 'their known areas'}
- Provide extra support for ${profile.weaknesses.join(' and ') || 'challenging topics'}
- Reference recent topics when relevant to reinforce learning
- Use examples related to their preferred subjects when possible
- Encourage progress and celebrate improvements
`;

      return context;
    } catch (error) {
      logger.error('Error building learning context:', error);
      return ''; // Return empty string if profile fetch fails
    }
  }

  /**
   * Get user's preferred language from UserSettings
   */
  private async getUserLanguage(userId: string): Promise<string> {
    try {
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { language: true },
      });
      return userSettings?.language || 'en';
    } catch (error) {
      logger.error('Error getting user language:', error);
      return 'en';
    }
  }

  /**
   * Build language instruction for system prompt
   */
  private buildLanguageInstruction(language: string): string {
    const languageNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      hi: 'Hindi',
      zh: 'Chinese',
    };

    const languageName = languageNames[language] || 'English';

    if (language === 'en') {
      return ''; // No extra instruction needed for English
    }

    return `\n\nIMPORTANT LANGUAGE INSTRUCTION: You MUST respond in ${languageName}. The user's preferred language is ${languageName}, so ALL your responses must be written in ${languageName}. Do not respond in English unless the user specifically asks for it.`;
  }

  /**
   * Get chat completion with admin settings and user personalization applied
   */
  async getChatCompletion(messages: ChatMessage[], userId?: string): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Fetch admin settings from database
      const adminSettings = await adminService.getSettings();

      // Build dynamic system prompt based on admin settings
      let systemPrompt = buildSystemPrompt(adminSettings);

      // Add personalization if userId is provided
      if (userId) {
        const learningContext = await this.buildLearningContext(userId);
        if (learningContext) {
          systemPrompt += learningContext;
        }

        // Add language instruction based on user's preference
        const userLanguage = await this.getUserLanguage(userId);
        systemPrompt += this.buildLanguageInstruction(userLanguage);
      }

      // Process messages to extract images from HTML content (for whiteboard submissions)
      const processedMessages = messages
        .filter(msg => msg.role !== 'system') // Remove any existing system messages
        .map(msg => {
          // Only process string content (not already formatted arrays)
          if (typeof msg.content === 'string') {
            const processed = this.processMessageContent(msg.content);
            return { ...msg, content: processed };
          }
          // Return as-is if already an array or other format
          return msg;
        });

      const messagesWithSystem: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...processedMessages,
      ];

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messagesWithSystem,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = (await response.json()) as OpenAIResponse;
      return data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    } catch (error) {
      logger.error('Error calling OpenAI:', error);
      throw error;
    }
  }

  /**
   * Stream chat completion with admin settings and user personalization applied
   * Yields tokens as they arrive from OpenAI
   */
  async *streamChatCompletion(
    messages: ChatMessage[],
    userId?: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Fetch admin settings from database
      const adminSettings = await adminService.getSettings();

      // Build dynamic system prompt based on admin settings
      let systemPrompt = buildSystemPrompt(adminSettings);

      // Add personalization if userId is provided
      if (userId) {
        const learningContext = await this.buildLearningContext(userId);
        if (learningContext) {
          systemPrompt += learningContext;
        }

        // Add language instruction based on user's preference
        const userLanguage = await this.getUserLanguage(userId);
        systemPrompt += this.buildLanguageInstruction(userLanguage);
      }

      // Process messages to extract images from HTML content
      const processedMessages = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => {
          if (typeof msg.content === 'string') {
            const processed = this.processMessageContent(msg.content);
            return { ...msg, content: processed };
          }
          return msg;
        });

      const messagesWithSystem: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...processedMessages,
      ];

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messagesWithSystem,
          max_tokens: 500,
          temperature: 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            logger.error('Error parsing SSE chunk:', e);
          }
        }
      }
    } catch (error) {
      logger.error('Error streaming from OpenAI:', error);
      throw error;
    }
  }

  /**
   * Stream whiteboard analysis
   */
  async *streamWhiteboardAnalysis(
    canvasData?: string,
    textContent?: string,
    language: string = 'en'
  ): AsyncGenerator<string, void, unknown> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const languageNames: Record<string, string> = {
        en: 'English',
        es: 'Spanish',
        hi: 'Hindi',
        zh: 'Chinese',
      };

      const languageName = languageNames[language] || 'English';

      let systemPrompt = `You are a helpful SAT tutor assistant analyzing student's whiteboard submissions.

⚠️ CRITICAL: OBSERVE ACCURATELY - DO NOT MAKE ASSUMPTIONS

The student can submit ANY type of content:
- Text, essays, notes, or written explanations
- Math problems, equations, or calculations
- Geometric shapes, diagrams, or drawings
- Images, screenshots, or photos
- Videos or visual content
- Mixed content (text + images + drawings)
- Anything else they create

YOUR MANDATORY PROCESS:

1. **OBSERVE CAREFULLY**: Look at what is actually submitted
   - DO NOT assume or guess what the student "meant" to create
   - DO NOT jump to conclusions
   - Take time to observe all details

2. **IDENTIFY ACCURATELY**: Describe exactly what you see
   - If you see text: Read it carefully and quote key parts
   - If you see shapes: Count sides/corners and identify correctly
     * 3 sides = triangle
     * 4 sides = rectangle/square
     * Round = circle
   - If you see images: Describe what's in the images
   - If you see equations: Read the exact notation
   - If you see mixed content: Acknowledge all parts

3. **DESCRIBE FIRST**: Start your response by stating what you observed
   - Example: "I can see you've written the equation x² + 5x + 6 = 0"
   - Example: "I can see you've drawn a rectangle with sides labeled 4 and 3"
   - Example: "I can see you've uploaded an image showing a graph with..."
   - Example: "I can see you've written text explaining..."

4. **THEN ANALYZE & HELP**: Based on what you actually identified
   - Provide relevant guidance for the specific content type
   - If it's math: Show solution steps
   - If it's writing: Give feedback and suggestions
   - If it's a concept question: Explain clearly
   - Be specific to what they actually submitted

5. **BE SUPPORTIVE**: Encourage the student while maintaining accuracy

REMEMBER:
- Accuracy in observation is your PRIMARY task
- Different submissions need different types of help
- Never force content into a category it doesn't fit
- "I see X" should always match what's actually there`;

      if (language !== 'en') {
        systemPrompt += ` IMPORTANT: Always respond in ${languageName}. The user's preferred language is ${languageName}, so all your responses must be in ${languageName}.`;
      }

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
      ];

      // Check if textContent contains S3 image/video URLs
      let s3ImageUrls: string[] = [];
      let s3VideoUrls: string[] = [];
      let cleanTextContent = textContent;

      if (textContent) {
        const hasHtmlTags = textContent.includes('<');
        const hasS3Url = textContent.includes('.s3.') || textContent.includes('s3.amazonaws');

        if (hasHtmlTags && hasS3Url) {
          s3ImageUrls = this.extractImageUrlsFromHtml(textContent);
          s3VideoUrls = videoService.extractVideoUrlsFromHtml(textContent);
          cleanTextContent = this.stripHtmlTags(textContent);
        } else if (hasHtmlTags) {
          cleanTextContent = this.stripHtmlTags(textContent);
        }
      }

      // Process videos
      const videoFrames: string[] = [];
      if (s3VideoUrls.length > 0) {
        for (const videoUrl of s3VideoUrls) {
          try {
            const frames = await videoService.extractKeyFrames(videoUrl, 4);
            videoFrames.push(...frames);
          } catch (error) {
            logger.error(`Failed to extract frames from video ${videoUrl}:`, error);
          }
        }
      }

      // Build user message
      if (s3ImageUrls.length > 0 || videoFrames.length > 0) {
        let introText = '';

        if (s3VideoUrls.length > 0 && s3ImageUrls.length > 0 && canvasData) {
          introText = cleanTextContent
            ? `I created a drawing on the whiteboard, uploaded ${s3VideoUrls.length} video(s) and ${s3ImageUrls.length} image(s), and wrote: "${cleanTextContent}". Please observe carefully and describe what you see in ALL of them, then help me with it.`
            : `I created a drawing on the whiteboard and uploaded ${s3VideoUrls.length} video(s) and ${s3ImageUrls.length} image(s). Please observe carefully and describe what you see in ALL of them, then help me understand or solve it.`;
        } else if (s3VideoUrls.length > 0 && canvasData) {
          introText = cleanTextContent
            ? `I created a drawing on the whiteboard, uploaded a video, and wrote: "${cleanTextContent}". Below are my drawing and key frames from the video. Please observe carefully and describe what you see in BOTH, then help me with it.`
            : 'I created a drawing on the whiteboard and uploaded a video. Below are my drawing and key frames from the video. Please observe carefully and describe what you see in BOTH, then help me understand or solve it.';
        } else if (s3ImageUrls.length > 0 && canvasData) {
          introText = cleanTextContent
            ? `I created a drawing on the whiteboard, uploaded ${s3ImageUrls.length} image(s), and wrote: "${cleanTextContent}". Please observe carefully and describe what you see in ALL of them, then help me with it.`
            : `I created a drawing on the whiteboard and uploaded ${s3ImageUrls.length} image(s). Please observe carefully and describe what you see in ALL of them, then help me understand or solve it.`;
        } else if (s3VideoUrls.length > 0 && s3ImageUrls.length > 0) {
          introText = cleanTextContent
            ? `I uploaded ${s3VideoUrls.length} video(s) and ${s3ImageUrls.length} image(s), and wrote: "${cleanTextContent}". Please observe carefully and describe what you see, then help me with it.`
            : `I uploaded ${s3VideoUrls.length} video(s) and ${s3ImageUrls.length} image(s) from my whiteboard. Please observe carefully and describe what you see, then help me understand or solve it.`;
        } else if (s3VideoUrls.length > 0) {
          introText = cleanTextContent
            ? `I uploaded a video and wrote: "${cleanTextContent}". Below are key frames from the video. Please observe carefully and describe what you see, then help me with it.`
            : 'I uploaded a video from my whiteboard. Below are key frames from the video. Please observe carefully and describe what you see, then help me understand or solve it.';
        } else {
          introText = cleanTextContent
            ? `I uploaded this image and wrote: "${cleanTextContent}". Please observe carefully and describe what you see, then help me with it.`
            : 'I uploaded this image from my whiteboard. Please observe carefully and describe what you see, then help me understand or solve it.';
        }

        const contentArray: Array<{
          type: string;
          text?: string;
          image_url?: { url: string; detail?: string };
        }> = [
          {
            type: 'text',
            text: introText,
          },
        ];

        // Add canvas drawing first if present
        if (canvasData) {
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: canvasData,
              detail: 'high',
            },
          });
        }

        s3ImageUrls.forEach(url => {
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: url,
              detail: 'high',
            },
          });
        });

        videoFrames.forEach(frameBase64 => {
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: frameBase64,
              detail: 'high',
            },
          });
        });

        messages.push({
          role: 'user',
          content: contentArray,
        });
      } else if (canvasData && textContent) {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `I created this on the whiteboard and also typed: "${textContent}". Please observe carefully and tell me exactly what you see, then help me with it.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: canvasData,
                detail: 'high',
              },
            },
          ],
        });
      } else if (canvasData) {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'I created this on the whiteboard. Please observe carefully and describe exactly what you see (text, shapes, drawings, diagrams, etc.), then help me understand or solve it.',
            },
            {
              type: 'image_url',
              image_url: {
                url: canvasData,
                detail: 'high',
              },
            },
          ],
        });
      } else if (textContent) {
        const cleanText = textContent.includes('<') ? this.stripHtmlTags(textContent) : textContent;

        messages.push({
          role: 'user',
          content: cleanText
            ? `I wrote this on the whiteboard: "${cleanText}". Please help me understand or solve it.`
            : 'I submitted something from the whiteboard. Please help me with SAT practice.',
        });
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          max_tokens: 1500,
          temperature: 0.3,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            logger.error('Error parsing SSE chunk:', e);
          }
        }
      }
    } catch (error) {
      logger.error('Error streaming whiteboard analysis:', error);
      throw error;
    }
  }
}

export const openAIService = new OpenAIService();
