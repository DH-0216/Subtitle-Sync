/**
 * Centralized Translation Prompts & Language Configurations
 * Single source of truth for AI translation prompts, colloquial rules, and target language options.
 * Follows the same modular design as @shared/links, @shared/version, and @shared/aiModels.
 */

export interface TranslationLanguageConfig {
  code: string
  name: string
  nativeName: string
  label: string
  description: string
  subtitleNote: string
  badges: string[]
  defaultPrompt: string
}

export const TRANSLATION_LANGUAGES: TranslationLanguageConfig[] = [
  {
    code: 'si',
    name: 'Sinhala',
    nativeName: 'ස්වාභාවික කථාබහ සිංහල',
    label: 'Sinhala (Spoken Sinhala dialogue - AI Optimized)',
    description: 'Fixes mistranslated homonyms, literal idioms, and controls colloquial spoken tone for cinema & movies.',
    subtitleNote: 'Translates into natural spoken Sinhala dialogue while preserving formatting and cue timestamps.',
    badges: [
      'Colloquial Sinhala (කථාබහ බස)',
      'Idiom Adaptation',
      'Homonym Resolution',
      'SDH Sound Cleaner [ ]'
    ],
    defaultPrompt: `You are an expert subtitle translator specializing in natural, authentic spoken colloquial Sinhala (ස්වාභාවික කථාබහ සිංහල) for cinema and movies.
Translate the following movie subtitle lines into natural, spoken Sinhala as people actually speak in day-to-day life.
RULES:
1. Use colloquial spoken Sinhala (කථාබහ කරන බස), NOT formal/bookish written Sinhala (e.g. use "කරනවා", "යනවා", "නෑ/නැහැ", "මොකක්ද", NEVER use "කරන්නේය", "ගියේය", "නැත", "කුමක්ද").
2. Contextual Idioms & Slang: Never translate idioms literally word-for-word (e.g., "give me a hand" -> "මට උදව් කරන්න", "break a leg" -> "වැඩේ හොඳට කරන්න / සුබ පැතුම්", "chill out" -> "කූල් එකේ ඉන්න"). Translate the emotion, intent, and colloquial nuance.
3. Homonym & Context Awareness: Resolve mistranslated homonyms and ambiguous words based on surrounding movie dialogue (e.g., distinguish "fair", "bark", "right", "bear").
4. Character Names & Modern Words: Keep character names, locations, and commonly spoken modern loan words natural.
5. Strict Script Purity (සිංහල අකුරු පමණි): Output ONLY authentic Sinhala script (අ-ෆ). NEVER mix Telugu, Tamil, Hindi/Devanagari, or Arabic characters under any circumstances.
6. Remove Background Sounds & Sound Effects (SDH): CAREFULLY REMOVE non-dialogue audio descriptions, sound effects, and music tags enclosed in brackets [ ] or parentheses ( ) (e.g. "[mysterious music plays]", "[engine roaring]", "[police sirens wail]", "[screaming]", "[applause]", "[groans]", "[laughs]", "(sighs)", "(whispering)").
   - If a line contains spoken dialogue with a sound effect (e.g. "[sighs] Where are we going?"), remove the sound effect completely and translate ONLY the spoken dialogue ("අපි කොහෙද යන්නේ?").
   - If an entire line contains ONLY background sounds or music descriptions with no spoken dialogue, output a dash "-" for that line.
7. 1:1 Complete Line Mapping - NEVER Skip or Merge: Every single numbered line [index] in the input MUST have an exact corresponding [index] in your output. Even short lines like "[120] Hey, you know what?" MUST be translated individually as "[120] ඒයි, දන්නවද වැඩක්?". NEVER combine multiple lines into one and NEVER leave any line untranslated in English.
8. Maintain the exact format "[index] Translated line".
9. Return exactly the same number of numbered lines without dropping any lines.
10. Do not include introductory, markdown formatting or explanatory text.`
  }
]

export const DEFAULT_AI_PROMPT = TRANSLATION_LANGUAGES[0].defaultPrompt

/**
 * Helper to get the default prompt for a specific language code.
 * Falls back to DEFAULT_AI_PROMPT if code is not found.
 */
export function getPromptForLanguage(code: string): string {
  const found = TRANSLATION_LANGUAGES.find((lang) => lang.code === code)
  return found ? found.defaultPrompt : DEFAULT_AI_PROMPT
}

/**
 * Helper to get the configuration for a specific language code.
 */
export function getLanguageConfig(code: string): TranslationLanguageConfig {
  const found = TRANSLATION_LANGUAGES.find((lang) => lang.code === code)
  return found || TRANSLATION_LANGUAGES[0]
}
