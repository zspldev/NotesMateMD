import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Plus, ArrowUpDown, ArrowUp, ArrowDown, Mic, MicOff, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";

interface Patient {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  contactInfo?: string;
  lastVisit?: string;
}

interface PatientSelectorProps {
  patients: Patient[];
  onSelectPatient: (patientId: string) => void;
  onCreateNewPatient: () => void;
  onPatientUpdated?: () => void;
  onPatientDeleted?: () => void;
}

type SortField = 'mrn' | 'name' | null;
type SortDirection = 'asc' | 'desc';

const editPatientSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().optional(),
  contact_info: z.string().optional(),
});

type EditPatientFormValues = z.infer<typeof editPatientSchema>;

export default function PatientSelector({ 
  patients, 
  onSelectPatient, 
  onCreateNewPatient,
  onPatientUpdated,
  onPatientDeleted
}: PatientSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isListening, setIsListening] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const form = useForm<EditPatientFormValues>({
    resolver: zodResolver(editPatientSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "",
      contact_info: "",
    },
  });

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchTerm(transcript);
        setIsListening(false);
        toast({
          title: "Voice search",
          description: `Searching for: "${transcript}"`,
        });
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Voice search error",
          description: "Could not recognize speech. Please try again.",
          variant: "destructive",
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [toast]);

  const handleVoiceSearch = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Voice search unavailable",
        description: "Your browser does not support voice search.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.abort();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast({
          title: "Listening...",
          description: "Speak now to search for a patient.",
        });
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setIsListening(false);
      }
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const handleEditClick = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    setEditingPatient(patient);
    form.reset({
      first_name: patient.firstName,
      last_name: patient.lastName,
      date_of_birth: patient.dateOfBirth,
      gender: patient.gender || "",
      contact_info: patient.contactInfo || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    setDeletingPatient(patient);
    setIsDeleteDialogOpen(true);
  };

  const handleEditSubmit = async (values: EditPatientFormValues) => {
    if (!editingPatient) return;
    
    setIsSubmitting(true);
    try {
      await api.updatePatient(editingPatient.patientId, values);
      toast({
        title: "Patient updated",
        description: `${values.first_name} ${values.last_name}'s record has been updated.`,
      });
      setIsEditDialogOpen(false);
      setEditingPatient(null);
      onPatientUpdated?.();
    } catch (error) {
      console.error('Failed to update patient:', error);
      toast({
        title: "Update failed",
        description: "Could not update patient record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPatient) return;
    
    setIsSubmitting(true);
    try {
      await api.deletePatient(deletingPatient.patientId);
      toast({
        title: "Patient deleted",
        description: `${deletingPatient.firstName} ${deletingPatient.lastName}'s record and all associated data have been permanently deleted.`,
      });
      setIsDeleteDialogOpen(false);
      setDeletingPatient(null);
      onPatientDeleted?.();
    } catch (error) {
      console.error('Failed to delete patient:', error);
      toast({
        title: "Delete failed",
        description: "Could not delete patient record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAndSortedPatients = patients
    .filter(patient => {
      const matchesSearch = searchTerm === "" || 
        `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.patientId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesGender = selectedGender === "" || patient.gender === selectedGender;
      
      return matchesSearch && matchesGender;
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      
      let comparison = 0;
      if (sortField === 'mrn') {
        comparison = a.patientId.localeCompare(b.patientId, undefined, { numeric: true });
      } else if (sortField === 'name') {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const genders = Array.from(new Set(patients.map(p => p.gender).filter(Boolean)));

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  return (
    <div className="space-y-6" data-testid="container-patient-selector">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Select Patient</span>
            <Button 
              onClick={onCreateNewPatient}
              data-testid="button-create-new-patient"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              New Patient
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search with Voice */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or medical record number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-patient"
              />
            </div>
            <Button
              variant={isListening ? "default" : "outline"}
              size="icon"
              onClick={handleVoiceSearch}
              className={isListening ? "animate-pulse" : ""}
              data-testid="button-voice-search"
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Gender Filter */}
          {genders.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Filter by gender:</span>
              <Button
                variant={selectedGender === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedGender("")}
                data-testid="button-filter-all"
              >
                All
              </Button>
              {genders.map(gender => (
                <Button
                  key={gender}
                  variant={selectedGender === gender ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedGender(gender)}
                  data-testid={`button-filter-${gender.toLowerCase()}`}
                >
                  {gender}
                </Button>
              ))}
            </div>
          )}
          
          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span data-testid="text-results-count">
              {filteredAndSortedPatients.length} patient{filteredAndSortedPatients.length !== 1 ? 's' : ''} found
            </span>
            {(searchTerm || selectedGender) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedGender("");
                }}
                data-testid="button-clear-filters"
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Patient Table */}
      {filteredAndSortedPatients.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <div className="space-y-4">
              <div className="text-muted-foreground">
                {searchTerm || selectedGender ? (
                  <>
                    <p data-testid="text-no-results">No patients match your search criteria.</p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedGender("");
                      }}
                      className="mt-2"
                    >
                      Show all patients
                    </Button>
                  </>
                ) : (
                  <>
                    <p data-testid="text-no-patients">No patients found in the system.</p>
                    <Button 
                      onClick={onCreateNewPatient}
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Patient
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] min-w-[100px]">
                      <button
                        className="flex items-center font-bold hover:text-foreground transition-colors"
                        onClick={() => handleSort('mrn')}
                        data-testid="button-sort-mrn"
                      >
                        MRN
                        {getSortIcon('mrn')}
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[140px]">
                      <button
                        className="flex items-center font-bold hover:text-foreground transition-colors"
                        onClick={() => handleSort('name')}
                        data-testid="button-sort-name"
                      >
                        Patient Name
                        {getSortIcon('name')}
                      </button>
                    </TableHead>
                    <TableHead className="w-[80px] min-w-[80px] font-bold hidden sm:table-cell">Gender</TableHead>
                    <TableHead className="w-[60px] min-w-[60px] text-center font-bold">Age</TableHead>
                    <TableHead className="w-[140px] min-w-[140px] font-bold hidden md:table-cell">Phone/Email</TableHead>
                    <TableHead className="w-[100px] min-w-[100px] font-bold hidden lg:table-cell">Last Visit</TableHead>
                    <TableHead className="w-[80px] min-w-[80px] font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedPatients.map((patient) => (
                    <TableRow 
                      key={patient.patientId}
                      className="cursor-pointer hover-elevate"
                      onClick={() => onSelectPatient(patient.patientId)}
                      data-testid={`row-patient-${patient.patientId}`}
                    >
                      <TableCell className="font-normal" data-testid={`text-mrn-${patient.patientId}`}>
                        {patient.patientId}
                      </TableCell>
                      <TableCell className="font-normal" data-testid={`text-patient-name-${patient.patientId}`}>
                        <div>
                          <span>{patient.firstName} {patient.lastName}</span>
                          <span className="sm:hidden text-xs text-muted-foreground block">
                            {patient.gender}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-normal hidden sm:table-cell" data-testid={`text-gender-${patient.patientId}`}>
                        <Badge variant="outline" className="font-normal">
                          {patient.gender}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-normal" data-testid={`text-age-${patient.patientId}`}>
                        {calculateAge(patient.dateOfBirth)}
                      </TableCell>
                      <TableCell className="font-normal text-muted-foreground hidden md:table-cell" data-testid={`text-phone-${patient.patientId}`}>
                        {patient.contactInfo || "-"}
                      </TableCell>
                      <TableCell className="font-normal text-muted-foreground hidden lg:table-cell" data-testid={`text-last-visit-${patient.patientId}`}>
                        {formatDate(patient.lastVisit)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleEditClick(e, patient)}
                            data-testid={`button-edit-patient-${patient.patientId}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteClick(e, patient)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-patient-${patient.patientId}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Patient Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-edit-patient">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>
              Update patient information. MRN cannot be changed.
            </DialogDescription>
          </DialogHeader>

          {editingPatient && (
            <div className="text-sm text-muted-foreground mb-2">
              MRN: <span className="font-medium">{editingPatient.patientId}</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          {...field}
                          data-testid="input-edit-first-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          {...field}
                          data-testid="input-edit-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-edit-dob"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-gender">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="contact_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Information</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Phone: (555) 123-4567&#10;Email: patient@example.com"
                        {...field}
                        value={field.value || ""}
                        rows={3}
                        data-testid="input-edit-contact-info"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isSubmitting}
                  data-testid="button-edit-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-edit-save"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-patient">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient Record?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to permanently delete the patient record for{" "}
                <span className="font-semibold">
                  {deletingPatient?.firstName} {deletingPatient?.lastName}
                </span>{" "}
                (MRN: {deletingPatient?.patientId}).
              </p>
              <p className="text-destructive font-medium">
                Warning: This action cannot be undone. All associated data will be permanently deleted, including:
              </p>
              <ul className="list-disc list-inside text-destructive">
                <li>All visit history records</li>
                <li>All audio notes and recordings</li>
                <li>All transcriptions</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={isSubmitting}
              data-testid="button-delete-cancel"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
