
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'Doctor' | 'Admin' | 'MedicalStaff';
  hospitalName?: string;
  specialization?: string;
  experienceYears?: number;
  contactNumber?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VitalReading {
  id: string;
  timestamp: string;
  hr: number;
  bpSystolic: number;
  bpDiastolic: number;
  spo2: number;
  rr: number;
  temp: number;
}

export interface PredictionResult {
  id: string;
  timestamp: string;
  icuTransferRiskScore: number;
  cardiacArrestRiskScore: number;
  mortalityRiskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  explanation: string;
  featureImportance: string; // JSON string
  predictionMethod: 'ai' | 'model';
  triggeredByUserId: string;
  predictedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  patientIdCode: string;
  firstName: string;
  lastName: string;
  name?: string; // Derived field for convenience
  age: number;
  gender: string;
  dateOfBirth: string;
  admissionDate: string;
  preExistingConditions: string;
  smokingStatus: string;
  clinicalNotes: string;
  vitals: VitalReading[];
  predictions: PredictionResult[];
  addedByUserId: string;
  createdAt: string;
  updatedAt: string;
}
