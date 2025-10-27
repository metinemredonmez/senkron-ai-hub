export interface Doctor365AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
}

export interface Doctor365Provider {
  id: string;
  name: string;
  specialty: string;
  location?: string;
  languageSupport?: string[];
  accreditation?: string;
  rating?: number;
}

export interface Doctor365Patient {
  id: string;
  externalId: string;
  status: 'active' | 'inactive' | 'archived' | string;
  updatedAt: string;
  lastSyncedAt?: string;
  allergies?: string[];
  bloodType?: string;
  labResults?: Record<string, any>;
}

export interface Doctor365Appointment {
  id: string;
  patientId: string;
  providerId: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'cancelled' | string;
  location?: string;
}

export interface Doctor365ListResponse<T> {
  data: T[];
  pagination?: {
    total: number;
    page: number;
    size: number;
  };
}
