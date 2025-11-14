// API client for NotesMate backend

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  employee: {
    empid: string;
    orgid: string;
    username: string;
    first_name: string;
    last_name: string;
    title: string | null;
    created_at: Date;
  };
  organization: {
    orgid: string;
    org_name: string;
    org_type: string | null;
    address: string | null;
    phone: string | null;
    created_at: Date;
  } | null;
}

export interface Patient {
  patientid: string;
  orgid: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string | null;
  contact_info: string | null;
  created_at: Date;
  lastVisit?: string | null;
}

export interface Visit {
  visitid: string;
  patientid: string;
  empid: string;
  visit_date: string;
  visit_purpose: string | null;
  created_at: Date;
  employeeName?: string;
  employeeTitle?: string;
  notes?: VisitNote[];
}

export interface VisitNote {
  noteid: string;
  visitid: string;
  audio_file: string | null;
  audio_filename: string | null;
  audio_mimetype?: string | null;
  audio_duration_seconds: number | null;
  transcription_text: string | null;
  is_transcription_edited: boolean | null;
  ai_transcribed?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface VisitNoteResponse extends VisitNote {
  ai_transcribed?: boolean;
}

class ApiClient {
  private baseUrl = '/api';

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Authentication
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  // Patients
  async getPatients(orgid: string, search?: string): Promise<Patient[]> {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    return this.request<Patient[]>(`/patients?orgid=${orgid}${searchParam}`);
  }

  async getPatient(patientid: string): Promise<Patient> {
    return this.request<Patient>(`/patients/${patientid}`);
  }

  async createPatient(patient: Omit<Patient, 'created_at' | 'lastVisit'>): Promise<Patient> {
    return this.request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(patient),
    });
  }

  async updatePatient(
    patientid: string, 
    updates: Partial<Omit<Patient, 'patientid' | 'created_at' | 'lastVisit'>>
  ): Promise<Patient> {
    return this.request<Patient>(`/patients/${patientid}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Visits
  async getPatientVisits(patientid: string): Promise<Visit[]> {
    return this.request<Visit[]>(`/patients/${patientid}/visits`);
  }

  async getVisit(visitid: string): Promise<Visit & { employee: any; patient: any; notes: VisitNote[] }> {
    return this.request<Visit & { employee: any; patient: any; notes: VisitNote[] }>(`/visits/${visitid}`);
  }

  async createVisit(visit: Omit<Visit, 'visitid' | 'created_at' | 'employeeName' | 'employeeTitle' | 'notes'>): Promise<Visit> {
    return this.request<Visit>('/visits', {
      method: 'POST',
      body: JSON.stringify(visit),
    });
  }

  // Visit Notes
  async getVisitNotes(visitid: string): Promise<VisitNote[]> {
    return this.request<VisitNote[]>(`/visits/${visitid}/notes`);
  }

  async getNote(noteid: string): Promise<VisitNote> {
    return this.request<VisitNote>(`/notes/${noteid}`);
  }

  async createNote(note: {
    visitid: string;
    transcription_text?: string;
    is_transcription_edited?: boolean;
  }): Promise<VisitNote> {
    return this.request<VisitNote>('/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    });
  }

  async createNoteWithAudio(
    visitid: string,
    audioBlob: Blob,
    transcription?: string,
    audioDuration?: number
  ): Promise<VisitNoteResponse> {
    const formData = new FormData();
    formData.append('visitid', visitid);
    
    // Use proper file extension based on MIME type
    const getFileExtension = (mimeType: string): string => {
      if (mimeType.includes('webm')) return 'webm';
      if (mimeType.includes('mp4')) return 'm4a';
      if (mimeType.includes('ogg')) return 'ogg';
      return 'wav'; // fallback
    };
    
    const extension = getFileExtension(audioBlob.type);
    formData.append('audio', audioBlob, `recording.${extension}`);
    formData.append('audio_mimetype', audioBlob.type);
    
    if (transcription) {
      formData.append('transcription_text', transcription);
    }
    
    if (audioDuration) {
      formData.append('audio_duration_seconds', audioDuration.toString());
    }

    const response = await fetch(`${this.baseUrl}/notes`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async updateNote(
    noteid: string, 
    updates: Partial<Omit<VisitNote, 'noteid' | 'visitid' | 'created_at' | 'updated_at'>>
  ): Promise<VisitNote> {
    return this.request<VisitNote>(`/notes/${noteid}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Audio playback
  getAudioUrl(noteid: string): string {
    return `${this.baseUrl}/notes/${noteid}/audio`;
  }

  // Employee
  async getEmployee(empid: string): Promise<Omit<LoginResponse['employee'], 'created_at'>> {
    return this.request<Omit<LoginResponse['employee'], 'created_at'>>(`/employees/${empid}`);
  }
}

export const api = new ApiClient();