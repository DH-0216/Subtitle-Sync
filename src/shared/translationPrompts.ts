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

export interface SpeechLanguageConfig {
  code: string
  name: string
  label: string
  isOriginal?: boolean
  description: string
}

export const WHISPER_SPEECH_LANGUAGES: SpeechLanguageConfig[] = [
  {
    code: 'original',
    name: 'Original Spoken Language',
    label: 'Original Spoken Language (Auto-detect)',
    isOriginal: true,
    description: 'Auto-detect spoken dialogue directly from movie audio stream'
  },
  {
    code: 'en',
    name: 'English',
    label: 'English (Direct Whisper Transcription)',
    description: 'Direct Speech-to-Text transcription via Whisper'
  },
  {
    code: 'si',
    name: 'Sinhala',
    label: 'Sinhala (Whisper + Spoken Sinhala AI)',
    description: 'Transcribes movie audio and translates to natural spoken Sinhala'
  },
  {
    code: 'ta',
    name: 'Tamil',
    label: 'Tamil (Whisper + Spoken Tamil AI)',
    description: 'Transcribes movie audio and translates to natural spoken Tamil'
  },
  {
    code: 'hi',
    name: 'Hindi',
    label: 'Hindi (Whisper + Spoken Hindi AI)',
    description: 'Transcribes movie audio and translates to natural spoken Hindi'
  },
  {
    code: 'es',
    name: 'Spanish',
    label: 'Spanish (Whisper + Natural Spanish AI)',
    description: 'Transcribes movie audio and translates to natural conversational Spanish'
  }
]

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
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English (Conversational)',
    label: 'English (Cinema & Conversational Dialogue)',
    description: 'Translates subtitles into natural spoken English with proper cinema pacing, tone, and slang.',
    subtitleNote: 'Polished conversational English subtitles with sound-effect filtering and clean timing.',
    badges: [
      'Natural Cinema Dialogue',
      'Slang & Idiom Polishing',
      'SDH Sound Cleaner [ ]',
      'Punctuation & Flow'
    ],
    defaultPrompt: `You are an expert subtitle translator specializing in natural, authentic English for movies and cinema.
Translate the following subtitle lines into natural, idiomatic conversational English as spoken in contemporary cinema.
RULES:
1. Use natural, conversational English fitting dialogue pacing and rhythm. Avoid stiff, overly formal phrasing.
2. Translate colloquial idioms, cultural expressions, and slang with appropriate natural English equivalents.
3. Remove non-dialogue sound descriptions and SDH tags in brackets [ ] or parentheses ( ) unless they convey critical plot dialogue.
4. If an entire line contains only sound effects or music tags, output a dash "-" for that line.
5. 1:1 Complete Line Mapping: Every single numbered line [index] in the input MUST have an exact corresponding [index] in output. Never merge or skip lines.
6. Maintain the exact format "[index] Translated line".
7. Return exactly the same number of numbered lines.
8. Do not include introductory text, explanations, or markdown code blocks.`
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'பேச்சுத் தமிழ்',
    label: 'Tamil (Spoken Tamil dialogue - AI Optimized)',
    description: 'Natural spoken Tamil (பேச்சு வழக்கு) tailored for cinema, movie dialogues, and idiomatic context.',
    subtitleNote: 'Authentic spoken Tamil cinema dialogue preserving character emotions and timings.',
    badges: [
      'Spoken Tamil (பேச்சு வழக்கு)',
      'Cinema Dialogue Pacing',
      'Idiom Adaptation',
      'SDH Sound Cleaner [ ]'
    ],
    defaultPrompt: `You are an expert subtitle translator specializing in authentic, natural spoken colloquial Tamil (பேச்சுத் தமிழ்) for cinema and movies.
Translate the following subtitle lines into natural spoken Tamil as used in everyday conversational speech.
RULES:
1. Use natural spoken colloquial Tamil (பேச்சு வழக்கு), NOT bookish, archaic written Tamil.
2. Contextual Idioms: Translate colloquial nuance, humor, and emotions naturally.
3. Remove non-dialogue audio tags and sound effects in brackets [ ] or parentheses ( ).
4. 1:1 Complete Line Mapping: Maintain exact line indexing [index] without merging or skipping lines.
5. Maintain the exact format "[index] Translated line".
6. Return exactly the same number of lines without introductory or markdown text.`
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'बोलचाल की हिंदी',
    label: 'Hindi (Spoken Conversational Hindi)',
    description: 'Authentic conversational Hindi (बोलचाल की हिंदी) for cinema dialogue, avoiding bookish translation.',
    subtitleNote: 'Natural Hindi film-style dialogue preserving emotional nuance and timing.',
    badges: [
      'Conversational Hindi (बोलचाल)',
      'Bollywood Cinema Tone',
      'Idiom Translation',
      'SDH Sound Cleaner [ ]'
    ],
    defaultPrompt: `You are an expert subtitle translator specializing in natural, authentic conversational Hindi (बोलचाल की हिंदी) for movies and cinema.
Translate the following subtitle lines into natural, spoken Hindi as people talk in real life and contemporary films.
RULES:
1. Use colloquial spoken Hindi (आम बोलचाल की हिंदी), NOT pure Sanskritized bookish Hindi.
2. Translate colloquial idioms, humor, and emotions naturally into contemporary Hindi expressions.
3. Remove non-dialogue audio tags and sound effects in brackets [ ] or parentheses ( ).
4. 1:1 Complete Line Mapping: Maintain exact line indexing [index] without merging or skipping lines.
5. Maintain the exact format "[index] Translated line".
6. Return exactly the same number of lines without introductory or markdown text.`
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español Conversacional',
    label: 'Spanish (Natural Cinema Dialogue)',
    description: 'Natural conversational Spanish for cinema and series, adapting idioms and colloquial nuances.',
    subtitleNote: 'Natural conversational Spanish dialogue with clean line timing.',
    badges: [
      'Colloquial Spanish',
      'Idiom Adaptation',
      'SDH Sound Cleaner [ ]',
      'Cinema Pacing'
    ],
    defaultPrompt: `You are an expert subtitle translator specializing in natural, authentic conversational Spanish for cinema and television.
Translate the following subtitle lines into natural, spoken Spanish as used in contemporary films.
RULES:
1. Use natural, conversational spoken Spanish. Avoid literal and robotic translations.
2. Adapt idioms, humor, and cultural context naturally.
3. Remove non-dialogue audio tags and sound effects in brackets [ ] or parentheses ( ).
4. 1:1 Complete Line Mapping: Maintain exact line indexing [index] without merging or skipping lines.
5. Maintain the exact format "[index] Translated line".
6. Return exactly the same number of lines without introductory or markdown text.`
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

/**
 * Centrally resolves the effective translation prompt for any target language,
 * properly honoring language-specific overrides while preserving user customization.
 */
export function resolveEffectiveAiPrompt(
  targetLang: string,
  aiPrompt?: string,
  aiPromptsByLang?: Record<string, string>
): string {
  if (aiPromptsByLang && aiPromptsByLang[targetLang] && aiPromptsByLang[targetLang].trim().length > 0) {
    return aiPromptsByLang[targetLang].trim()
  }
  if (targetLang === 'si' && aiPrompt && aiPrompt.trim().length > 0) {
    return aiPrompt.trim()
  }
  return getPromptForLanguage(targetLang)
}
