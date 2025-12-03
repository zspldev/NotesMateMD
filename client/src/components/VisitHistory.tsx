import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, FileText, Play, Pause, User, Bot } from "lucide-react";

interface VisitNote {
  noteId: string;
  audioFilename?: string;
  audioDurationSeconds?: number;
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
      // Create audio from base64 data
      const base64Data = note.audioData;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(blob);
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingNoteId(null);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };

      audio.onerror = () => {
        setPlayingNoteId(null);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };

      await audio.play();
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium" data-testid={`text-note-time-${note.noteId}`}>
                      {formatNoteDateTime(note.createdAt)}
                    </span>
                    {note.audioDurationSeconds && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground" data-testid={`text-audio-duration-${note.noteId}`}>
                          {formatDuration(note.audioDurationSeconds)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {note.aiTranscribed && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-ai-transcribed-${note.noteId}`}>
                        <Bot className="h-3 w-3 mr-1" />
                        AI Generated
                      </Badge>
                    )}
                    {note.isTranscriptionEdited && (
                      <Badge variant="secondary">Edited</Badge>
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
