import AudioRecorder from '../AudioRecorder';

export default function AudioRecorderExample() {
  return (
    <div className="p-4 max-w-2xl">
      <AudioRecorder
        visitId="VID123456"
        onSaveNote={(audioBlob, transcription) => {
          console.log('Note saved:', { 
            audioSize: audioBlob.size, 
            transcription: transcription.substring(0, 50) + '...' 
          });
        }}
        existingTranscription="Patient presents with chest pain radiating to left arm. Blood pressure elevated at 150/95. Prescribed medication and follow-up in 2 weeks."
      />
    </div>
  );
}