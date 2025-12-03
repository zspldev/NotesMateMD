import VisitHistory from '../VisitHistory';

export default function VisitHistoryExample() {
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
          transcriptionText: "Patient presents for routine annual physical. Blood pressure 120/80, within normal limits. Patient reports feeling well with no acute concerns.",
          isTranscriptionEdited: false,
          createdAt: "2024-09-10T14:30:22Z"
        }
      ]
    },
    {
      visitId: "VID124",
      visitDate: "2024-08-15", 
      visitPurpose: "Follow-up for hypertension",
      employeeName: "Dr. Johnson",
      employeeTitle: "Cardiologist",
      notes: [
        {
          noteId: "NOTE002",
          audioFilename: "note_20240815_100530.wav",
          audioDurationSeconds: 95,
          transcriptionText: "Follow-up visit for blood pressure management. Current medication showing good response.",
          isTranscriptionEdited: true,
          createdAt: "2024-08-15T10:05:30Z"
        }
      ]
    }
  ];

  return (
    <div className="p-4 max-w-4xl">
      <VisitHistory
        visits={mockVisits}
        onPlayAudio={(noteId) => console.log('Playing audio:', noteId)}
        onViewNote={(noteId) => console.log('Viewing note:', noteId)}
        patientName="Sarah Johnson"
      />
    </div>
  );
}