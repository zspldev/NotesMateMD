import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Wand2, 
  FileText, 
  Plus, 
  Loader2, 
  ChevronDown,
  Bot,
  User,
  Sparkles,
  Type
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NoteTemplate {
  id: string;
  name: string;
  sections: string[];
  description: string;
}

interface QuickPhrase {
  label: string;
  text: string;
}

interface MedicalEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isTranscribing?: boolean;
  transcriptionSource?: 'none' | 'auto' | 'manual';
  onTranscriptionSourceChange?: (source: 'none' | 'auto' | 'manual') => void;
  placeholder?: string;
}

const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'soap',
    name: 'SOAP Note',
    sections: ['SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN'],
    description: 'Standard clinical documentation format'
  },
  {
    id: 'hp',
    name: 'History & Physical',
    sections: ['CHIEF COMPLAINT', 'HISTORY OF PRESENT ILLNESS', 'PAST MEDICAL HISTORY', 'MEDICATIONS', 'ALLERGIES', 'REVIEW OF SYSTEMS', 'PHYSICAL EXAMINATION', 'ASSESSMENT', 'PLAN'],
    description: 'Comprehensive patient evaluation'
  },
  {
    id: 'progress',
    name: 'Progress Note',
    sections: ['INTERVAL HISTORY', 'CURRENT MEDICATIONS', 'PHYSICAL EXAM', 'LAB RESULTS', 'ASSESSMENT', 'PLAN'],
    description: 'Follow-up visit documentation'
  },
  {
    id: 'procedure',
    name: 'Procedure Note',
    sections: ['PROCEDURE', 'INDICATION', 'CONSENT', 'ANESTHESIA', 'TECHNIQUE', 'FINDINGS', 'COMPLICATIONS', 'DISPOSITION'],
    description: 'Procedural documentation'
  }
];

const QUICK_PHRASES: QuickPhrase[] = [
  { label: 'Patient denies...', text: 'Patient denies ' },
  { label: 'No acute distress', text: 'Patient appears comfortable, in no acute distress. ' },
  { label: 'Within normal limits', text: 'within normal limits' },
  { label: 'Vitals stable', text: 'Vital signs are stable. ' },
  { label: 'Follow up in _ weeks', text: 'Follow up in ___ weeks. ' },
  { label: 'Return precautions', text: 'Return precautions discussed with patient. Patient verbalized understanding. ' },
  { label: 'Continue current meds', text: 'Continue current medications as prescribed. ' },
  { label: 'Labs ordered', text: 'Laboratory tests ordered as indicated. ' },
  { label: 'Imaging ordered', text: 'Imaging studies ordered as indicated. ' },
  { label: 'Referral placed', text: 'Referral placed to ___ for further evaluation. ' },
  { label: 'Patient educated', text: 'Patient educated regarding diagnosis, treatment options, and expected outcomes. ' },
  { label: 'Risk/benefit discussed', text: 'Risks and benefits of treatment discussed with patient. Patient agrees with plan. ' }
];

const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  'htn': 'hypertension',
  'dm': 'diabetes mellitus',
  'dm2': 'Type 2 Diabetes Mellitus',
  'dm1': 'Type 1 Diabetes Mellitus',
  'cad': 'coronary artery disease',
  'chf': 'congestive heart failure',
  'copd': 'chronic obstructive pulmonary disease',
  'ckd': 'chronic kidney disease',
  'afib': 'atrial fibrillation',
  'sob': 'shortness of breath',
  'cp': 'chest pain',
  'ha': 'headache',
  'abd': 'abdominal',
  'n/v': 'nausea and vomiting',
  'uri': 'upper respiratory infection',
  'uti': 'urinary tract infection',
  'prn': 'as needed',
  'bid': 'twice daily',
  'tid': 'three times daily',
  'qid': 'four times daily',
  'qd': 'once daily',
  'po': 'by mouth',
  'iv': 'intravenous',
  'hx': 'history',
  'pmh': 'past medical history',
  'ros': 'review of systems',
  'pe': 'physical examination',
  'vs': 'vital signs',
  'bp': 'blood pressure',
  'hr': 'heart rate',
  'wnl': 'within normal limits',
  'nad': 'no acute distress',
  'aox3': 'alert and oriented x3',
  'heent': 'head, eyes, ears, nose, throat',
  'rrr': 'regular rate and rhythm',
  'ctab': 'clear to auscultation bilaterally',
  'ntnd': 'non-tender, non-distended',
  'f/u': 'follow up',
  'rto': 'return to office',
  'nka': 'no known allergies',
  'nkda': 'no known drug allergies'
};

