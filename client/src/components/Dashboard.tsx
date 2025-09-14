import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Sun, 
  Moon, 
  User, 
  Calendar, 
  FileText, 
  Stethoscope, 
  LogOut,
  ArrowLeft 
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import PatientSelector from "./PatientSelector";
import VisitHistory from "./VisitHistory";
import AudioRecorder from "./AudioRecorder";

interface DashboardProps {
  currentUser: {
    firstName: string;
    lastName: string;
    title: string;
    orgName: string;
  };
  onLogout: () => void;
}

export default function Dashboard({ currentUser, onLogout }: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'select' | 'history' | 'newVisit'>('select');
  const [currentVisit, setCurrentVisit] = useState<any>(null);

  // Mock data - todo: remove mock functionality  
  const mockPatients = [
    {
      patientId: "MRN001234",
      firstName: "Sarah",
      lastName: "Johnson",
      dateOfBirth: "1985-03-15",
      gender: "Female",
      contactInfo: "Phone: (555) 123-4567, Email: sarah.j@email.com",
      lastVisit: "2024-09-10"
    },
    {
      patientId: "MRN005678",
      firstName: "Michael",
      lastName: "Chen",
      dateOfBirth: "1979-11-22",
      gender: "Male",
      contactInfo: "Phone: (555) 987-6543",
      lastVisit: "2024-09-08"
    },
    {
      patientId: "MRN009876",
      firstName: "Emma",
      lastName: "Davis",
      dateOfBirth: "1992-07-03",
      gender: "Female",
      contactInfo: "Phone: (555) 456-7890, Email: e.davis@email.com",
      lastVisit: "2024-09-05"
    }
  ];

  const mockVisits = [
    {
      visitId: "VID123",
      visitDate: "2024-09-10",
      visitPurpose: "Annual physical exam and blood pressure check",
      employeeName: "Dr. Smith",
      employeeTitle: "Primary Care Physician",
      notes: [
        {
          noteId: "NOTE001",
          audioFilename: "note_20240910_143022.wav",
          audioDurationSeconds: 180,
          transcriptionText: "Patient presents for routine annual physical. Blood pressure 120/80, within normal limits. Patient reports feeling well with no acute concerns. Discussed importance of maintaining healthy diet and exercise routine.",
          isTranscriptionEdited: false,
          createdAt: "2024-09-10T14:30:22Z"
        }
      ]
    },
    {
      visitId: "VID124",
      visitDate: "2024-08-15",
      visitPurpose: "Follow-up for hypertension medication adjustment",
      employeeName: "Dr. Smith",
      employeeTitle: "Primary Care Physician",
      notes: [
        {
          noteId: "NOTE002",
          audioFilename: "note_20240815_100530.wav",
          audioDurationSeconds: 95,
          transcriptionText: "Follow-up visit for blood pressure management. Current medication lisinopril 10mg daily showing good response. Patient reports no side effects. Blood pressure today 125/82, improved from last visit.",
          isTranscriptionEdited: true,
          createdAt: "2024-08-15T10:05:30Z"
        }
      ]
    }
  ];

  const handleSelectPatient = (patientId: string) => {
    const patient = mockPatients.find(p => p.patientId === patientId);
    setSelectedPatient(patient);
    setCurrentView('history');
    console.log('Patient selected:', patientId);
  };

  const handleCreateNewPatient = () => {
    console.log('Create new patient triggered');
    // todo: remove mock functionality - implement real patient creation
  };

  const handleStartNewVisit = () => {
    const newVisit = {
      visitId: `VID${Date.now()}`,
      visitDate: new Date().toISOString().split('T')[0],
      patientId: selectedPatient?.patientId,
      employeeName: `${currentUser.firstName} ${currentUser.lastName}`,
      employeeTitle: currentUser.title
    };
    setCurrentVisit(newVisit);
    setCurrentView('newVisit');
    console.log('New visit started:', newVisit);
  };

  const handleSaveNote = (audioBlob: Blob, transcription: string) => {
    console.log('Saving note:', { 
      visitId: currentVisit?.visitId, 
      audioSize: audioBlob.size,
      transcriptionLength: transcription.length 
    });
    // todo: remove mock functionality - implement real note saving
  };

  const handlePlayAudio = (noteId: string) => {
    console.log('Playing audio for note:', noteId);
    // todo: remove mock functionality - implement real audio playback
  };

  const handleViewNote = (noteId: string) => {
    console.log('Viewing note:', noteId);
    // todo: remove mock functionality - implement full note view
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'select':
        return (
          <PatientSelector
            patients={mockPatients}
            onSelectPatient={handleSelectPatient}
            onCreateNewPatient={handleCreateNewPatient}
          />
        );
      
      case 'history':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle data-testid="text-selected-patient-name">
                      {selectedPatient?.firstName} {selectedPatient?.lastName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      MRN: {selectedPatient?.patientId} • Age: {
                        new Date().getFullYear() - new Date(selectedPatient?.dateOfBirth).getFullYear()
                      }
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleStartNewVisit}
                      data-testid="button-start-new-visit"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      New Visit
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentView('select')}
                      data-testid="button-back-to-patients"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Patients
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
            
            <VisitHistory
              visits={mockVisits}
              onPlayAudio={handlePlayAudio}
              onViewNote={handleViewNote}
              patientName={`${selectedPatient?.firstName} ${selectedPatient?.lastName}`}
            />
          </div>
        );
      
      case 'newVisit':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>New Visit</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Patient: {selectedPatient?.firstName} {selectedPatient?.lastName} (MRN: {selectedPatient?.patientId})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Date: {new Date().toLocaleDateString()}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentView('history')}
                    data-testid="button-back-to-history"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to History
                  </Button>
                </div>
              </CardHeader>
            </Card>
            
            <AudioRecorder
              visitId={currentVisit?.visitId}
              onSaveNote={handleSaveNote}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-app-title">
                  NotesMate
                </h1>
                <p className="text-sm text-muted-foreground">
                  Medical Audio Notes & Transcription
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-sm font-medium" data-testid="text-user-name">
                    {currentUser.firstName} {currentUser.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-user-title">
                    {currentUser.title} • {currentUser.orgName}
                  </p>
                </div>
              </div>
              
              <Separator orientation="vertical" className="h-8" />
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleTheme}
                data-testid="button-theme-toggle"
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={onLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {renderCurrentView()}
      </main>
    </div>
  );
}