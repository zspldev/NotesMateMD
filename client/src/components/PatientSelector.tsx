import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, UserPlus } from "lucide-react";
import PatientCard from "./PatientCard";

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

  return (
    <div className="space-y-6" data-testid="container-patient-selector">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
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

      {/* Patient Grid */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.patientId}
              patientId={patient.patientId}
              firstName={patient.firstName}
              lastName={patient.lastName}
              dateOfBirth={patient.dateOfBirth}
              gender={patient.gender}
              contactInfo={patient.contactInfo}
              lastVisit={patient.lastVisit}
              onSelect={() => onSelectPatient(patient.patientId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}