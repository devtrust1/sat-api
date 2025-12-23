import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import https from 'https';
import http from 'http';
import logger from '../utils/logger';

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

/**
 * Video Processing Service
 * Extracts key frames from videos for AI analysis
 */
class VideoService {
  private tempDir = path.join(__dirname, '../../temp');

  constructor() {
    // Ensure temp directory exists
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      if (!fs.existsSync(this.tempDir)) {
        await mkdir(this.tempDir, { recursive: true });
      }
    } catch (error) {
      logger.error('Error creating temp directory:', error);
    }
  }

  /**
   * Download video from URL to temp file
   */
  private async downloadVideo(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempFile = path.join(this.tempDir, `video-${Date.now()}.mp4`);
      const file = fs.createWriteStream(tempFile);

      const protocol = url.startsWith('https') ? https : http;

      protocol
        .get(url, response => {
          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve(tempFile);
          });
        })
        .on('error', err => {
          fs.unlink(tempFile, () => {});
          reject(err);
        });
    });
  }

  /**
   * Get video duration in seconds
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(metadata.format.duration || 0);
      });
    });
  }

  /**
   * Extract a single frame at specific timestamp
   */
  private async extractFrame(
    videoPath: string,
    timestamp: number,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '1280x720', // HD quality
        })
        .on('end', () => resolve())
        .on('error', err => reject(err));
    });
  }

  /**
   * Convert image to base64 data URL
   */
  private async imageToBase64(imagePath: string): Promise<string> {
    try {
      // Optimize image with sharp (compress to reduce token usage)
      const buffer = await sharp(imagePath)
        .resize(1024, 768, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (error) {
      logger.error('Error converting image to base64:', error);
      throw error;
    }
  }

  /**
   * Extract key frames from video
   * @param videoUrl - URL of the video (S3 or other)
   * @param frameCount - Number of frames to extract (default: 4)
   * @returns Array of base64 image data URLs
   */
  async extractKeyFrames(videoUrl: string, frameCount: number = 4): Promise<string[]> {
    let videoPath: string | null = null;
    const framePaths: string[] = [];

    try {
      logger.info(`Extracting ${frameCount} frames from video: ${videoUrl}`);

      // Download video
      videoPath = await this.downloadVideo(videoUrl);
      logger.info(`Video downloaded to: ${videoPath}`);

      // Get video duration
      const duration = await this.getVideoDuration(videoPath);
      logger.info(`Video duration: ${duration}s`);

      if (duration === 0) {
        throw new Error('Invalid video duration');
      }

      // Calculate timestamps for frames
      // Extract frames at: 10%, 35%, 65%, 90% of video length
      const percentages = [0.1, 0.35, 0.65, 0.9];
      const timestamps = percentages.slice(0, frameCount).map(p => duration * p);

      // Extract frames
      for (let i = 0; i < timestamps.length; i++) {
        const framePath = path.join(this.tempDir, `frame-${Date.now()}-${i}.jpg`);
        await this.extractFrame(videoPath, timestamps[i], framePath);
        framePaths.push(framePath);
        logger.info(`Extracted frame ${i + 1}/${timestamps.length}`);
      }

      // Convert frames to base64
      const base64Frames = await Promise.all(
        framePaths.map(framePath => this.imageToBase64(framePath))
      );

      logger.info(`Successfully extracted ${base64Frames.length} frames`);
      return base64Frames;
    } catch (error) {
      logger.error('Error extracting video frames:', error);
      throw error;
    } finally {
      // Cleanup temp files
      try {
        if (videoPath && fs.existsSync(videoPath)) {
          await unlink(videoPath);
        }

        for (const framePath of framePaths) {
          if (fs.existsSync(framePath)) {
            await unlink(framePath);
          }
        }
      } catch (cleanupError) {
        logger.error('Error cleaning up temp files:', cleanupError);
      }
    }
  }

  /**
   * Extract video URLs from HTML content
   */
  extractVideoUrlsFromHtml(html: string): string[] {
    const urls: string[] = [];

    // Match img tags with video file extensions
    const imgVideoRegex = /<img[^>]+src=["']([^"']+\.(?:mp4|webm|ogg|mov))["'][^>]*>/gi;
    let match;

    while ((match = imgVideoRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    // Match video tags with source
    const videoTagRegex =
      /<video[^>]*>[\s\S]*?<source[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/video>/gi;
    while ((match = videoTagRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    // Match video tags with direct src
    const videoSrcRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>/gi;
    while ((match = videoSrcRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    return urls;
  }
}

export default new VideoService();
