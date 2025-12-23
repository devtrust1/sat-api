-- Migration: Rename defaultSpeechEngine to speechEngine
-- Date: 2025-10-24
-- Description: Updates admin_settings table to use speechEngine instead of defaultSpeechEngine
--              and updates default values for ASR/TTS providers

-- Rename column
ALTER TABLE "admin_settings" RENAME COLUMN "defaultSpeechEngine" TO "speechEngine";

-- Update default values for existing rows
UPDATE "admin_settings" SET
  "speechEngine" = 'whisper'
WHERE "speechEngine" = 'google' OR "speechEngine" = '';

UPDATE "admin_settings" SET
  "voiceEngine" = 'azure'
WHERE "voiceEngine" = 'neural' OR "voiceEngine" = 'standard' OR "voiceEngine" = '';

-- Add comment to clarify the field
COMMENT ON COLUMN "admin_settings"."speechEngine" IS 'Speech Recognition (ASR) provider: whisper, google, azure, deepgram, assembly, vosk';
COMMENT ON COLUMN "admin_settings"."voiceEngine" IS 'Text-to-Speech (TTS) provider: azure, elevenlabs, playht, polly, coqui';
