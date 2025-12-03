import PatientCard from '../PatientCard';

export default function PatientCardExample() {
  return (
    <div className="p-4 space-y-4 max-w-sm">
      <PatientCard
        patientId="MRN001234"
        firstName="Sarah"
        lastName="Johnson"
        dateOfBirth="1985-03-15"
        gender="Female"
        contactInfo="Phone: (555) 123-4567"
        lastVisit="2024-09-10"
        onSelect={() => console.log('Patient selected')}
      />
    </div>
  );
}