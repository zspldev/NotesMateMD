import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Plus, ArrowUpDown, ArrowUp, ArrowDown, Mic, MicOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

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
}

type SortField = 'mrn' | 'name' | null;
type SortDirection = 'asc' | 'desc';

export default function PatientSelector({ patients, onSelectPatient, onCreateNewPatient }: PatientSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">
                    <button
                      className="flex items-center font-bold hover:text-foreground transition-colors"
                      onClick={() => handleSort('mrn')}
                      data-testid="button-sort-mrn"
                    >
                      MRN
                      {getSortIcon('mrn')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center font-bold hover:text-foreground transition-colors"
                      onClick={() => handleSort('name')}
                      data-testid="button-sort-name"
                    >
                      Patient Name
                      {getSortIcon('name')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px] font-bold">Gender</TableHead>
                  <TableHead className="w-[80px] text-center font-bold">Age</TableHead>
                  <TableHead className="w-[140px] font-bold">Phone/Email</TableHead>
                  <TableHead className="w-[120px] font-bold">Last Visit</TableHead>
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
                      {patient.firstName} {patient.lastName}
                    </TableCell>
                    <TableCell className="font-normal" data-testid={`text-gender-${patient.patientId}`}>
                      <Badge variant="outline" className="font-normal">
                        {patient.gender}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-normal" data-testid={`text-age-${patient.patientId}`}>
                      {calculateAge(patient.dateOfBirth)}
                    </TableCell>
                    <TableCell className="font-normal text-muted-foreground" data-testid={`text-phone-${patient.patientId}`}>
                      {patient.contactInfo || "-"}
                    </TableCell>
                    <TableCell className="font-normal text-muted-foreground" data-testid={`text-last-visit-${patient.patientId}`}>
                      {formatDate(patient.lastVisit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
