import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function PatientSelector({ patients, onSelectPatient, onCreateNewPatient }: PatientSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("");

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = searchTerm === "" || 
      `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.patientId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGender = selectedGender === "" || patient.gender === selectedGender;
    
    return matchesSearch && matchesGender;
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
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or medical record number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-patient"
            />
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
              {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} found
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
      {filteredPatients.length === 0 ? (
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
                  <TableHead className="w-[120px]">MRN</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead className="w-[100px]">Gender</TableHead>
                  <TableHead className="w-[80px] text-center">Age</TableHead>
                  <TableHead className="w-[120px]">Last Visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow 
                    key={patient.patientId}
                    className="cursor-pointer hover-elevate"
                    onClick={() => onSelectPatient(patient.patientId)}
                    data-testid={`row-patient-${patient.patientId}`}
                  >
                    <TableCell className="font-medium" data-testid={`text-mrn-${patient.patientId}`}>
                      {patient.patientId}
                    </TableCell>
                    <TableCell data-testid={`text-patient-name-${patient.patientId}`}>
                      {patient.firstName} {patient.lastName}
                    </TableCell>
                    <TableCell data-testid={`text-gender-${patient.patientId}`}>
                      <Badge variant="outline" className="font-normal">
                        {patient.gender}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-age-${patient.patientId}`}>
                      {calculateAge(patient.dateOfBirth)}
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`text-last-visit-${patient.patientId}`}>
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
