// Types matching frontend
export interface ToneSelectors {
  friendly: boolean;
  academic: boolean;
  neutral: boolean;
  motivational: boolean;
}

export interface SubjectSettings {
  math: boolean;
  science: boolean;
  history: boolean;
  languages: boolean;
}

export interface LanguageSettings {
  english: boolean;
  spanish: boolean;
  chinese: boolean;
  hindi: boolean;
}

export interface AdminSettingsData {
  toneSelectors: ToneSelectors;
  subjects: SubjectSettings;
  aiSystemPrompt: string[];
  languages: LanguageSettings;
  speechEngine: string; // ASR provider: whisper, google, azure, deepgram, assembly, vosk
  voiceEngine: string; // TTS provider: azure, elevenlabs, playht, polly, coqui
  dataRetention: boolean;
  retentionDuration: string;
  safetyMode: boolean;
}

export interface AdminSettingsResponse extends AdminSettingsData {
  id: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AdminStats {
  totalSessions: number;
  averageSessionDuration: string;
  activeUsers: number;
  totalUsers: number;
  newUsersThisWeek: number;
}
