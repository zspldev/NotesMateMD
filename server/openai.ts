import OpenAI from "openai";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export type NoteTemplate = 'soap' | 'hp' | 'progress' | 'procedure';

interface TemplateDefinition {
  name: string;
  sections: string[];
  description: string;
}

export const NOTE_TEMPLATES: Record<NoteTemplate, TemplateDefinition> = {
  soap: {
    name: 'SOAP Note',
    sections: ['SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN'],
    description: 'Standard clinical documentation format'
  },
  hp: {
    name: 'History & Physical',
    sections: ['CHIEF COMPLAINT', 'HISTORY OF PRESENT ILLNESS', 'PAST MEDICAL HISTORY', 'MEDICATIONS', 'ALLERGIES', 'REVIEW OF SYSTEMS', 'PHYSICAL EXAMINATION', 'ASSESSMENT', 'PLAN'],
    description: 'Comprehensive patient evaluation'
  },
  progress: {
    name: 'Progress Note',
    sections: ['INTERVAL HISTORY', 'CURRENT MEDICATIONS', 'PHYSICAL EXAM', 'LAB RESULTS', 'ASSESSMENT', 'PLAN'],
    description: 'Follow-up visit documentation'
  },
  procedure: {
    name: 'Procedure Note',
    sections: ['PROCEDURE', 'INDICATION', 'CONSENT', 'ANESTHESIA', 'TECHNIQUE', 'FINDINGS', 'COMPLICATIONS', 'DISPOSITION'],
    description: 'Procedural documentation'
  }
};

// Medical abbreviation expansions
export const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  'htn': 'hypertension',
  'dm': 'diabetes mellitus',
  'dm2': 'Type 2 Diabetes Mellitus',
  'dm1': 'Type 1 Diabetes Mellitus',
  'cad': 'coronary artery disease',
  'chf': 'congestive heart failure',
  'copd': 'chronic obstructive pulmonary disease',
  'ckd': 'chronic kidney disease',
  'esrd': 'end-stage renal disease',
  'afib': 'atrial fibrillation',
  'sob': 'shortness of breath',
  'cp': 'chest pain',
  'ha': 'headache',
  'abd': 'abdominal',
  'n/v': 'nausea and vomiting',
  'bm': 'bowel movement',
  'uri': 'upper respiratory infection',
  'uti': 'urinary tract infection',
  'prn': 'as needed',
  'bid': 'twice daily',
  'tid': 'three times daily',
  'qid': 'four times daily',
  'qd': 'once daily',
  'po': 'by mouth',
  'iv': 'intravenous',
  'im': 'intramuscular',
  'subq': 'subcutaneous',
  'hx': 'history',
  'pmh': 'past medical history',
  'fh': 'family history',
  'sh': 'social history',
  'ros': 'review of systems',
  'pe': 'physical examination',
  'vs': 'vital signs',
  'bp': 'blood pressure',
  'hr': 'heart rate',
  'rr': 'respiratory rate',
  'temp': 'temperature',
  'o2sat': 'oxygen saturation',
  'wt': 'weight',
  'ht': 'height',
  'bmi': 'body mass index',
  'wnl': 'within normal limits',
  'nad': 'no acute distress',
  'a&o': 'alert and oriented',
  'aox3': 'alert and oriented x3',
  'aox4': 'alert and oriented x4',
  'heent': 'head, eyes, ears, nose, throat',
  'cvs': 'cardiovascular system',
  'rrr': 'regular rate and rhythm',
  'ctab': 'clear to auscultation bilaterally',
  'ntnd': 'non-tender, non-distended',
  'bss': 'bowel sounds present',
  'ext': 'extremities',
  'cns': 'central nervous system',
  'neuro': 'neurological',
  'psych': 'psychiatric',
  'f/u': 'follow up',
  'rto': 'return to office',
  'rtc': 'return to clinic',
  'dc': 'discharge',
  'd/c': 'discontinue',
  'rx': 'prescription',
  'tx': 'treatment',
  'dx': 'diagnosis',
  'ddx': 'differential diagnosis',
  'sx': 'symptoms',
  'hpi': 'history of present illness',
  'cc': 'chief complaint',
  'nka': 'no known allergies',
  'nkda': 'no known drug allergies'
};

// Quick insert phrases for medical notes
export const QUICK_INSERT_PHRASES = [
  { label: 'Patient denies...', text: 'Patient denies ' },
  { label: 'No acute distress', text: 'Patient appears comfortable, in no acute distress. ' },
  { label: 'Within normal limits', text: 'within normal limits' },
  { label: 'Vitals stable', text: 'Vital signs are stable. ' },
  { label: 'Follow up in _ weeks', text: 'Follow up in ___ weeks. ' },
  { label: 'Return precautions discussed', text: 'Return precautions discussed with patient. Patient verbalized understanding. ' },
  { label: 'Continue current meds', text: 'Continue current medications as prescribed. ' },
  { label: 'Labs ordered', text: 'Laboratory tests ordered as indicated. ' },
  { label: 'Imaging ordered', text: 'Imaging studies ordered as indicated. ' },
  { label: 'Referral placed', text: 'Referral placed to ___ for further evaluation. ' },
  { label: 'Patient educated', text: 'Patient educated regarding diagnosis, treatment options, and expected outcomes. ' },
  { label: 'Risk/benefit discussed', text: 'Risks and benefits of treatment discussed with patient. Patient agrees with plan. ' }
];

/**
 * Format raw transcription text into a structured medical note template
 * Using GPT-4o Mini for cost-effective text formatting
 */
export async function formatTranscriptionToTemplate(
  rawTranscription: string,
  template: NoteTemplate
): Promise<string> {
  const templateDef = NOTE_TEMPLATES[template];
  
  const systemPrompt = `You are a medical documentation assistant. Your task is to reorganize raw clinical transcription text into a structured ${templateDef.name} format.

IMPORTANT RULES:
1. Use ONLY the information provided in the transcription - do not add any medical information that was not mentioned
2. If information for a section is not available in the transcription, write "[No information provided]"
3. Maintain medical accuracy and use appropriate clinical terminology
4. Keep the original meaning and context of the transcription
5. Format each section header in ALL CAPS followed by a colon and a newline, then the content
6. Do not use Markdown formatting (no ** or ## symbols) - use plain text only
7. Do not include any explanatory text or commentary - only the formatted note

The sections for a ${templateDef.name} are:
${templateDef.sections.map(s => `- ${s}`).join('\n')}

Format example:
SECTION NAME:
Content goes here...

NEXT SECTION:
More content...`;

  const userPrompt = `Please reorganize the following clinical transcription into a ${templateDef.name} format:\n\n${rawTranscription}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-effective model for text formatting tasks
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_completion_tokens: 4096,
    });

    return response.choices[0]?.message?.content || rawTranscription;
  } catch (error) {
    console.error('Error formatting transcription:', error);
    throw new Error('Failed to format transcription with AI');
  }
}

/**
 * Get empty template structure for a given template type
 */
export function getEmptyTemplate(template: NoteTemplate): string {
  const templateDef = NOTE_TEMPLATES[template];
  // Use plain text section headers for better textarea display
  return templateDef.sections.map(section => `${section}:\n\n`).join('\n');
}
