import { PrismaClient } from '@prisma/client';
import { AdminSettingsData, AdminSettingsResponse, AdminStats } from './admin.types';

const prisma = new PrismaClient();

// Default settings
const DEFAULT_SETTINGS: AdminSettingsData = {
  toneSelectors: {
    friendly: true,
    academic: false,
    neutral: false,
    motivational: false,
  },
  subjects: {
    math: true,
    science: true,
    history: true,
    languages: true,
  },
  aiSystemPrompt: [
    'You are an encouraging learning assistant that uses Socratic questioning.',
    'Guide students to discover answers themselves rather than providing direct solutions.',
  ],
  languages: {
    english: true,
    spanish: false,
    chinese: true,
    hindi: true,
  },
  speechEngine: 'whisper', // ASR: whisper, google, azure, deepgram, assembly, vosk
  voiceEngine: 'azure', // TTS: azure, elevenlabs, playht, polly, coqui
  dataRetention: true,
  retentionDuration: '30',
  safetyMode: true,
};

class AdminService {
  /**
   * Get admin settings (creates default if not exists)
   */
  async getSettings(): Promise<AdminSettingsResponse> {
    // Check if settings exist
    let settings = await prisma.adminSettings.findFirst();

    // If no settings exist, create default
    if (!settings) {
      settings = await prisma.adminSettings.create({
        data: {
          toneSelectors: DEFAULT_SETTINGS.toneSelectors as any,
          subjects: DEFAULT_SETTINGS.subjects as any,
          aiSystemPrompt: DEFAULT_SETTINGS.aiSystemPrompt as any,
          languages: DEFAULT_SETTINGS.languages as any,
          speechEngine: DEFAULT_SETTINGS.speechEngine,
          voiceEngine: DEFAULT_SETTINGS.voiceEngine,
          dataRetention: DEFAULT_SETTINGS.dataRetention,
          retentionDuration: DEFAULT_SETTINGS.retentionDuration,
          safetyMode: DEFAULT_SETTINGS.safetyMode,
          updatedBy: 'system',
        },
      });
    }

    return this.formatSettings(settings);
  }

