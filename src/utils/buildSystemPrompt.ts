import { AdminSettingsData } from '../modules/admin/admin.types';

/**
 * Build dynamic system prompt based on admin settings
 * Applies tone, subjects, and custom AI instructions
 */
export function buildSystemPrompt(settings: AdminSettingsData): string {
  const parts: string[] = [];

  // Base instruction
  parts.push('You are an SAT tutor assistant.');

  // Apply tone based on admin settings
  const activeTones = Object.entries(settings.toneSelectors)
    .filter(([_, isActive]) => isActive)
    .map(([tone, _]) => tone);

  if (activeTones.length > 0) {
    const toneInstructions: Record<string, string> = {
      friendly: 'Be warm, approachable, and encouraging in your responses.',
      academic: 'Use formal, scholarly language and maintain a professional tone.',
      neutral: 'Maintain a balanced, objective tone without excessive emotion.',
      motivational: 'Be inspiring, energetic, and focus on building student confidence.',
    };

    activeTones.forEach(tone => {
      if (toneInstructions[tone]) {
        parts.push(toneInstructions[tone]);
      }
    });
  }

  // Apply subject filters
  const enabledSubjects = Object.entries(settings.subjects)
    .filter(([_, isEnabled]) => isEnabled)
    .map(([subject, _]) => subject);

  if (enabledSubjects.length > 0 && enabledSubjects.length < 4) {
    // Only mention subjects if not all are enabled
    const subjectList = enabledSubjects.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
    parts.push(`Focus primarily on helping with: ${subjectList}.`);
  }

  // Add custom AI system prompts from admin
  const aiSystemPrompt = settings.aiSystemPrompt as string[];
  if (aiSystemPrompt && aiSystemPrompt.length > 0) {
    aiSystemPrompt.forEach(prompt => {
      if (prompt && prompt.trim()) {
        parts.push(prompt.trim());
      }
    });
  }

  // Combine all parts into final system prompt
  const finalPrompt = parts.join(' ');

  return finalPrompt;
}
