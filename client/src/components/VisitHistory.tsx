import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, FileText, Play, Pause, User, Bot } from "lucide-react";

interface VisitNote {
  noteId: string;
  audioFilename?: string;
  audioDurationSeconds?: number;
  audioMimeType?: string;
  transcriptionText?: string;
  isTranscriptionEdited: boolean;
  aiTranscribed?: boolean;
  createdAt: string;
  audioData?: string;
}

interface Visit {
  visitId: string;
  visitDate: string;
  visitPurpose?: string;
  employeeName: string;
  employeeTitle: string;
  notes: VisitNote[];
}

interface VisitHistoryProps {
  visits: Visit[];
  onPlayAudio: (noteId: string) => void;
  onViewNote: (noteId: string) => void;
  patientName: string;
}

interface FlatNote extends VisitNote {
  visitId: string;
  visitDate: string;
  visitPurpose?: string;
  employeeName: string;
  employeeTitle: string;
}

export default function VisitHistory({ visits, onPlayAudio, onViewNote, patientName }: VisitHistoryProps) {
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Flatten all notes from all visits and sort by createdAt descending (newest first)
  const allNotes = useMemo(() => {
    const flatNotes: FlatNote[] = [];
    
    visits.forEach(visit => {
      visit.notes.forEach(note => {
        flatNotes.push({
          ...note,
          visitId: visit.visitId,
          visitDate: visit.visitDate,
          visitPurpose: visit.visitPurpose,
          employeeName: visit.employeeName,
          employeeTitle: visit.employeeTitle
        });
      });
    });
    
    // Sort by createdAt descending (newest first)
    flatNotes.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
    
    return flatNotes;
  }, [visits]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Detect actual audio format from file bytes (browser MIME types are often wrong on iOS)
  const detectAudioFormat = (bytes: Uint8Array): string => {
    // Check first bytes for format signatures
    // MP4/M4A: starts with 'ftyp' at byte 4
    if (bytes.length > 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      console.log('Detected MP4/M4A format from file bytes');
      return 'audio/mp4';
    }
    // WebM: starts with 0x1A45DFA3
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      console.log('Detected WebM format from file bytes');
      return 'audio/webm';
    }
    // OGG: starts with 'OggS'
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      console.log('Detected OGG format from file bytes');
      return 'audio/ogg';
    }
    // WAV: starts with 'RIFF'
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      console.log('Detected WAV format from file bytes');
      return 'audio/wav';
    }
    // Fallback to mp4 (safest for iOS)
    console.log('Could not detect format, using fallback: audio/mp4');
    return 'audio/mp4';
  };
  
  const formatNoteDateTime = (createdAt: string) => {
    const date = new Date(createdAt);
    // Format date as DD/MM/YY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    // Format time in local timezone
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${day}/${month}/${year} at ${time}`;
  };

  const handlePlayPause = async (note: FlatNote) => {
    const noteId = note.noteId;

    // If currently playing this note, pause it
    if (playingNoteId === noteId && audioRef.current) {
      audioRef.current.pause();
      setPlayingNoteId(null);
      return;
    }

    // If playing a different note, stop it first
    if (audioRef.current) {
      audioRef.current.pause();
      // Clean up: remove from DOM
      if (audioRef.current.parentNode) {
        audioRef.current.parentNode.removeChild(audioRef.current);
      }
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    // Check if note has audio data
    if (!note.audioData) {
      // Trigger the parent's onPlayAudio to fetch the audio
      onPlayAudio(noteId);
      return;
    }

    try {
      // iOS fix: Convert base64 to blob, then use blob URL with <source> tag
      // Data URLs have size/memory issues on iOS
      // Blob URLs work when using <source> tag (not .src property)
      const base64Data = note.audioData;
      
      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Detect actual MIME type from bytes (stored MIME type may be wrong)
      const storedMimeType = note.audioMimeType || 'audio/mp4';
      const detectedMimeType = detectAudioFormat(bytes);
      console.log('Stored MIME:', storedMimeType, '| Detected MIME:', detectedMimeType);
      
      // Use detected MIME type (more reliable than stored)
      const mimeType = detectedMimeType;
      const blob = new Blob([bytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      audioUrlRef.current = blobUrl;
      
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
        setPlayingNoteId(null);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
        // Clean up: remove from DOM
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
      };

      audio.onerror = (e) => {
        console.error('Audio error:', e);
        setPlayingNoteId(null);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
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
          console.log('Audio playback started');
        } catch (playError) {
          console.error('Play error:', playError);
          setPlayingNoteId(null);
        }
      });

      // Trigger load
      audio.load();
      setPlayingNoteId(noteId);
    } catch (error) {
      console.error('Error playing audio:', error);
      setPlayingNoteId(null);
    }
  };

  return (
    <Card data-testid="card-visit-history">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Visit History - {patientName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-visits">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No previous notes found</p>
            <p className="text-sm">This patient has no visit notes yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allNotes.map((note) => (
              <div 
                key={note.noteId} 
                className="border rounded-lg p-4 space-y-3"
                data-testid={`note-${note.noteId}`}
              >
                {/* Note Header with Date/Time */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium" data-testid={`text-note-time-${note.noteId}`}>
                      {formatNoteDateTime(note.createdAt)}
                    </span>
                    {note.audioDurationSeconds && (
                      <>
                        <span className="text-muted-foreground hidden sm:inline">•</span>
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground" data-testid={`text-audio-duration-${note.noteId}`}>
                          {formatDuration(note.audioDurationSeconds)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {note.aiTranscribed && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-ai-transcribed-${note.noteId}`}>
                        <Bot className="h-3 w-3 mr-1" />
                        AI
                      </Badge>
                    )}
                    {note.isTranscriptionEdited && (
                      <Badge variant="secondary" className="text-xs">Edited</Badge>
                    )}
                  </div>
                </div>

                {/* Provider Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span data-testid={`text-employee-${note.noteId}`}>
                    {note.employeeName} ({note.employeeTitle})
                  </span>
                  {note.visitPurpose && (
                    <>
                      <span>•</span>
                      <span data-testid={`text-visit-purpose-${note.noteId}`}>
                        {note.visitPurpose}
                      </span>
                    </>
                  )}
                </div>

                {/* Audio Controls */}
                {note.audioFilename && (
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handlePlayPause(note)}
                      data-testid={`button-play-audio-${note.noteId}`}
                    >
                      {playingNoteId === note.noteId ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause Audio
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Play Audio
                        </>
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {note.audioFilename}
                    </span>
                  </div>
                )}

                {/* Transcription */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Transcription:</div>
                  <div 
                    className="text-sm p-3 bg-muted/50 rounded border min-h-[60px] whitespace-pre-wrap"
                    data-testid={`text-transcription-${note.noteId}`}
                  >
                    {note.transcriptionText || (
                      <span className="text-muted-foreground italic">
                        No transcription available
                      </span>
                    )}
                  </div>
                </div>

                {/* View Full Note Button */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onViewNote(note.noteId)}
                  data-testid={`button-view-note-${note.noteId}`}
                >
                  View Full Note
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