export default function MedicalEditor({
  value,
  onChange,
  disabled = false,
  isTranscribing = false,
  transcriptionSource = 'none',
  onTranscriptionSourceChange,
  placeholder = "Enter clinical notes or use the tools above..."
}: MedicalEditorProps) {
  const [isFormatting, setIsFormatting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('soap');
  const [showAbbreviationHint, setShowAbbreviationHint] = useState<{ word: string; expansion: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Handle abbreviation expansion
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && showAbbreviationHint) {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBefore = value.substring(0, cursorPos);
      const textAfter = value.substring(cursorPos);
      
      // Find the word being typed
      const words = textBefore.split(/\s/);
      const lastWord = words[words.length - 1].toLowerCase();
      
      if (MEDICAL_ABBREVIATIONS[lastWord]) {
        const newTextBefore = textBefore.slice(0, -lastWord.length) + MEDICAL_ABBREVIATIONS[lastWord];
        const newValue = newTextBefore + textAfter;
        onChange(newValue);
        onTranscriptionSourceChange?.('manual');
        setShowAbbreviationHint(null);
        
        // Set cursor position after the expanded text
        setTimeout(() => {
          if (textarea) {
            textarea.selectionStart = newTextBefore.length;
            textarea.selectionEnd = newTextBefore.length;
          }
        }, 0);
      }
    }
  }, [value, onChange, showAbbreviationHint, onTranscriptionSourceChange]);

  // Check for abbreviations as user types
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    onTranscriptionSourceChange?.('manual');

    // Check if the last word is an abbreviation
    const cursorPos = e.target.selectionStart;
    const textBefore = newValue.substring(0, cursorPos);
    const words = textBefore.split(/\s/);
    const lastWord = words[words.length - 1].toLowerCase();

    if (MEDICAL_ABBREVIATIONS[lastWord] && lastWord.length >= 2) {
      setShowAbbreviationHint({ word: lastWord, expansion: MEDICAL_ABBREVIATIONS[lastWord] });
    } else {
      setShowAbbreviationHint(null);
    }
  }, [onChange, onTranscriptionSourceChange]);

  // Insert quick phrase at cursor position
  const insertQuickPhrase = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const newValue = value.substring(0, cursorPos) + text + value.substring(cursorPos);
    onChange(newValue);
    onTranscriptionSourceChange?.('manual');

    // Set cursor position after the inserted text
    setTimeout(() => {
      if (textarea) {
        const newCursorPos = cursorPos + text.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        textarea.focus();
      }
    }, 0);
  }, [value, onChange, onTranscriptionSourceChange]);

  // Apply empty template structure
  const applyEmptyTemplate = useCallback((templateId: string) => {
    const template = NOTE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    // Use plain text section headers (not Markdown) for better textarea display
    const emptyTemplate = template.sections.map(section => `${section}:\n\n`).join('\n');
    onChange(emptyTemplate);
    onTranscriptionSourceChange?.('manual');
    
    toast({
      title: "Template Applied",
      description: `${template.name} structure has been added to your note.`,
    });
  }, [onChange, onTranscriptionSourceChange, toast]);

  // AI-powered auto-format
  const handleAutoFormat = useCallback(async () => {
    if (!value.trim()) {
      toast({
        title: "No content to format",
        description: "Please enter or transcribe some text first.",
        variant: "destructive",
      });
      return;
    }

    setIsFormatting(true);
    try {
      const response = await fetch('/api/medical/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: value,
          template: selectedTemplate
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to format note');
      }

      const { formattedNote } = await response.json();
      onChange(formattedNote);
      onTranscriptionSourceChange?.('auto');

      toast({
        title: "Note Formatted",
        description: `Your note has been organized into ${NOTE_TEMPLATES.find(t => t.id === selectedTemplate)?.name} format.`,
      });
    } catch (error) {
      console.error('Format error:', error);
      toast({
        title: "Formatting Failed",
        description: error instanceof Error ? error.message : "Could not format the note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFormatting(false);
    }
  }, [value, selectedTemplate, onChange, onTranscriptionSourceChange, toast]);

  // Word count
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/30 rounded-lg border">
        {/* Template Selection */}
        <div className="flex items-center gap-2">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-[160px] h-8" data-testid="select-template">
              <FileText className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              {NOTE_TEMPLATES.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyEmptyTemplate(selectedTemplate)}
                disabled={disabled || isTranscribing || isFormatting}
                data-testid="button-apply-template"
              >
                <Plus className="h-3 w-3 mr-1" />
                Insert
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert empty template structure</TooltipContent>
          </Tooltip>
        </div>

        {/* Auto-Format Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              onClick={handleAutoFormat}
              disabled={disabled || isTranscribing || isFormatting || !value.trim()}
              data-testid="button-auto-format"
            >
              {isFormatting ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3 mr-1" />
              )}
              {isFormatting ? "Formatting..." : "Auto-Format with AI"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Use AI to organize your text into the selected template format
          </TooltipContent>
        </Tooltip>

        {/* Quick Insert Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              disabled={disabled || isTranscribing || isFormatting}
              data-testid="button-quick-insert"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Quick Insert
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {QUICK_PHRASES.map((phrase, idx) => (
                <Button
                  key={idx}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-auto py-2"
                  onClick={() => insertQuickPhrase(phrase.text)}
                  data-testid={`button-quick-phrase-${idx}`}
                >
                  {phrase.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Abbreviation Help */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              data-testid="button-abbreviations-help"
            >
              <Type className="h-3 w-3 mr-1" />
              Abbreviations
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-2">
              <p className="text-sm font-medium">Type abbreviation + Tab to expand</p>
              <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto text-xs">
                {Object.entries(MEDICAL_ABBREVIATIONS).slice(0, 20).map(([abbr, full]) => (
                  <div key={abbr} className="flex gap-1">
                    <Badge variant="secondary" className="font-mono">{abbr}</Badge>
                    <span className="text-muted-foreground truncate">{full}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">...and {Object.keys(MEDICAL_ABBREVIATIONS).length - 20} more</p>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Source Badge & Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {transcriptionSource === 'auto' && (
            <Badge variant="secondary" className="text-xs">
              <Bot className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          )}
          {transcriptionSource === 'manual' && (
            <Badge variant="outline" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              Manual
            </Badge>
          )}
          {showAbbreviationHint && (
            <Badge variant="default" className="text-xs animate-pulse">
              Press Tab: "{showAbbreviationHint.word}" → {showAbbreviationHint.expansion}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{wordCount} words</span>
      </div>

      {/* Editor Area */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isTranscribing ? "Transcription in progress..." : placeholder}
          className="min-h-[200px] font-mono text-sm resize-y"
          disabled={disabled || isTranscribing || isFormatting}
          data-testid="textarea-medical-editor"
        />
        {(isTranscribing || isFormatting) && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{isTranscribing ? "Transcribing audio..." : "Formatting note..."}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
