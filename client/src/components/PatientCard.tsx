import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Calendar, Phone } from "lucide-react";

interface PatientCardProps {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  contactInfo?: string;
  lastVisit?: string;
  onSelect: () => void;
}

export default function PatientCard({
  patientId,
  firstName,
  lastName,
  dateOfBirth,
  gender,
  contactInfo,
  lastVisit,
  onSelect,
}: PatientCardProps) {
  const formatAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <Card className="hover-elevate cursor-pointer" onClick={onSelect} data-testid={`card-patient-${patientId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground" data-testid={`text-patient-name-${patientId}`}>
                {firstName} {lastName}
              </h3>
              <p className="text-sm text-muted-foreground">MRN: {patientId}</p>
            </div>
          </div>
          <Badge variant="outline" data-testid={`badge-gender-${patientId}`}>
            {gender}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Age: {formatAge(dateOfBirth)}</span>
          <span className="text-xs">({new Date(dateOfBirth).toLocaleDateString()})</span>
        </div>
        
        {contactInfo && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span className="truncate">{contactInfo}</span>
          </div>
        )}
        
        {lastVisit && (
          <div className="text-xs text-muted-foreground">
            Last visit: {new Date(lastVisit).toLocaleDateString()}
          </div>
        )}
        
        <Button 
          className="w-full" 
          variant="outline"
          data-testid={`button-select-patient-${patientId}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          Select Patient
        </Button>
      </CardContent>
    </Card>
  );
}