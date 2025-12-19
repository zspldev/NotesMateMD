import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Sun, 
  Moon, 
  User, 
  Calendar, 
  FileText, 
  Stethoscope, 
  LogOut,
  ArrowLeft,
  Loader2,
  Download,
  X,
  Shield,
  ArrowRightLeft
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import PatientSelector from "./PatientSelector";
import VisitHistory from "./VisitHistory";
import AudioRecorder from "./AudioRecorder";
import VisitDocuments from "./VisitDocuments";
import NewPatientDialog from "./NewPatientDialog";
import ExportPDFDialog from "./ExportPDFDialog";
import SuperAdminDashboard from "./SuperAdminDashboard";
import OrgAdminDashboard from "./OrgAdminDashboard";
import { useToast } from "@/hooks/use-toast";
import { api, type LoginResponse, type Patient, type Visit } from "../lib/api";
import type { InsertPatient } from "@shared/schema";

interface DashboardProps {
  loginData: LoginResponse;
  onLogout: () => void;
  onSwitchOrg?: (orgCode: string) => void;
  onClearImpersonation?: () => void;
  activeRole?: string;
  onSwitchRole?: (role: string) => void;
}

// UI types that match existing component prop expectations
interface UIPatient {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  contactInfo?: string;
  lastVisit?: string;
}

interface UIVisit {
  visitId: string;
  visitDate: string;
  visitPurpose?: string;
  employeeName: string;
  employeeTitle: string;
  notes: UINote[];
  documentCount?: number;
}

