import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Play, Pause, Save, Loader2, FileText } from "lucide-react";
import MedicalEditor from "./MedicalEditor";
import { api } from "@/lib/api";

interface AudioRecorderProps {
  visitId?: string;
  onSaveNote: (audioBlob: Blob | null, transcription: string) => Promise<{ ai_transcribed?: boolean; transcription_text?: string }>;
  existingTranscription?: string;
  existingAudioFile?: string; // Base64 encoded audio
  existingAudioMimetype?: string;
  existingAudioDuration?: number;
  existingAudioFilename?: string;
  isReadOnly?: boolean;
}

export default function AudioRecorder({
  visitId,
  onSaveNote,
  existingTranscription = "",
  existingAudioFile,
  existingAudioMimetype,
  existingAudioDuration,
  existingAudioFilename,
  isReadOnly = false,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingSaved, setIsPlayingSaved] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [savedAudioBlob, setSavedAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState(existingTranscription);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transcriptionSource, setTranscriptionSource] = useState<'none' | 'auto' | 'manual'>('none');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savedAudioRef = useRef<HTMLAudioElement | null>(null);
  const savedAudioUrlRef = useRef<string | null>(null);
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
    if (!transcription.trim()) {
      console.log('No transcription to save');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Save the transcription text (with audio if available and not yet saved)
      const result = await onSaveNote(audioBlob, transcription);
      
      console.log('Note saved successfully');
      
      // Keep transcription visible after save
      if (result.transcription_text) {
        setTranscription(result.transcription_text);
        setTranscriptionSource(result.ai_transcribed ? 'auto' : 'manual');
      }
      
      // Reset audio controls and transcription after successful save
      setAudioBlob(null);
      setRecordingTime(0);
      setIsPlaying(false);
      setTranscription('');
      setTranscriptionSource('none');
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTranscriptionChange = (value: string) => {
    setTranscription(value);
    setTranscriptionSource(value ? 'manual' : 'none');
  };

  // Transcribe audio without saving
  const handleTranscribe = async () => {
    if (!audioBlob) return;
    
    setIsTranscribing(true);
    try {
      const result = await api.transcribeAudio(audioBlob);
      setTranscription(result.text);
      setTranscriptionSource('auto');
      console.log('Audio transcribed successfully:', result.text.length, 'characters');
    } catch (error) {
      console.error('Transcription failed:', error);
      setTranscription('[Transcription failed. Please try again or type manually.]');
      setTranscriptionSource('manual');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Convert Base64 audio to Blob when existing audio is provided
  useEffect(() => {
    if (existingAudioFile && existingAudioMimetype) {
      try {
        // Decode Base64 to binary
        const binaryString = atob(existingAudioFile);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        // Create blob from binary data
        const blob = new Blob([bytes], { type: existingAudioMimetype });
        setSavedAudioBlob(blob);
        console.log('Saved audio loaded:', existingAudioFilename, blob.size, 'bytes');
      } catch (error) {
        console.error('Error converting Base64 to Blob:', error);
      }
    } else {
      // Clear saved audio blob when props are cleared
      // Stop playback if currently playing
      if (savedAudioRef.current) {
        savedAudioRef.current.pause();
        savedAudioRef.current = null;
      }
      if (savedAudioUrlRef.current) {
        URL.revokeObjectURL(savedAudioUrlRef.current);
        savedAudioUrlRef.current = null;
      }
      setSavedAudioBlob(null);
      setIsPlayingSaved(false);
    }

    // Cleanup: stop audio when component unmounts or props change
    return () => {
      if (savedAudioRef.current) {
        savedAudioRef.current.pause();
        savedAudioRef.current = null;
      }
      if (savedAudioUrlRef.current) {
        URL.revokeObjectURL(savedAudioUrlRef.current);
        savedAudioUrlRef.current = null;
      }
      setIsPlayingSaved(false);
    };
  }, [existingAudioFile, existingAudioMimetype, existingAudioFilename]);

  const playSavedAudio = () => {
    if (savedAudioBlob && !isPlayingSaved) {
      const audioUrl = URL.createObjectURL(savedAudioBlob);
      savedAudioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      savedAudioRef.current = audio;
      
      audio.onended = () => {
        setIsPlayingSaved(false);
        if (savedAudioUrlRef.current) {
          URL.revokeObjectURL(savedAudioUrlRef.current);
          savedAudioUrlRef.current = null;
        }
      };
      
      audio.play();
      setIsPlayingSaved(true);
      console.log('Saved audio playback started');
    }
  };

  const pauseSavedAudio = () => {
    if (savedAudioRef.current && isPlayingSaved) {
      savedAudioRef.current.pause();
      setIsPlayingSaved(false);
      // Revoke URL when paused
      if (savedAudioUrlRef.current) {
        URL.revokeObjectURL(savedAudioUrlRef.current);
        savedAudioUrlRef.current = null;
      }
      console.log('Saved audio playback paused');
    }
  };

  return (
    <Card data-testid="card-audio-recorder">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span>Visit Note</span>
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

        {/* Instructions */}
        <p className="text-sm text-center text-muted-foreground">
          Record audio notes by clicking on the microphone icon. Or click on the pencil icon to directly type the notes.
        </p>

        {/* Saved Audio Playback */}
        {savedAudioBlob && (
          <div className="p-3 rounded-md border bg-card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={isPlayingSaved ? pauseSavedAudio : playSavedAudio}
                  data-testid="button-play-pause-saved"
                >
                  {isPlayingSaved ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {existingAudioFilename || 'Saved Audio'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isPlayingSaved ? 'Playing...' : 'Click play to listen to saved audio'}
                    {existingAudioDuration && ` • ${formatTime(existingAudioDuration)}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Recording Playback */}
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

        {/* Medical Editor Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Clinical Notes</label>
          
          {isTranscribing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Transcribing audio with Deepgram...</span>
            </div>
          )}
          
          <MedicalEditor
            value={transcription}
            onChange={handleTranscriptionChange}
            disabled={isReadOnly}
            isTranscribing={isTranscribing}
            transcriptionSource={transcriptionSource}
            onTranscriptionSourceChange={setTranscriptionSource}
            placeholder="Record audio for automatic transcription, or use the tools above to create structured clinical notes..."
          />
        </div>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="flex flex-col gap-2">
            {/* Transcribe Button - only show when there's audio but no transcription */}
            {audioBlob && !transcription.trim() && (
              <Button 
                onClick={handleTranscribe}
                className="w-full bg-[#17a2b8] hover:bg-[#138496] text-white"
                data-testid="button-transcribe"
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Transcribing with Deepgram...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Transcribe Audio
                  </>
                )}
              </Button>
            )}

            {/* Save Button - only show when there's transcription text */}
            {transcription.trim() && (
              <Button 
                onClick={handleSave}
                className="w-full"
                data-testid="button-save-note"
                disabled={isSaving || isTranscribing}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Note
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}