"use client";

import { use, useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Patient, PredictionResult, VitalReading } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Activity, Thermometer, Droplets, Heart, Wind, Clock, Wand2, ArrowLeft, Loader2, User, Info, AlertCircle } from 'lucide-react';
import { predictPatientDeterioration } from '@/ai/flows/predict-patient-deterioration-flow';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { doc, collection, addDoc, query, orderBy, setDoc } from 'firebase/firestore';

function calculateAge(dobString: string) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  const today = new Date();
  if (isNaN(dob.getTime())) return null;
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isPredicting, setIsPredicting] = useState(false);

  // Firestore Queries
  const patientDocRef = useMemoFirebase(() => doc(db, 'patients', id), [db, id]);
  const vitalsQuery = useMemoFirebase(() => query(collection(db, 'patients', id, 'vitalsRecords'), orderBy('recordedAt', 'desc')), [db, id]);
  const predictionsQuery = useMemoFirebase(() => query(collection(db, 'patients', id, 'predictions'), orderBy('predictedAt', 'desc')), [db, id]);

  const { data: patient, isLoading: isPatientLoading } = useDoc<Patient>(patientDocRef);
  const { data: vitalsData, isLoading: isVitalsLoading } = useCollection<VitalReading>(vitalsQuery);
  const { data: predictionsData, isLoading: isPredictionsLoading } = useCollection<PredictionResult>(predictionsQuery);

  // Ensure data is always at least an empty array for rendering logic
  const vitals = vitalsData || [];
  const predictions = predictionsData || [];

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
    if (patient) {
      setNotes(patient.clinicalNotes || '');
    }
  }, [patient]);

  const handleAddVitals = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'patients', id, 'vitalsRecords'), {
        patientId: id,
        recordedAt: new Date().toISOString(),
        heartRate: parseInt(hr),
        bloodPressureSystolic: parseInt(sbp),
        bloodPressureDiastolic: parseInt(dbp),
        spo2: parseInt(spo2),
        respiratoryRate: parseInt(rr),
        temperature: parseFloat(temp),
        addedByUserId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      await setDoc(doc(db, 'patients', id), { 
        clinicalNotes: notes,
        updatedAt: new Date().toISOString() 
      }, { merge: true });

      toast({ title: "Vitals Recorded", description: "Patient readings have been logged." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    }
  };

  const handlePredict = async () => {
    if (!patient || !user) return;
    
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

      await addDoc(collection(db, 'patients', id, 'predictions'), {
        patientId: id,
        predictedAt: new Date().toISOString(),
        icuTransferRiskScore: result.icuTransferRisk,
        cardiacArrestRiskScore: result.cardiacArrestRisk,
        mortalityRiskScore: result.mortalityRisk,
        icuTransferRiskLevel: result.riskLevel, 
        cardiacArrestRiskLevel: result.riskLevel,
        mortalityRiskLevel: result.riskLevel,
        riskLevel: result.riskLevel,
        explanation: result.explanation,
        featureImportance: JSON.stringify(result.featureImportance),
        triggeredByUserId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      toast({ title: "Prediction Complete", description: "New risk assessment generated." });
    } catch (error: any) {
      toast({ title: "Prediction Failed", variant: "destructive", description: error.message });
    } finally {
      setIsPredicting(false);
    }
  };

  if (isUserLoading || isPatientLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) return <div className="p-10 text-center">Patient record not found.</div>;

  const latestPrediction = (predictions?.length || 0) > 0 ? predictions[0] : null;
  const age = patient.age || calculateAge(patient.dateOfBirth);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft size={16} className="mr-1" />
          Back to Dashboard
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Patient Profile & Status */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-primary text-white">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <User size={24} />
                  </div>
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-none">
                    {patient.gender}
                  </Badge>
                </div>
                <CardTitle className="text-2xl mt-4">{patient.firstName} {patient.lastName}</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                   ID: <span className="font-code">{patient.patientIdCode}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-[10px] uppercase text-muted-foreground">Age</Label>
                    <div className="font-semibold">{age || 'N/A'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-[10px] uppercase text-muted-foreground">Risk</Label>
                    <div className="font-semibold text-accent">{latestPrediction?.riskLevel || 'TBD'}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Info size={14}/> Risk Factors</Label>
                  <div className="flex flex-wrap gap-2">
                    {patient.preExistingConditions ? patient.preExistingConditions.split(',').map(c => (
                      <Badge key={c} variant="secondary" className="text-[10px]">{c.trim()}</Badge>
                    )) : <span className="text-xs text-muted-foreground">No conditions listed</span>}
                    <Badge variant="outline" className="text-[10px]">Smoking: {patient.smokingStatus}</Badge>
                  </div>
                </div>
                
                {latestPrediction && (
                  <div className="space-y-4 pt-4 border-t">
                    <RiskScore label="ICU Transfer" value={latestPrediction.icuTransferRiskScore || 0} />
                    <RiskScore label="Cardiac Arrest" value={latestPrediction.cardiacArrestRiskScore || 0} />
                    <RiskScore label="Mortality" value={latestPrediction.mortalityRiskScore || 0} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-accent/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wand2 size={20} className="text-accent" />
                  Prediction Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate a multimodal assessment using current vitals and clinical context.
                </p>
                <Button 
                  className="w-full h-12 text-lg font-semibold bg-accent hover:bg-accent/90" 
                  onClick={handlePredict}
                  disabled={isPredicting}
                >
                  {isPredicting ? 'Analyzing...' : 'Trigger AI Prediction'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Vitals Entry & History */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="vitals" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="vitals">Vitals Input</TabsTrigger>
                <TabsTrigger value="history">Trends</TabsTrigger>
                <TabsTrigger value="ai-explanation">AI Analysis</TabsTrigger>
              </TabsList>

              <TabsContent value="vitals">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Entry Sheet</CardTitle>
                    <CardDescription>Record latest physiological measurements and observations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <VitalInput label="HR (bpm)" icon={<Heart size={16} />} value={hr} onChange={setHr} />
                      <VitalInput label="SBP (mmHg)" icon={<Droplets size={16} />} value={sbp} onChange={setSbp} />
                      <VitalInput label="DBP (mmHg)" icon={<Droplets size={16} />} value={dbp} onChange={setDbp} />
                      <VitalInput label="SpO2 (%)" icon={<Wind size={16} />} value={spo2} onChange={setSpo2} />
                      <VitalInput label="RR (rpm)" icon={<Activity size={16} />} value={rr} onChange={setRr} />
                      <VitalInput label="Temp (°C)" icon={<Thermometer size={16} />} value={temp} onChange={setTemp} />
                    </div>
                    <div className="space-y-2">
                      <Label>Clinical Notes & Observations</Label>
                      <Textarea 
                        placeholder="Detail symptoms, complaints, or response to treatment..." 
                        className="min-h-[150px] bg-muted/20"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddVitals} variant="secondary" className="w-full h-11">
                      Save Records & Update Profile
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <div className="space-y-6">
                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle>Vitals Trend Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      {isVitalsLoading ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading vitals trends...
                        </div>
                      ) : (vitals?.length || 0) > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[...(vitals || [])].reverse()}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="recordedAt" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="heartRate" stroke="hsl(var(--primary))" name="HR" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="spo2" stroke="hsl(var(--accent))" name="SpO2" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          Insufficient data for trending.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle>Clinical Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {isVitalsLoading && <div className="text-center py-4 text-muted-foreground">Loading clinical logs...</div>}
                        {!isVitalsLoading && (vitals?.length || 0) === 0 && <div className="text-center py-4 text-muted-foreground">No records logged yet.</div>}
                        {(vitals || []).map((v, i) => (
                          <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-colors text-xs">
                            <div className="flex items-center gap-3">
                              <Clock size={14} className="text-muted-foreground" />
                              <span className="font-medium">{new Date(v.recordedAt).toLocaleString()}</span>
                            </div>
                            <div className="flex gap-4 font-code text-primary">
                              <span>HR:{v.heartRate}</span>
                              <span>BP:{v.bloodPressureSystolic}/{v.bloodPressureDiastolic}</span>
                              <span>SpO2:{v.spo2}%</span>
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
                    <CardTitle>AI Clinical Rationale</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isPredictionsLoading ? (
                      <div className="py-20 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading AI insights...
                      </div>
                    ) : latestPrediction ? (
                      <>
                        <div className="p-4 rounded-xl bg-accent/5 border border-accent/10 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {latestPrediction.explanation}
                        </div>
                        <div className="space-y-4">
                          <h4 className="font-semibold text-primary text-sm">Model Attention Weights</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {latestPrediction.featureImportance && Object.entries(JSON.parse(latestPrediction.featureImportance as string || '{}')).map(([key, val]) => (
                              <div key={key} className="space-y-1">
                                <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                                  <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                                  <span>{Math.round((val as number) * 100)}%</span>
                                </div>
                                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-accent" style={{ width: `${(val as number) * 100}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-3xl">
                        <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                        Run a prediction to generate AI insights.
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
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} transition-all duration-700`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function VitalInput({ label, icon, value, onChange }: { label: string, icon: React.ReactNode, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="font-semibold h-10 border-none shadow-sm" />
    </div>
  );
}