interface UINote {
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

export default function Dashboard({ loginData, onLogout, onSwitchOrg, onClearImpersonation, activeRole, onSwitchRole }: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [currentView, setCurrentView] = useState<'select' | 'history' | 'newVisit'>('select');
  const [currentVisit, setCurrentVisit] = useState<any>(null);
  const [latestSavedNote, setLatestSavedNote] = useState<any>(null);
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [visits, setVisits] = useState<UIVisit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [isNewPatientDialogOpen, setIsNewPatientDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const currentUser = {
    firstName: loginData.employee.first_name,
    lastName: loginData.employee.last_name,
    title: loginData.employee.title || 'Unknown',
    orgName: loginData.organization?.org_name || 'Zapurzaa Systems',
    role: loginData.employee.role
  };

  // Get the effective orgid (from login data, may be null for super_admin without org context)
  const effectiveOrgId = loginData.organization?.orgid || loginData.employee.orgid;
  
  // Role-based permission helpers
  const isSuperAdmin = loginData.employee.role === 'super_admin';
  
  // Check if super admin is in their home org (ZSPL) without clinical context
  const isSuperAdminWithoutOrgContext = isSuperAdmin && !loginData.organization;
  
  // Check if super admin is impersonating an org (has org context)
  const isImpersonating = isSuperAdmin && loginData.organization !== null;
  
  const isOrgAdmin = loginData.employee.role === 'org_admin';
  const isDoctor = loginData.employee.role === 'doctor';
  const isStaff = loginData.employee.role === 'staff';
  
  // Determine the current active role (from prop or default based on primary role)
  const currentActiveRole = activeRole || (isOrgAdmin ? 'org_admin' : loginData.employee.role);
  
  // Check if user is in admin view vs clinical view
  const isInAdminView = currentActiveRole === 'org_admin';
  const hasSecondaryRole = !!loginData.employee.secondary_role;
  
  // Permission checks
  const canManagePatients = isSuperAdmin || isOrgAdmin || isDoctor;
  const canViewClinicalNotes = isSuperAdmin || isOrgAdmin || isDoctor;
  const canCreateNotes = isSuperAdmin || isOrgAdmin || isDoctor;
  const canExportData = isSuperAdmin || isOrgAdmin || isDoctor;

  // Map API Patient to UI Patient
  const mapPatientToUI = useCallback((patient: Patient): UIPatient => ({
    patientId: patient.patientid,
    firstName: patient.first_name,
    lastName: patient.last_name,
    dateOfBirth: patient.date_of_birth,
    gender: patient.gender || '',
    contactInfo: patient.contact_info || '',
    lastVisit: patient.lastVisit || undefined
  }), []);

  // Map API Visit to UI Visit
  const mapVisitToUI = useCallback((visit: Visit): UIVisit => ({
    visitId: visit.visitid,
    visitDate: visit.visit_date,
    visitPurpose: visit.visit_purpose || '',
    employeeName: visit.employeeName || 'Unknown',
    employeeTitle: visit.employeeTitle || 'Unknown',
    documentCount: visit.document_count || 0,
    notes: (visit.notes || []).map(note => {
      // Explicitly convert boolean fields to handle undefined/null
      const aiTranscribed = note.ai_transcribed === true;
      const isEdited = note.is_transcription_edited === true;
      
      console.log('Mapping note:', {
        noteid: note.noteid,
        ai_transcribed_raw: note.ai_transcribed,
        aiTranscribed_mapped: aiTranscribed,
        is_transcription_edited_raw: note.is_transcription_edited,
        isEdited_mapped: isEdited
      });
      
      return {
        noteId: note.noteid,
        audioFilename: note.audio_filename || undefined,
        audioDurationSeconds: note.audio_duration_seconds || undefined,
        audioMimeType: note.audio_mimetype || undefined,
        transcriptionText: note.transcription_text || undefined,
        isTranscriptionEdited: isEdited,
        aiTranscribed: aiTranscribed,
        createdAt: new Date(note.created_at).toISOString(),
        audioData: note.audio_file || undefined,
        // Device/Browser tracking fields
        sessionId: note.session_id || undefined,
        deviceType: note.device_type || undefined,
        browserName: note.browser_name || undefined,
        ipAddress: note.ip_address || undefined,
        userAgent: note.user_agent || undefined
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }), []);

  // Load patients on mount
  useEffect(() => {
    const loadPatients = async () => {
      // Super admin without org context - show message instead of loading patients
      if (!effectiveOrgId) {
        setError('Please log in with an organization code to access patient data.');
        return;
      }
      
      setIsLoading(true);
      setError("");
      try {
        const patientsData = await api.getPatients(effectiveOrgId);
        const uiPatients = patientsData.map(mapPatientToUI);
        setPatients(uiPatients);
      } catch (error) {
        console.error('Failed to load patients:', error);
        setError('Failed to load patients. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPatients();
  }, [effectiveOrgId, mapPatientToUI]);

  const handleSelectPatient = useCallback(async (patientId: string) => {
    const patient = await api.getPatient(patientId);
    setSelectedPatient(patient);
    setCurrentView('history');
    
    // Load visits for this patient
    setIsLoading(true);
    setError("");
    try {
      const visitsData = await api.getPatientVisits(patientId);
      const uiVisits = visitsData.map(mapVisitToUI);
      
      // Sort visits by most recent activity (newest note or visit date if no notes)
      uiVisits.sort((a, b) => {
        // Get most recent note time for each visit
        const aLatestNote = a.notes.length > 0 ? new Date(a.notes[0].createdAt).getTime() : 0;
        const bLatestNote = b.notes.length > 0 ? new Date(b.notes[0].createdAt).getTime() : 0;
        
        // Use visit date as fallback
        const aVisitDate = new Date(a.visitDate).getTime();
        const bVisitDate = new Date(b.visitDate).getTime();
        
        // Compare by most recent activity (note time if available, otherwise visit date)
        const aTime = aLatestNote || aVisitDate;
        const bTime = bLatestNote || bVisitDate;
        
        return bTime - aTime; // Descending order (newest first)
      });
      
      setVisits(uiVisits);
    } catch (error) {
      console.error('Failed to load visits:', error);
      setError('Failed to load visit history.');
    } finally {
      setIsLoading(false);
    }
  }, [mapVisitToUI]);

  const handleCreateNewPatient = useCallback(() => {
    setIsNewPatientDialogOpen(true);
  }, []);

  const handleRefreshPatients = useCallback(async () => {
    if (!effectiveOrgId) return;
    try {
      const patientsData = await api.getPatients(effectiveOrgId);
      const uiPatients = patientsData.map(mapPatientToUI);
      setPatients(uiPatients);
    } catch (error) {
      console.error('Failed to refresh patients:', error);
    }
  }, [effectiveOrgId, mapPatientToUI]);

  const handlePatientCreation = useCallback(async (patientData: InsertPatient) => {
    try {
      await api.createPatient(patientData);
      
      toast({
        title: "Patient created",
        description: `${patientData.first_name} ${patientData.last_name} has been added to the system.`,
      });

      // Reload patients list
      await handleRefreshPatients();
    } catch (error) {
      console.error('Failed to create patient:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create patient",
        variant: "destructive",
      });
      throw error;
    }
  }, [handleRefreshPatients, toast]);

  const handleStartNewVisit = useCallback(async () => {
    if (!selectedPatient) return;

    try {
      // Use local date (not UTC) to avoid timezone issues
      const today = new Date();
      const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const newVisit = await api.createVisit({
        patientid: selectedPatient.patientid,
        empid: loginData.employee.empid,
        visit_date: localDate,
        visit_purpose: null
      });
      
      setCurrentVisit({
        visitId: newVisit.visitid,
        visitDate: newVisit.visit_date,
        patientId: selectedPatient.patientid,
        employeeName: `${currentUser.firstName} ${currentUser.lastName}`,
        employeeTitle: currentUser.title
      });
      setLatestSavedNote(null); // Clear any previous note when starting new visit
      setCurrentView('newVisit');
    } catch (error) {
      console.error('Failed to create visit:', error);
      setError('Failed to create new visit.');
    }
  }, [selectedPatient, loginData.employee.empid, currentUser]);

  const handleSaveNote = useCallback(async (audioBlob: Blob | null, transcription: string) => {
    if (!currentVisit) return { ai_transcribed: false };

    try {
      let noteId: string;
      
      if (audioBlob) {
        // Save with audio
        const audioDuration = Math.floor(audioBlob.size / 16000); // Rough estimate
        const result = await api.createNoteWithAudio(
          currentVisit.visitId,
          audioBlob,
          transcription,
          audioDuration
        );
        noteId = result.noteid;
      } else {
        // Save manual transcription only (no audio)
        const result = await api.createNote({
          visitid: currentVisit.visitId,
          transcription_text: transcription,
          is_transcription_edited: true
        });
        noteId = result.noteid;
      }
      
      console.log('Note saved successfully, noteId:', noteId);
      
      // Fetch the full note details to get audio data
      const fullNote = await api.getNote(noteId);
      console.log('Full note retrieved:', fullNote);
      
      // Update saved note:
      // - If new note has audio, replace with new note (user recorded new audio)
      // - If new note has no audio, keep previous audio note (user edited transcription only)
      if (fullNote.audio_file && fullNote.audio_mimetype) {
        setLatestSavedNote(fullNote);
      }
      // Don't clear latestSavedNote if saving transcription-only - preserve previous audio
      
      // Refresh visits in background but stay in visit context to allow multiple notes
      if (selectedPatient) {
        const visitsData = await api.getPatientVisits(selectedPatient.patientid);
        const uiVisits = visitsData.map(mapVisitToUI);
        setVisits(uiVisits);
      }
      
      return { 
        ai_transcribed: fullNote.ai_transcribed || false,
        transcription_text: fullNote.transcription_text || undefined
      };
    } catch (error) {
      console.error('Failed to save note:', error);
      setError('Failed to save note. Please try again.');
      return { ai_transcribed: false };
    }
  }, [currentVisit, selectedPatient, mapVisitToUI]);

  const handlePlayAudio = useCallback((noteId: string) => {
    // Create audio element and play from API endpoint
    const audio = new Audio(api.getAudioUrl(noteId));
    audio.play().catch(error => {
      console.error('Failed to play audio:', error);
    });
  }, []);

  const handleViewNote = useCallback((noteId: string) => {
    console.log('View note details feature coming soon');
  }, []);

  const renderCurrentView = () => {
    if (error) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-destructive mb-4">{error}</div>
            <Button onClick={() => setError("")} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (isLoading) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      );
    }

    // Super admin without org context sees admin dashboard
    if (isSuperAdminWithoutOrgContext && currentView === 'select') {
      return (
        <SuperAdminDashboard 
          loginData={loginData} 
          onSwitchOrg={onSwitchOrg || (() => {})} 
        />
      );
    }
    
    // Org admin in admin view sees org admin dashboard
    if (isOrgAdmin && isInAdminView && currentView === 'select') {
      return (
        <OrgAdminDashboard 
          loginData={loginData} 
          onSwitchRole={onSwitchRole}
        />
      );
    }

    switch (currentView) {
      case 'select':
        return (
          <PatientSelector
            patients={patients}
            onSelectPatient={handleSelectPatient}
            onCreateNewPatient={handleCreateNewPatient}
            onPatientUpdated={handleRefreshPatients}
            onPatientDeleted={handleRefreshPatients}
          />
        );
      
      case 'history':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle data-testid="text-selected-patient-name">
                      {selectedPatient?.first_name} {selectedPatient?.last_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      MRN: {selectedPatient?.patientid} • Age: {
                        selectedPatient ? new Date().getFullYear() - new Date(selectedPatient.date_of_birth).getFullYear() : 'Unknown'
                      }
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      onClick={handleStartNewVisit}
                      data-testid="button-start-new-visit"
                      className="flex-1 sm:flex-none"
                      style={{ backgroundColor: '#17a2b8' }}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      New Visit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsExportDialogOpen(true)}
                      data-testid="button-export-notes"
                      className="flex-1 sm:flex-none"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentView('select')}
                      data-testid="button-back-to-patients"
                      className="flex-1 sm:flex-none"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
            
            <VisitHistory
              visits={visits}
              onPlayAudio={handlePlayAudio}
              onViewNote={handleViewNote}
              patientName={selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Unknown Patient'}
            />
          </div>
        );
      
      case 'newVisit':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>New Visit</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Patient: {selectedPatient?.first_name} {selectedPatient?.last_name} (MRN: {selectedPatient?.patientid})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Date: {new Date().toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        setShowUnsavedDialog(true);
                      } else {
                        setCurrentView('history');
                      }
                    }}
                    data-testid="button-back-to-history"
                    className="w-full sm:w-auto"
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
              existingAudioFile={latestSavedNote?.audio_file || undefined}
              existingAudioMimetype={latestSavedNote?.audio_mimetype || undefined}
              existingAudioDuration={latestSavedNote?.audio_duration_seconds || undefined}
              existingAudioFilename={latestSavedNote?.audio_filename || undefined}
              existingTranscription={latestSavedNote?.transcription_text || undefined}
              onUnsavedChanges={setHasUnsavedChanges}
            />
            
            {currentVisit?.visitId && (
              <VisitDocuments visitId={currentVisit.visitId} />
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div 
          className="bg-amber-500 text-white px-4 py-2"
          data-testid="banner-impersonation"
        >
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">
                Super Admin Mode: Viewing {loginData.organization?.org_name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-amber-600"
              onClick={onClearImpersonation}
              data-testid="button-exit-impersonation"
            >
              <X className="h-4 w-4 mr-1" />
              Exit
            </Button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#17a2b8' }} data-testid="text-app-title">
                  NotesMate MD
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Medical Audio Notes & Transcription
                </p>
              </div>
              <div className="flex items-center gap-2 sm:hidden">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={toggleTheme}
                  data-testid="button-theme-toggle-mobile"
                >
                  {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={onLogout}
                  data-testid="button-logout-mobile"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="hidden sm:flex items-center gap-4">
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
              
              {/* Show role switch button for dual-role users */}
              {isOrgAdmin && hasSecondaryRole && (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => onSwitchRole?.(isInAdminView ? 'doctor' : 'org_admin')}
                  data-testid="button-switch-role"
                  className="gap-1"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {isInAdminView ? 'Switch to Clinical View' : 'Switch to Admin View'}
                </Button>
              )}
              
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
            
            <div className="flex sm:hidden items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium" data-testid="text-user-name-mobile">
                {currentUser.firstName} {currentUser.lastName}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground text-xs" data-testid="text-user-title-mobile">
                {currentUser.title}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {renderCurrentView()}
      </main>

      {/* New Patient Dialog */}
      {effectiveOrgId && (
        <NewPatientDialog
          open={isNewPatientDialogOpen}
          onOpenChange={setIsNewPatientDialogOpen}
          onCreatePatient={handlePatientCreation}
          orgId={effectiveOrgId}
        />
      )}

      {/* Export PDF Dialog */}
      {selectedPatient && (
        <ExportPDFDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          patientId={selectedPatient.patientid}
          patientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
        />
      )}

      {/* Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved transcription or audio that will be lost if you leave this page. 
              Would you like to save your note before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setShowUnsavedDialog(false)}
              data-testid="button-cancel-leave"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setShowUnsavedDialog(false);
                setHasUnsavedChanges(false);
                setCurrentView('history');
              }}
              data-testid="button-discard-changes"
            >
              Discard Changes
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}