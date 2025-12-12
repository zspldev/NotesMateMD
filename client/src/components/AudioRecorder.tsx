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
  onUnsavedChanges?: (hasUnsaved: boolean) => void;
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
  onUnsavedChanges,
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
  const [lastSavedTranscription, setLastSavedTranscription] = useState(existingTranscription);
  const [hasUnsavedAudio, setHasUnsavedAudio] = useState(false);

  // Track unsaved changes and notify parent
  useEffect(() => {
    const hasUnsavedText = transcription.trim() !== lastSavedTranscription.trim();
    const hasUnsaved = hasUnsavedText || hasUnsavedAudio;
    onUnsavedChanges?.(hasUnsaved);
  }, [transcription, lastSavedTranscription, hasUnsavedAudio, onUnsavedChanges]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savedAudioRef = useRef<HTMLAudioElement | null>(null);
  const savedAudioUrlRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const actualMimeTypeRef = useRef<string>('audio/wav');

  // Detect actual audio format from file bytes (browser MIME types are often wrong on iOS)
  const detectAudioFormat = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const arr = new Uint8Array(reader.result as ArrayBuffer);
        // Check first bytes for format signatures
        // MP4/M4A: starts with 'ftyp' at byte 4
        if (arr.length > 8 && arr[4] === 0x66 && arr[5] === 0x74 && arr[6] === 0x79 && arr[7] === 0x70) {
          console.log('Detected MP4/M4A format from file bytes');
          resolve('audio/mp4');
          return;
        }
        // WebM: starts with 0x1A45DFA3
        if (arr[0] === 0x1A && arr[1] === 0x45 && arr[2] === 0xDF && arr[3] === 0xA3) {
          console.log('Detected WebM format from file bytes');
          resolve('audio/webm');
          return;
        }
        // OGG: starts with 'OggS'
        if (arr[0] === 0x4F && arr[1] === 0x67 && arr[2] === 0x67 && arr[3] === 0x53) {
          console.log('Detected OGG format from file bytes');
          resolve('audio/ogg');
          return;
        }
        // WAV: starts with 'RIFF'
        if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46) {
          console.log('Detected WAV format from file bytes');
          resolve('audio/wav');
          return;
        }
        // Fallback to blob type or mp4 (safest for iOS)
        const fallback = blob.type || 'audio/mp4';
        console.log('Could not detect format, using fallback:', fallback);
        resolve(fallback);
      };
      reader.readAsArrayBuffer(blob.slice(0, 16));
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        // First create blob with reported type
        const reportedType = actualMimeTypeRef.current;
        const tempBlob = new Blob(chunks, { type: reportedType });
        
        // Detect actual format from bytes (iOS often lies about MIME type)
        const detectedType = await detectAudioFormat(tempBlob);
        console.log('Reported MIME:', reportedType, '| Detected MIME:', detectedType);
        
        // Create final blob with correct type
        const finalBlob = new Blob(chunks, { type: detectedType });
        actualMimeTypeRef.current = detectedType;
        setAudioBlob(finalBlob);
        setHasUnsavedAudio(true); // Mark as having unsaved audio
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

  const playAudio = async () => {
    if (audioBlob && !isPlaying) {
      try {
        const mimeType = audioBlob.type || 'audio/mp4';
        
        // iOS fix: Use blob URL with <source> tag
        // Data URLs have size/memory issues on iOS
        // Blob URLs work when using <source> tag (not .src property)
        const blobUrl = URL.createObjectURL(audioBlob);
        console.log('Playing audio with blob URL via <source> tag, MIME type:', mimeType);

        // Create audio element with <source> child (required for iOS)
        // iOS REQUIRES the audio element to be in the DOM, not just in memory
        const audio = document.createElement('audio');
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        audio.style.display = 'none'; // Hide it but keep in DOM
        
        const source = document.createElement('source');
        source.type = mimeType;
        source.src = blobUrl;
        audio.appendChild(source);
        
        // iOS fix: Append to DOM (required for iOS playback)
        document.body.appendChild(audio);
        
        audioRef.current = audio;
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(blobUrl);
          // Clean up: remove from DOM
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
          }
        };
        
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setIsPlaying(false);
          URL.revokeObjectURL(blobUrl);
          // Clean up: remove from DOM
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
          }
        };
        
        // iOS 17.4+ fix: Use loadstart event (canplay/loadedmetadata don't fire reliably)
        audio.addEventListener('loadstart', async () => {
          try {
            await audio.play();
            console.log('Audio playback started');
          } catch (playError) {
            console.error('Play error:', playError);
            setIsPlaying(false);
          }
        });
        
        // Trigger load
        audio.load();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      }
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
      setLastSavedTranscription(''); // Reset to empty after save
      setHasUnsavedAudio(false); // Clear unsaved audio flag
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

  const playSavedAudio = async () => {
    // iOS fix: Convert base64 to blob, then use blob URL with <source> tag
    // Data URLs have size/memory issues on iOS
    // Blob URLs work when using <source> tag (not .src property)
    if (existingAudioFile && !isPlayingSaved) {
      try {
        // Decode base64 to binary
        const binaryString = atob(existingAudioFile);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create temp blob to detect actual format
        const tempBlob = new Blob([bytes]);
        const detectedMimeType = await detectAudioFormat(tempBlob);
        const storedMimeType = existingAudioMimetype || 'audio/mp4';
        console.log('Saved audio - Stored MIME:', storedMimeType, '| Detected MIME:', detectedMimeType);
        
        // Use detected MIME type (more reliable than stored)
        const mimeType = detectedMimeType;
        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        savedAudioUrlRef.current = blobUrl;
        
        console.log('Playing saved audio with blob URL via <source> tag, MIME type:', mimeType);

        // Create audio element with <source> child (required for iOS)
        // iOS REQUIRES the audio element to be in the DOM, not just in memory
        const audio = document.createElement('audio');
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        audio.style.display = 'none'; // Hide it but keep in DOM
        
        const source = document.createElement('source');
        source.type = mimeType;
        source.src = blobUrl;
        audio.appendChild(source);
        
        // iOS fix: Append to DOM (required for iOS playback)
        document.body.appendChild(audio);
        
        savedAudioRef.current = audio;
        
        audio.onended = () => {
          setIsPlayingSaved(false);
          if (savedAudioUrlRef.current) {
            URL.revokeObjectURL(savedAudioUrlRef.current);
            savedAudioUrlRef.current = null;
          }
          // Clean up: remove from DOM
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
          }
        };
        
        audio.onerror = (e) => {
          console.error('Saved audio playback error:', e);
          setIsPlayingSaved(false);
          if (savedAudioUrlRef.current) {
            URL.revokeObjectURL(savedAudioUrlRef.current);
            savedAudioUrlRef.current = null;
          }
          // Clean up: remove from DOM
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
          }
        };
        
        // iOS 17.4+ fix: Use loadstart event (canplay/loadedmetadata don't fire reliably)
        audio.addEventListener('loadstart', async () => {
          try {
            await audio.play();
            console.log('Saved audio playback started');
          } catch (playError) {
            console.error('Saved audio play error:', playError);
            setIsPlayingSaved(false);
          }
        });
        
        // Trigger load
        audio.load();
        setIsPlayingSaved(true);
      } catch (error) {
        console.error('Error playing saved audio:', error);
        setIsPlayingSaved(false);
      }
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