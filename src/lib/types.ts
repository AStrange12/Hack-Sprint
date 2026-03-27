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
  recordedAt: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  spo2: number;
  respiratoryRate: number;
  temperature: number;
  patientId: string;
  addedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PredictionResult {
  id: string;
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
  patientId: string;
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
  addedByUserId: string;
  source: 'manual' | 'excel' | 'ocr';
  createdAt: string;
  updatedAt: string;
}
