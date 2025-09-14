import { createClient } from "@deepgram/sdk";

interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
}

interface TranscriptionError {
  error: string;
  details?: string;
}

class DeepgramTranscriptionService {
  private deepgram: any = null;
  private apiKey: string | null = null;

  constructor() {
    // Don't throw here - lazy load the client when needed
    this.apiKey = process.env.DEEPGRAM_API_KEY || null;
  }

  private initializeClient() {
    if (!this.apiKey) {
      throw new Error("DEEPGRAM_API_KEY environment variable is required");
    }
    
    if (!this.deepgram) {
      this.deepgram = createClient(this.apiKey);
      console.log('Deepgram client initialized successfully');
    }
    
    return this.deepgram;
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult | TranscriptionError> {
    try {
      // Check if API key is available
      if (!this.apiKey) {
        return {
          error: "Deepgram service unavailable",
          details: "DEEPGRAM_API_KEY environment variable not configured"
        };
      }

      // Initialize client if needed
      const client = this.initializeClient();
      // Configure Deepgram with medical-optimized settings
      const options = {
        model: "nova-2-medical", // Using medical-optimized model for healthcare transcription
        language: "en-US",
        punctuate: true,
        smart_format: true,
        utterances: false,
        keywords: [
          "blood pressure",
          "heart rate", 
          "temperature",
          "medication",
          "diagnosis",
          "symptoms",
          "patient",
          "prescription",
          "dosage",
          "medical history"
        ]
      };

      console.log('Starting Deepgram transcription with options:', options);
      console.log('Audio buffer size:', audioBuffer.length, 'bytes, MIME type:', mimeType);
      
      // Create source object with buffer and mimetype for Deepgram
      const source = {
        buffer: audioBuffer,
        mimetype: mimeType
      };
      
      const response = await client.listen.prerecorded.transcribeFile(
        source,
        options
      );

      // Check for Deepgram API errors first
      if (response.error) {
        console.error('Deepgram API error:', response.error);
        return {
          error: "Deepgram API error",
          details: "Invalid audio format or API issue"
        };
      }

      if (!response.result?.results?.channels?.[0]?.alternatives?.[0]) {
        console.log('Deepgram response structure check failed:');
        console.log('- response.result:', !!response.result);
        console.log('- response.result.results:', !!response.result?.results);
        console.log('- channels length:', response.result?.results?.channels?.length || 0);
        console.log('- alternatives:', response.result?.results?.channels?.[0]?.alternatives?.length || 0);
        
        return {
          error: "No transcription results received",
          details: "Audio file may be empty or in unsupported format"
        };
      }

      const transcript = response.result.results.channels[0].alternatives[0];
      
      return {
        text: transcript.transcript || "",
        confidence: transcript.confidence || 0,
        duration: response.result.metadata?.duration || 0
      };

    } catch (error) {
      console.error('Deepgram transcription error:', error);
      
      return {
        error: "Transcription failed",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }

  async isServiceAvailable(): Promise<boolean> {
    try {
      return !!this.apiKey && this.apiKey.length > 10;
    } catch (error) {
      console.error('Deepgram service check failed:', error);
      return false;
    }
  }
}

export const transcriptionService = new DeepgramTranscriptionService();
export type { TranscriptionResult, TranscriptionError };