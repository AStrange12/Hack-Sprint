
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-prediction-explanation-flow.ts';
import '@/ai/flows/predict-patient-deterioration-flow.ts';
import '@/ai/flows/ai-prediction-flow.ts';
