
'use server';
/**
 * @fileOverview This file implements a Genkit flow for pure AI-based patient deterioration prediction.
 * It uses LLM reasoning to assess risks based on vitals and clinical context.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const VitalsSchema = z.object({
  heartRate: z.number().min(0),
  systolicBp: z.number().min(0),
  diastolicBp: z.number().min(0),
  spo2: z.number().min(0).max(100),
  respiratoryRate: z.number().min(0),
  temperature: z.number().min(30).max(45),
});

const AIPredictionInputSchema = z.object({
  patientId: z.string(),
  vitals: VitalsSchema,
  clinicalNotes: z.string().optional(),
});
export type AIPredictionInput = z.infer<typeof AIPredictionInputSchema>;

const AIPredictionOutputSchema = z.object({
  icuTransferRisk: z.number().min(0).max(1),
  cardiacArrestRisk: z.number().min(0).max(1),
  mortalityRisk: z.number().min(0).max(1),
  riskLevel: z.enum(['Low', 'Medium', 'High']),
  explanation: z.string(),
  featureImportance: z.record(z.number()),
});
export type AIPredictionOutput = z.infer<typeof AIPredictionOutputSchema>;

const aiAssessmentPrompt = ai.definePrompt({
  name: 'aiAssessmentPrompt',
  input: { schema: AIPredictionInputSchema },
  output: { schema: AIPredictionOutputSchema },
  prompt: `You are an expert clinical AI assistant. Perform a comprehensive risk assessment for a patient.
Use clinical reasoning to determine probabilities for ICU Transfer, Cardiac Arrest, and Mortality.

Patient Data:
Vitals:
- HR: {{vitals.heartRate}} bpm
- BP: {{vitals.systolicBp}}/{{vitals.diastolicBp}} mmHg
- SpO2: {{vitals.spo2}}%
- RR: {{vitals.respiratoryRate}} breaths/min
- Temp: {{vitals.temperature}} °C

Clinical Notes:
{{#if clinicalNotes}}{{{clinicalNotes}}}{{else}}No recent notes.{{/if}}

Provide your assessment in the specified JSON format. Ensure featureImportance sums to 1.0 and reflects medically sound weighting (SpO2, HR, and RR are high impact).`,
});

export const predictAIAssessment = ai.defineFlow(
  {
    name: 'predictAIAssessment',
    inputSchema: AIPredictionInputSchema,
    outputSchema: AIPredictionOutputSchema,
  },
  async (input) => {
    const { output } = await aiAssessmentPrompt(input);
    if (!output) throw new Error('AI Assessment failed');
    return output;
  }
);