  /**
   * Update admin settings (partial update - best practice)
   */
  async updateSettings(
    userId: string,
    updates: Partial<AdminSettingsData>
  ): Promise<AdminSettingsResponse> {
    // Get existing settings
    let settings = await prisma.adminSettings.findFirst();
    const previousLanguages = settings?.languages as any;

    // Handle language updates - ensure at least one language is enabled
    if (updates.languages) {
      const langs = updates.languages as any;
      const enabledCount = Object.values(langs).filter(v => v === true).length;

      // If all languages are disabled, auto-enable English
      if (enabledCount === 0) {
        langs.english = true;
      }

      updates.languages = langs;
    }

    // If no settings exist, create with defaults merged with updates
    if (!settings) {
      settings = await prisma.adminSettings.create({
        data: {
          ...DEFAULT_SETTINGS,
          ...updates,
          toneSelectors: (updates.toneSelectors || DEFAULT_SETTINGS.toneSelectors) as any,
          subjects: (updates.subjects || DEFAULT_SETTINGS.subjects) as any,
          aiSystemPrompt: (updates.aiSystemPrompt || DEFAULT_SETTINGS.aiSystemPrompt) as any,
          languages: (updates.languages || DEFAULT_SETTINGS.languages) as any,
          updatedBy: userId,
        },
      });
    } else {
      // Update existing settings
      const updateData: any = { updatedBy: userId };

      if (updates.toneSelectors) updateData.toneSelectors = updates.toneSelectors;
      if (updates.subjects) updateData.subjects = updates.subjects;
      if (updates.aiSystemPrompt) updateData.aiSystemPrompt = updates.aiSystemPrompt;
      if (updates.languages) updateData.languages = updates.languages;
      if (updates.speechEngine !== undefined) updateData.speechEngine = updates.speechEngine;
      if (updates.voiceEngine !== undefined) updateData.voiceEngine = updates.voiceEngine;
      if (updates.dataRetention !== undefined) updateData.dataRetention = updates.dataRetention;
      if (updates.retentionDuration !== undefined)
        updateData.retentionDuration = updates.retentionDuration;
      if (updates.safetyMode !== undefined) updateData.safetyMode = updates.safetyMode;

      settings = await prisma.adminSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    // If languages were updated, update all affected users
    if (updates.languages && previousLanguages) {
      await this.updateUsersForDisabledLanguages(previousLanguages, updates.languages as any);
    }

    return this.formatSettings(settings);
  }

  /**
   * Update all users who have a disabled language to first available enabled language
   */
  private async updateUsersForDisabledLanguages(
    previousLangs: Record<string, boolean>,
    newLangs: Record<string, boolean>
  ): Promise<void> {
    // Language code mapping: admin key -> user language code
    const langCodeMap: Record<string, string> = {
      english: 'en',
      spanish: 'es',
      hindi: 'hi',
      chinese: 'zh',
    };

    // Find fallback language - prioritize English if enabled, otherwise first enabled
    let fallbackLanguage = 'en';
    if (!newLangs.english) {
      // English is disabled, find first enabled language
      for (const [key, isEnabled] of Object.entries(newLangs)) {
        if (isEnabled) {
          fallbackLanguage = langCodeMap[key] || 'en';
          break;
        }
      }
    }

    // Find all language codes that are now disabled
    const disabledLanguageCodes: string[] = [];
    for (const [key, isEnabled] of Object.entries(newLangs)) {
      if (!isEnabled) {
        const code = langCodeMap[key];
        if (code) {
          disabledLanguageCodes.push(code);
        }
      }
    }

    if (disabledLanguageCodes.length === 0) return;

    // Update all UserSettings where language is in the disabled list
    await prisma.userSettings.updateMany({
      where: {
        language: { in: disabledLanguageCodes },
      },
      data: {
        language: fallbackLanguage,
      },
    });

    // Also update User.preferredLang for consistency
    await prisma.user.updateMany({
      where: {
        preferredLang: { in: disabledLanguageCodes },
      },
      data: {
        preferredLang: fallbackLanguage,
      },
    });
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(userId: string): Promise<AdminSettingsResponse> {
    let settings = await prisma.adminSettings.findFirst();

    if (!settings) {
      settings = await prisma.adminSettings.create({
        data: {
          ...DEFAULT_SETTINGS,
          toneSelectors: DEFAULT_SETTINGS.toneSelectors as any,
          subjects: DEFAULT_SETTINGS.subjects as any,
          aiSystemPrompt: DEFAULT_SETTINGS.aiSystemPrompt as any,
          languages: DEFAULT_SETTINGS.languages as any,
          updatedBy: userId,
        },
      });
    } else {
      settings = await prisma.adminSettings.update({
        where: { id: settings.id },
        data: {
          ...DEFAULT_SETTINGS,
          toneSelectors: DEFAULT_SETTINGS.toneSelectors as any,
          subjects: DEFAULT_SETTINGS.subjects as any,
          aiSystemPrompt: DEFAULT_SETTINGS.aiSystemPrompt as any,
          languages: DEFAULT_SETTINGS.languages as any,
          updatedBy: userId,
        },
      });
    }

    return this.formatSettings(settings);
  }

  /**
   * Get admin dashboard stats
   */
  async getStats(): Promise<AdminStats> {
    const [totalUsers, totalSessions, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.user.count({
        where: {
          sessions: {
            some: {
              updatedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
              },
            },
          },
        },
      }),
    ]);

    // Calculate average session duration (mock for now)
    const averageSessionDuration = '24m';

    // Get new users this week
    const newUsersThisWeek = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      totalSessions,
      averageSessionDuration,
      activeUsers,
      totalUsers,
      newUsersThisWeek,
    };
  }

  /**
   * Format settings for response
   */
  private formatSettings(settings: any): AdminSettingsResponse {
    return {
      id: settings.id,
      toneSelectors: settings.toneSelectors,
      subjects: settings.subjects,
      aiSystemPrompt: settings.aiSystemPrompt,
      languages: settings.languages,
      speechEngine: settings.speechEngine || 'whisper',
      voiceEngine: settings.voiceEngine || 'azure',
      dataRetention: settings.dataRetention,
      retentionDuration: settings.retentionDuration,
      safetyMode: settings.safetyMode,
      updatedAt: settings.updatedAt.toISOString(),
      updatedBy: settings.updatedBy,
    };
  }
}

export default new AdminService();
