
"use client";

import { use, useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { getPatientById, addVitalsToPatient, updateClinicalNotes, addPredictionToPatient } from '@/lib/db-mock';
import { Patient, PredictionResult } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Activity, Thermometer, Droplets, Heart, Wind, Clock, AlertTriangle, CheckCircle2, Wand2, ArrowLeft, Loader2 } from 'lucide-react';
import { predictPatientDeterioration } from '@/ai/flows/predict-patient-deterioration-flow';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';

export default function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const { toast } = useToast();

  // Vitals Input State
  const [hr, setHr] = useState('80');
  const [sbp, setSbp] = useState('120');
  const [dbp, setDbp] = useState('80');
  const [spo2, setSpo2] = useState('98');
  const [rr, setRr] = useState('16');
  const [temp, setTemp] = useState('37');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    loadPatient();
  }, [id]);

  const loadPatient = async () => {
    const data = await getPatientById(id);
    if (data) {
      setPatient(data);
      setNotes(data.clinicalNotes);
    }
  };

  const handleAddVitals = async () => {
    await addVitalsToPatient(id, {
      timestamp: new Date().toISOString(),
      hr: parseInt(hr),
      bpSystolic: parseInt(sbp),
      bpDiastolic: parseInt(dbp),
      spo2: parseInt(spo2),
      rr: parseInt(rr),
      temp: parseFloat(temp),
    });
    await updateClinicalNotes(id, notes);
    toast({ title: "Vitals Updated", description: "Patient readings have been recorded successfully." });
    loadPatient();
  };

  const handlePredict = async () => {
    if (!patient) return;
    
    setIsPredicting(true);
    try {
      const result = await predictPatientDeterioration({
        patientId: patient.id,
        vitals: {
          heartRate: parseInt(hr),
          systolicBp: parseInt(sbp),
          diastolicBp: parseInt(dbp),
          spo2: parseInt(spo2),
          respiratoryRate: parseInt(rr),
          temperature: parseFloat(temp),
        },
        clinicalNotes: notes
      });

      const prediction: PredictionResult = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        icuTransferRisk: result.icuTransferRisk,
        cardiacArrestRisk: result.cardiacArrestRisk,
        mortalityRisk: result.mortalityRisk,
        riskLevel: result.riskLevel,
        explanation: result.explanation,
        featureImportance: result.featureImportance
      };

      await addPredictionToPatient(id, prediction);
      toast({ title: "Prediction Complete", description: "New risk assessment is available." });
      loadPatient();
    } catch (error) {
      toast({ title: "Prediction Failed", variant: "destructive", description: "An error occurred during risk assessment." });
    } finally {
      setIsPredicting(false);
    }
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) return <div className="p-10 text-center">Loading patient data...</div>;

  const latestPrediction = patient.predictions[0];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft size={16} className="mr-1" />
          Back to Dashboard
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Patient Profile & Risk Status */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-primary text-white">
                <CardTitle className="text-2xl">{patient.name}</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  {patient.age} years • {patient.gender} • ID: <span className="font-code">{patient.id}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div className="text-sm font-medium">Risk Level</div>
                    <Badge className="px-3 py-1" variant={
                      latestPrediction?.riskLevel === 'High' ? 'destructive' : 
                      latestPrediction?.riskLevel === 'Medium' ? 'secondary' : 'outline'
                    }>
                      {latestPrediction?.riskLevel || 'Unknown'}
                    </Badge>
                  </div>
                  
                  {latestPrediction && (
                    <div className="space-y-4">
                      <RiskScore label="ICU Transfer Risk" value={latestPrediction.icuTransferRisk} />
                      <RiskScore label="Cardiac Arrest Risk" value={latestPrediction.cardiacArrestRisk} />
                      <RiskScore label="Mortality Risk" value={latestPrediction.mortalityRisk} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wand2 size={20} className="text-accent" />
                  AI Prediction Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Trigger a new assessment based on current vitals and clinical notes.
                </p>
                <Button 
                  className="w-full h-12 text-lg font-semibold bg-accent hover:bg-accent/90" 
                  onClick={handlePredict}
                  disabled={isPredicting}
                >
                  {isPredicting ? 'Analyzing...' : 'Trigger Prediction'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Vitals Entry & History */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="vitals" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="vitals">Current Vitals</TabsTrigger>
                <TabsTrigger value="history">Patient History</TabsTrigger>
                <TabsTrigger value="ai-explanation">AI Insights</TabsTrigger>
              </TabsList>

              <TabsContent value="vitals">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Vital Signs Input</CardTitle>
                    <CardDescription>Enter latest physiological readings and clinical observations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <VitalInput label="Heart Rate (bpm)" icon={<Heart size={16} />} value={hr} onChange={setHr} />
                      <VitalInput label="Systolic BP (mmHg)" icon={<Activity size={16} />} value={sbp} onChange={setSbp} />
                      <VitalInput label="Diastolic BP (mmHg)" icon={<Droplets size={16} />} value={dbp} onChange={setDbp} />
                      <VitalInput label="SpO2 (%)" icon={<Wind size={16} />} value={spo2} onChange={setSpo2} />
                      <VitalInput label="Respiration (rpm)" icon={<Activity size={16} />} value={rr} onChange={setRr} />
                      <VitalInput label="Temperature (°C)" icon={<Thermometer size={16} />} value={temp} onChange={setTemp} />
                    </div>
                    <div className="space-y-2">
                      <Label>Clinical Notes</Label>
                      <Textarea 
                        placeholder="Add specific observations, patient complaints, or symptoms (e.g., 'Reports mild chest pain', 'Signs of sepsis')..." 
                        className="min-h-[120px]"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddVitals} variant="secondary" className="w-full">Save & Update Records</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <div className="space-y-6">
                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle>Vitals Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={patient.vitals}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="hr" stroke="hsl(var(--primary))" name="Heart Rate" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="spo2" stroke="hsl(var(--accent))" name="SpO2" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle>Observation Logs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {patient.vitals.slice().reverse().map((v, i) => (
                          <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 text-sm">
                            <div className="flex items-center gap-3">
                              <Clock size={14} className="text-muted-foreground" />
                              <span className="font-medium">{new Date(v.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="flex gap-4 text-muted-foreground">
                              <span>HR: {v.hr}</span>
                              <span>BP: {v.bpSystolic}/{v.bpDiastolic}</span>
                              <span>SpO2: {v.spo2}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="ai-explanation">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Model Interpretability</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {latestPrediction ? (
                      <>
                        <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {latestPrediction.explanation}
                        </div>
                        <div className="space-y-4">
                          <h4 className="font-semibold text-primary">Feature Importance Breakdown</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(latestPrediction.featureImportance).map(([key, val]) => (
                              <div key={key} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                  <span>{Math.round(val * 100)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-accent" style={{ width: `${val * 100}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        No prediction data available for analysis.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskScore({ label, value }: { label: string, value: number }) {
  const percentage = Math.round(value * 100);
  let colorClass = 'bg-emerald-500';
  if (value > 0.7) colorClass = 'bg-destructive';
  else if (value > 0.4) colorClass = 'bg-amber-500';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function VitalInput({ label, icon, value, onChange }: { label: string, icon: React.ReactNode, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="font-semibold" />
    </div>
  );
}
