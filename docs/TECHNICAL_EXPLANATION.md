# Multimodal Clinical Deterioration Prediction System - Technical Guide

## 🔍 1. PROBLEM STATEMENT
**The Challenge:** In high-pressure hospital environments, patient deterioration (cardiac arrest or the need for sudden ICU transfer) often goes unnoticed until it is too late. Standard monitoring systems frequently rely on simple threshold alarms that lead to "alarm fatigue."

**The Impact:** Early detection of clinical deterioration can reduce hospital mortality by up to 40%. Our system addresses this by providing a "pre-emptive" window of 24–48 hours using multimodal data analysis.

---

## 💡 2. SOLUTION OVERVIEW
HealthPredict AI is a comprehensive clinical decision support system. It integrates:
- **Multimodal Data**: Time-series vitals (Heart Rate, SpO2, etc.) combined with unstructured clinical notes.
- **Dual Prediction Engine**: A hybrid approach using a data-driven ML model (MIMIC dataset) and LLM-based clinical reasoning (Gemini).
- **Administrative Automation**: Bulk ingestion via Excel and OCR-based report scanning to reduce manual data entry errors.

---

## 🏗 3. SYSTEM ARCHITECTURE
- **Frontend**: Next.js 15 (App Router) with React 19 and Tailwind CSS.
- **UI Components**: ShadCN UI + Lucide Icons + Recharts for trend visualization.
- **Backend-as-a-Service**: Firebase (Authentication & Firestore).
- **AI Orchestration**: Genkit for managing Gemini 2.5 Flash prompts and flows.
- **Client-Side Processing**: Tesseract.js (OCR) and XLSX (Excel parsing) to ensure fast, local data handling.
- **ML Engine**: A weighted k-Nearest Neighbors (k-NN) algorithm implemented in TypeScript for high-speed inference without heavy server overhead.

---

## 🔄 4. COMPLETE DATA FLOW

### A. Doctor Workflow
1. **Authentication**: Secure login via Firebase Auth.
2. **Registration**: Add patient or select from roster.
3. **Observation**: Input latest vitals and clinical notes in the "Entry Sheet."
4. **Analysis**: Trigger "Model Prediction" or "AI Assessment."
5. **Persistence**: All readings and predictions are saved to Firestore sub-collections.

### B. Admin Workflow
1. **Bulk Import**: Upload `.csv` or `.xlsx`. The system maps columns (Name, Age, Vitals) and creates individual patient documents.
2. **OCR Parsing**: Upload a photo of a medical report. Tesseract.js extracts text; regex-based parsing identifies key fields (Name/Age) to pre-fill the manual form.

### C. Prediction Flow
- **Input**: Snapshot of current vitals.
- **Processing**: Features are normalized and compared against the **MIMIC dataset**.
- **Output**: Three distinct probability scores (0-1) for ICU, Arrest, and Mortality.

---

## 🧠 5. MACHINE LEARNING EXPLANATION
- **Dataset**: `mini_mimic_dataset.csv` (Derived from the MIT MIMIC-III database).
- **Algorithm**: **Weighted k-Nearest Neighbors (k=10)**.
- **Why k-NN?**: In clinical settings, "Explainability" is king. k-NN allows us to say: *"This patient looks like these 10 historical cases who had a high risk of arrest."*
- **Normalization**: Features are scaled by their typical physiological ranges (e.g., HR range 40-180) to ensure Euclidean distance is mathematically sound.

---

## 📊 6. EXPLAINABILITY & MEDICAL WEIGHTING
The system prioritizes features based on clinical sensitivity:
1. **SpO2 (35%)**: The most critical indicator of respiratory failure.
2. **Heart Rate (25%)**: Primary indicator of cardiac stress/sepsis.
3. **Respiratory Rate (20%)**: Often the first vital sign to change during deterioration.
4. **Blood Pressure (15%)**: Indicator of hemodynamics.
5. **Temperature (5%)**: Indicator of infection/systemic inflammatory response.

---

## 🔐 7. SECURITY & ACCESS CONTROL
- **Firebase Auth**: Industry-standard JWT-based authentication.
- **Role-Based Access Control (RBAC)**: Firestore profiles distinguish between `Admin` and `Doctor`.
- **Firestore Rules**: 
  - `Doctors` can only see patients they added.
  - `Admins` have system-wide data management privileges.
  - Sub-collections (vitals/predictions) inherit security from the parent patient document.

---

## 🚀 8. SCALABILITY & LIMITATIONS
- **Scalability**: Firebase handles concurrent users easily. The ML model is "lazy," meaning it only computes when needed, saving cloud costs.
- **Limitations**: 
  - The dataset is a "mini" version for prototype speed.
  - OCR requires high-contrast images for best results.
  - Predictions are advisory and must be verified by a licensed professional.

---

## 🔮 9. FUTURE IMPROVEMENTS
- **IoT Integration**: Real-time streaming from bedside monitors.
- **Advanced Models**: Upgrading from k-NN to LSTM (Long Short-Term Memory) networks to analyze the *rate of change* rather than just snapshots.
- **FHIR Integration**: Standardizing data to work with existing Hospital Information Systems (HIS).

---

## 🎤 BONUS: VIVA / JUDGE QUESTIONS & ANSWERS

**Q1: Why did you use k-NN instead of a complex Deep Learning model?**
*A: For clinical applications, transparency is vital. k-NN provides "case-based reasoning" which is how doctors think—comparing the current patient to similar historical cases. It also runs efficiently on the client side, reducing server costs.*

**Q2: How do you handle missing vitals during an Excel upload?**
*A: The system uses "Safe Fallbacks." If a vital is missing, the ML model assumes a normal physiological baseline for that feature so it doesn't skew the distance calculation toward an extreme risk.*

**Q3: How is the "AI Assessment" different from the "Model Prediction"?**
*A: The Model Prediction is purely quantitative (based on hard numbers in the dataset). The AI Assessment is qualitative; it uses LLM reasoning to interpret clinical notes and "nuance" that numbers might miss, like a patient's complaint of chest pain.*

**Q4: Is this system HIPAA compliant?**
*A: We have implemented key HIPAA patterns: Encryption in transit (SSL/TLS), Role-Based Access Control, and Audit Logging through Firebase. In a production environment, we would use Firebase's HIPAA-compliant BAA (Business Associate Agreement).*

**Q5: What happens if the SpO2 drops to 85%?**
*A: Due to our medical weighting logic, SpO2 has a 35% weight. A drop to 85% would significantly increase the distance from "healthy" neighbors, likely triggering a "High Risk" level and an immediate alert on the dashboard.*