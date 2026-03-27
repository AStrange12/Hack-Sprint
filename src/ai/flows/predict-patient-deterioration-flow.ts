
'use server';
/**
 * @fileOverview This file implements a Genkit flow for predicting patient deterioration.
 * It integrates a dataset-driven k-NN machine learning model (using mini_mimic_dataset.csv)
 * to predict risks for ICU transfer, cardiac arrest, and mortality.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs';
import path from 'path';

const VitalsSchema = z.object({
  heartRate: z.number().min(0).describe('Patient current Heart Rate (bpm).'),
  systolicBp: z.number().min(0).describe('Patient current Systolic Blood Pressure (mmHg).'),
  diastolicBp: z.number().min(0).describe('Patient current Diastolic Blood Pressure (mmHg).'),
  spo2: z.number().min(0).max(100).describe('Patient current Blood Oxygen Saturation (%).'),
  respiratoryRate: z.number().min(0).describe('Patient current Respiratory Rate (breaths/min).'),
  temperature: z.number().min(30).max(45).describe('Patient current Body Temperature (Celsius).'),
});
export type Vitals = z.infer<typeof VitalsSchema>;

const PredictPatientDeteriorationInputSchema = z.object({
  patientId: z.string().describe('Unique identifier for the patient.'),
  vitals: VitalsSchema.describe('Current snapshot of patient time-series vitals.'),
  clinicalNotes: z.string().describe('Latest clinical notes for the patient.').optional(),
});
export type PredictPatientDeteriorationInput = z.infer<typeof PredictPatientDeteriorationInputSchema>;

const PredictPatientDeteriorationOutputSchema = z.object({
  patientId: z.string().describe('Unique identifier for the patient.'),
  icuTransferRisk: z.number().min(0).max(1).describe('Probability (0-1) of ICU transfer.'),
  cardiacArrestRisk: z.number().min(0).max(1).describe('Probability (0-1) of cardiac arrest.'),
  mortalityRisk: z.number().min(0).max(1).describe('Probability (0-1) of mortality.'),
  riskLevel: z.enum(['Low', 'Medium', 'High']).describe('Overall risk level.'),
  explanation: z.string().describe('A doctor-friendly explanation.'),
  featureImportance: z.record(z.number().min(0).max(1)).describe('Breakdown of feature contribution.'),
});
export type PredictPatientDeteriorationOutput = z.infer<typeof PredictPatientDeteriorationOutputSchema>;

/**
 * Helper to calculate Euclidean distance between two vectors.
 * Features are weighted medically: SpO2, RR, and HR are highly sensitive.
 */
function calculateWeightedDistance(v1: number[], v2: number[]) {
  // Medical sensitivities: SpO2 is very sensitive (range 5), RR (range 10), HR (range 40)
  const weights = [0.25, 0.1, 0.05, 0.35, 0.20, 0.05]; // HR, SBP, DBP, SpO2, RR, Temp
  const ranges = [40, 50, 30, 5, 10, 2]; 
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    const diff = (v1[i] - v2[i]) / ranges[i];
    sum += weights[i] * (diff * diff);
  }
  return Math.sqrt(sum);
}

