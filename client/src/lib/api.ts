// API client for NotesMate backend
import type { InsertPatient } from "@shared/schema";
import { getDeviceInfo } from './deviceInfo';

export interface LoginCredentials {
  org_code?: string;
  username: string;
  password: string;
}

export interface LoginResponse {
  employee: {
    empid: string;
    orgid: string | null;
    username: string;
    first_name: string;
    last_name: string;
    title: string | null;
    role: string | null;
    secondary_role?: string | null;
    is_active: boolean | null;
    created_at: Date;
  };
  organization: {
    orgid: string;
    org_number: number | null;
    org_shortname: string | null;
    org_name: string;
    org_type: string | null;
    address: string | null;
    phone: string | null;
    created_at: Date;
  } | null;
  accessToken: string;
  activeRole?: string;
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
  // Device/Browser tracking fields
  session_id?: string | null;
  device_type?: string | null;
  browser_name?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface VisitNoteResponse extends VisitNote {
  ai_transcribed?: boolean;
}

const ACCESS_TOKEN_KEY = 'notesmate_access_token';

class ApiClient {
  private baseUrl = '/api';

  getAccessToken(): string | null {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  }

  clearAccessToken(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getAccessToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Authentication
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    // Store the access token
    if (response.accessToken) {
      this.setAccessToken(response.accessToken);
    }
    
    return response;
  }

  // Switch organization (for super admin impersonation)
  async switchOrg(orgNumber: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/switch-org', {
      method: 'POST',
      body: JSON.stringify({ org_number: orgNumber }),
    });
    
    // Update the access token
    if (response.accessToken) {
      this.setAccessToken(response.accessToken);
    }
    
    return response;
  }

  // Clear impersonation (return to super admin home view)
  async clearImpersonation(): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/clear-impersonation', {
      method: 'POST',
    });
    
    // Update the access token
    if (response.accessToken) {
      this.setAccessToken(response.accessToken);
    }
    
    return response;
  }

  // Switch role for dual-role users (org_admin/doctor)
  async switchRole(targetRole: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ target_role: targetRole }),
    });
    
    // Update the access token
    if (response.accessToken) {
      this.setAccessToken(response.accessToken);
    }
    
    return response;
  }

  // Set token externally (for logout)
  setToken(token: string | null): void {
    if (token) {
      this.setAccessToken(token);
    } else {
      this.clearAccessToken();
    }
  }

  // Organizations (super admin only)
  async getOrganizations(): Promise<{
    orgid: string;
    org_number: number | null;
    org_shortname: string | null;
    org_name: string;
    org_type: string | null;
    is_active: boolean | null;
  }[]> {
    return this.request('/organizations');
  }

  async getNextOrgNumber(): Promise<{ nextOrgNumber: number }> {
    return this.request('/organizations-next-number');
  }

  async createOrganization(data: {
    org_shortname: string;
    org_name: string;
    org_type?: string;
    address?: string;
    phone?: string;
    admin_username?: string;
    admin_password?: string;
    admin_first_name?: string;
    admin_last_name?: string;
    admin_has_clinical_access?: boolean;
  }): Promise<{ organization: any; admin: any | null }> {
    return this.request('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrganization(orgid: string, updates: {
    org_name?: string;
    org_type?: string;
    address?: string;
    phone?: string;
    is_active?: boolean;
  }): Promise<any> {
    return this.request(`/organizations/${orgid}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getPlatformStats(): Promise<{
    totalPatients: number;
    totalEmployees: number;
    totalVisits: number;
    activeOrgs: number;
    inactiveOrgs: number;
  }> {
    return this.request('/platform-stats');
  }

  // Patients
  async getPatients(orgid: string, search?: string): Promise<Patient[]> {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    return this.request<Patient[]>(`/patients?orgid=${orgid}${searchParam}`);
  }

  async getPatient(patientid: string): Promise<Patient> {
    return this.request<Patient>(`/patients/${patientid}`);
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
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

  async deletePatient(patientid: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/patients/${patientid}`, {
      method: 'DELETE',
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
    const deviceInfo = getDeviceInfo();
    return this.request<VisitNote>('/notes', {
      method: 'POST',
      body: JSON.stringify({
        ...note,
        session_id: deviceInfo.sessionId,
        device_type: deviceInfo.deviceType,
        browser_name: deviceInfo.browserName,
        user_agent: deviceInfo.userAgent,
      }),
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

    // Add device/browser tracking info
    const deviceInfo = getDeviceInfo();
    formData.append('session_id', deviceInfo.sessionId);
    formData.append('device_type', deviceInfo.deviceType);
    formData.append('browser_name', deviceInfo.browserName);
    formData.append('user_agent', deviceInfo.userAgent);

    const token = this.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/notes`, {
      method: 'POST',
      headers,
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

  // Transcription-only (doesn't save to database)
  async transcribeAudio(audioBlob: Blob): Promise<{ text: string; confidence: number; duration?: number }> {
    const formData = new FormData();
    
    // Use proper file extension based on MIME type
    const getFileExtension = (mimeType: string): string => {
      if (mimeType.includes('webm')) return 'webm';
      if (mimeType.includes('mp4')) return 'm4a';
      if (mimeType.includes('ogg')) return 'ogg';
      return 'wav';
    };
    
    const extension = getFileExtension(audioBlob.type);
    formData.append('audio', audioBlob, `recording.${extension}`);

    const token = this.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Transcription failed: ${response.status}`);
    }

    return response.json();
  }

  // Employee
  async getEmployee(empid: string): Promise<Omit<LoginResponse['employee'], 'created_at'>> {
    return this.request<Omit<LoginResponse['employee'], 'created_at'>>(`/employees/${empid}`);
  }
}

export const api = new ApiClient();