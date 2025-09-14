import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Play, Pause, Save, Edit3, Loader2, Bot, User } from "lucide-react";

interface AudioRecorderProps {
  visitId?: string;
  onSaveNote: (audioBlob: Blob, transcription: string) => Promise<{ ai_transcribed?: boolean }>;
  existingTranscription?: string;
  isReadOnly?: boolean;
}

export default function AudioRecorder({
  visitId,
  onSaveNote,
  existingTranscription = "",
  isReadOnly = false,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState(existingTranscription);
  const [isEditingTranscription, setIsEditingTranscription] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transcriptionSource, setTranscriptionSource] = useState<'none' | 'auto' | 'manual'>('none');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const actualMimeTypeRef = useRef<string>('audio/wav');

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        // Use the actual MIME type supported by MediaRecorder
        const mimeType = actualMimeTypeRef.current;
        const blob = new Blob(chunks, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Store the actual MIME type used by MediaRecorder
      actualMimeTypeRef.current = mediaRecorder.mimeType || 'audio/wav';
      console.log('MediaRecorder using MIME type:', actualMimeTypeRef.current);
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      console.log('Recording started');
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      console.log('Recording stopped');
    }
  };

  const playAudio = () => {
    if (audioBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play();
      setIsPlaying(true);
      console.log('Audio playback started');
    }
  };

  const pauseAudio = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      console.log('Audio playback paused');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (audioBlob || transcription.trim()) {
      setIsSaving(true);
      // Only show transcribing status if there's audio but no existing transcription
      const needsTranscription = audioBlob && !transcription.trim();
      if (needsTranscription) {
        setIsTranscribing(true);
      }
      
      try {
        // Create a dummy audio blob if only manual transcription exists
        const saveAudioBlob = audioBlob || new Blob([''], { type: 'audio/wav' });
        const result = await onSaveNote(saveAudioBlob, transcription);
        
        // Update transcription source based on whether AI was used
        if (result.ai_transcribed) {
          setTranscriptionSource('auto');
        } else if (transcription.trim() && !audioBlob) {
          setTranscriptionSource('manual');
        }
        
        console.log('Note saved with transcription');
      } catch (error) {
        console.error('Failed to save note:', error);
      } finally {
        setIsSaving(false);
        setIsTranscribing(false);
      }
    }
  };

  const handleTranscriptionChange = (value: string) => {
    setTranscription(value);
    setTranscriptionSource(value ? 'manual' : 'none');
  };

  return (
    <Card data-testid="card-audio-recorder">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span>Audio Note</span>
          {visitId && (
            <Badge variant="outline" data-testid="badge-visit-id">
              Visit: {visitId.slice(-8)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Controls */}
        <div className="flex items-center justify-center gap-4">
          {!isRecording ? (
            <Button 
              size="lg" 
              className="h-16 w-16 rounded-full" 
              onClick={startRecording}
              disabled={isReadOnly}
              data-testid="button-start-recording"
            >
              <Mic className="h-6 w-6" />
            </Button>
          ) : (
            <Button 
              size="lg" 
              variant="destructive"
              className="h-16 w-16 rounded-full" 
              onClick={stopRecording}
              data-testid="button-stop-recording"
            >
              <Square className="h-6 w-6" />
            </Button>
          )}
          
          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-destructive rounded-full animate-pulse"></div>
              <span className="text-lg font-mono" data-testid="text-recording-time">
                {formatTime(recordingTime)}
              </span>
            </div>
          )}
        </div>

        {/* Audio Playback */}
        {audioBlob && (
          <div className="flex items-center justify-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={isPlaying ? pauseAudio : playAudio}
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <span className="text-sm text-muted-foreground">
              {isPlaying ? 'Playing...' : 'Ready to play'}
            </span>
          </div>
        )}

        {/* Transcription Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Transcription</label>
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
            </div>
            {!isReadOnly && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsEditingTranscription(!isEditingTranscription)}
                data-testid="button-edit-transcription"
                disabled={isTranscribing}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {isTranscribing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Transcribing audio with Deepgram...</span>
            </div>
          )}
          
          {isEditingTranscription ? (
            <Textarea
              value={transcription}
              onChange={(e) => handleTranscriptionChange(e.target.value)}
              placeholder="Edit transcription or add manual notes..."
              className="min-h-[120px]"
              data-testid="textarea-transcription"
              disabled={isTranscribing}
            />
          ) : (
            <div 
              className="min-h-[120px] p-3 rounded-md border bg-muted/50 text-sm"
              data-testid="text-transcription-display"
            >
              {transcription || (
                <span className="text-muted-foreground">
                  {isTranscribing ? 
                    "Transcription in progress..." : 
                    "No transcription available. Record audio or edit manually."
                  }
                </span>
              )}
            </div>
          )}
        </div>

        {/* Save Button */}
        {!isReadOnly && (audioBlob || transcription.trim()) && (
          <Button 
            onClick={handleSave}
            className="w-full"
            data-testid="button-save-note"
            disabled={isSaving || isTranscribing}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isTranscribing ? "Transcribing & Saving..." : "Saving..."}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Note
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}