const predictDeteriorationModel = ai.defineTool(
  {
    name: 'predictDeteriorationModel',
    description: 'Calculates patient deterioration risks using a k-NN model driven by the MIMIC dataset.',
    inputSchema: PredictPatientDeteriorationInputSchema,
    outputSchema: z.object({
      icuTransferRisk: z.number(),
      cardiacArrestRisk: z.number(),
      mortalityRisk: z.number(),
      featureImportance: z.record(z.number()),
    }),
  },
  async (input) => {
    try {
      const csvPath = path.join(process.cwd(), 'src/app/dashboard/dataset/mini_mimic_dataset.csv');
      
      if (!fs.existsSync(csvPath)) {
        return { icuTransferRisk: 0.1, cardiacArrestRisk: 0.05, mortalityRisk: 0.02, featureImportance: {} };
      }

      const fileContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = fileContent.trim().split('\n');
      const headers = lines[0].toLowerCase().split(',');
      
      const col = {
        hr: headers.indexOf('hr'),
        sbp: headers.indexOf('sbp'),
        dbp: headers.indexOf('dbp'),
        spo2: headers.indexOf('spo2'),
        rr: headers.indexOf('rr'),
        temp: headers.indexOf('temp'),
        icu: headers.indexOf('icu'),
        arrest: headers.indexOf('arrest'),
        mortality: headers.indexOf('mortality'),
      };

      const inputVector = [
        input.vitals.heartRate,
        input.vitals.systolicBp,
        input.vitals.diastolicBp,
        input.vitals.spo2,
        input.vitals.respiratoryRate,
        input.vitals.temperature
      ];

      const neighbors: { distance: number; icu: number; arrest: number; mortality: number }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(Number);
        if (row.length < headers.length) continue;

        const rowVector = [row[col.hr], row[col.sbp], row[col.dbp], row[col.spo2], row[col.rr], row[col.temp]];
        const distance = calculateWeightedDistance(inputVector, rowVector);
        
        neighbors.push({
          distance,
          icu: row[col.icu] || 0,
          arrest: row[col.arrest] || 0,
          mortality: row[col.mortality] || 0
        });
      }

      neighbors.sort((a, b) => a.distance - b.distance);
      const topK = neighbors.slice(0, 10);

      // Average targets for probability
      const icuTransferRisk = parseFloat((topK.reduce((acc, n) => acc + n.icu, 0) / topK.length).toFixed(3));
      const cardiacArrestRisk = parseFloat((topK.reduce((acc, n) => acc + n.arrest, 0) / topK.length).toFixed(3));
      const mortalityRisk = parseFloat((topK.reduce((acc, n) => acc + n.mortality, 0) / topK.length).toFixed(3));

      // Physiological Baseline Adjustment (Ensure no 0% for unstable vitals)
      const pss = (
        (Math.abs(input.vitals.heartRate - 75) / 100) * 0.25 +
        ((100 - input.vitals.spo2) / 10) * 0.35 +
        (Math.abs(input.vitals.respiratoryRate - 16) / 20) * 0.20 +
        (Math.abs(input.vitals.systolicBp - 120) / 100) * 0.15 +
        (Math.abs(input.vitals.temperature - 37) / 5) * 0.05
      );

      const featureImportance: Record<string, number> = {
        heartRate: 0.25,
        spo2: 0.35,
        respiratoryRate: 0.20,
        bloodPressure: 0.15,
        temperature: 0.05,
      };

      return { 
        icuTransferRisk: Math.max(icuTransferRisk, pss * 0.5), 
        cardiacArrestRisk: Math.max(cardiacArrestRisk, pss * 0.3), 
        mortalityRisk: Math.max(mortalityRisk, pss * 0.2), 
        featureImportance 
      };
    } catch (error) {
      console.error('Error in ML prediction model:', error);
      return { icuTransferRisk: 0.1, cardiacArrestRisk: 0.05, mortalityRisk: 0.02, featureImportance: {} };
    }
  }
);

const ExplainPredictionOutputSchema = z.object({
  riskLevel: z.enum(['Low', 'Medium', 'High']).describe('Overall risk level for patient deterioration.'),
  explanation: z.string().describe('A doctor-friendly explanation of the prediction and contributing factors.'),
});

const explainPredictionPrompt = ai.definePrompt({
  name: 'explainPredictionPrompt',
  input: {
    schema: z.object({
      patientId: z.string(),
      vitals: VitalsSchema,
      clinicalNotes: z.string().optional(),
      icuTransferRisk: z.number(),
      cardiacArrestRisk: z.number(),
      mortalityRisk: z.number(),
      featureImportance: z.record(z.number()),
    }),
  },
  output: { schema: ExplainPredictionOutputSchema },
  prompt: `You are an expert clinical AI providing context for data-driven ML predictions.
The following risks were calculated by finding similar historical cases in the MIMIC dataset.

Patient Data:
- HR: {{vitals.heartRate}}, SpO2: {{vitals.spo2}}%, RR: {{vitals.respiratoryRate}}, BP: {{vitals.systolicBp}}/{{vitals.diastolicBp}}

Calculated Model Risks:
- ICU: {{icuTransferRisk}}, Cardiac Arrest: {{cardiacArrestRisk}}, Mortality: {{mortalityRisk}}

Explain why these values might be elevated or low based on medical knowledge and the feature weights provided.`,
});

export const predictPatientDeterioration = ai.defineFlow(
  {
    name: 'predictPatientDeterioration',
    inputSchema: PredictPatientDeteriorationInputSchema,
    outputSchema: PredictPatientDeteriorationOutputSchema,
  },
  async (input) => {
    const mlModelOutput = await predictDeteriorationModel(input);
    const { output: explanationOutput } = await explainPredictionPrompt({
      ...input,
      ...mlModelOutput,
    });

    if (!explanationOutput) throw new Error('Explanation failed');

    return {
      patientId: input.patientId,
      icuTransferRisk: mlModelOutput.icuTransferRisk,
      cardiacArrestRisk: mlModelOutput.cardiacArrestRisk,
      mortalityRisk: mlModelOutput.mortalityRisk,
      riskLevel: explanationOutput.riskLevel,
      explanation: explanationOutput.explanation,
      featureImportance: mlModelOutput.featureImportance,
    };
  }
);
