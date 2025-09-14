import PatientSelector from '../PatientSelector';

export default function PatientSelectorExample() {
  const mockPatients = [
    {
      patientId: "MRN001234",
      firstName: "Sarah",
      lastName: "Johnson", 
      dateOfBirth: "1985-03-15",
      gender: "Female",
      contactInfo: "Phone: (555) 123-4567",
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
      contactInfo: "Phone: (555) 456-7890",
      lastVisit: "2024-09-05"
    }
  ];

  return (
    <div className="p-4">
      <PatientSelector
        patients={mockPatients}
        onSelectPatient={(patientId) => console.log('Selected patient:', patientId)}
        onCreateNewPatient={() => console.log('Creating new patient')}
      />
    </div>
  );
}