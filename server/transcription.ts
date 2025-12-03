import { createClient } from "@deepgram/sdk";

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration?: number;
}

export interface TranscriptionError {
  error: string;
  details: string;
}

class DeepgramTranscriptionService {
  private deepgram: ReturnType<typeof createClient> | null = null;

  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (apiKey) {
      this.deepgram = createClient(apiKey);
      console.log('Deepgram client initialized successfully');
    } else {
      console.warn('DEEPGRAM_API_KEY not found - transcription service unavailable');
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult | TranscriptionError> {
    try {
      if (!audioBuffer || audioBuffer.length === 0) {
        return {
          error: "No audio data provided",
          details: "Audio buffer is empty"
        };
      }

      if (!this.deepgram) {
        return {
          error: "Deepgram service not configured",
          details: "DEEPGRAM_API_KEY environment variable is missing"
        };
      }

      console.log('Processing audio transcription with Deepgram');
      console.log('Audio buffer size:', audioBuffer.length, 'bytes, MIME type:', mimeType);
      
      const { result, error } = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: "nova-2",
          smart_format: true,
          punctuate: true,
          diarize: false,
          language: "en-US"
        }
      );

      if (error) {
        console.error('Deepgram API error:', error);
        return {
          error: "Deepgram transcription failed",
          details: error.message || "Unknown Deepgram error"
        };
      }

      if (!result?.results?.channels?.[0]?.alternatives?.[0]) {
        return {
          error: "Invalid transcription response",
          details: "No transcription data returned from Deepgram"
        };
      }

      const transcript = result.results.channels[0].alternatives[0].transcript;
      const confidence = result.results.channels[0].alternatives[0].confidence || 0;
      const duration = result.metadata?.duration;

      console.log('Deepgram transcription completed successfully');
      console.log('Transcript length:', transcript.length, 'characters');
      console.log('Confidence:', confidence);
      
      return {
        text: transcript,
        confidence: confidence,
        duration: duration
      };

    } catch (error) {
      console.error('Transcription error:', error);
      
      return {
        error: "Transcription failed",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }

  async isServiceAvailable(): Promise<boolean> {
    try {
      return !!this.deepgram;
    } catch (error) {
      console.error('Deepgram service check failed:', error);
      return false;
    }
  }
}

export const transcriptionService = new DeepgramTranscriptionService();