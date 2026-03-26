
"use client";

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, User, Calendar, Activity, ChevronRight, Search as SearchIcon, Loader2, Heart, Wind, Thermometer, Droplets, Stethoscope } from 'lucide-react';
import { Patient } from '@/lib/types';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function DoctorDashboard() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Comprehensive Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [patientIdCode, setPatientIdCode] = useState('');
  
  // Initial Vitals
  const [hr, setHr] = useState('75');
  const [sbp, setSbp] = useState('120');
  const [dbp, setDbp] = useState('80');
  const [spo2, setSpo2] = useState('98');
  const [rr, setRr] = useState('16');
  const [temp, setTemp] = useState('37');
  
  // Risk Factors
  const [conditions, setConditions] = useState('');
  const [smoking, setSmoking] = useState('Never');

  const patientsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(db, 'patients'), where('addedByUserId', '==', user.uid));
  }, [db, user]);

  const { data: patients = [], isLoading: isPatientsLoading } = useCollection<Patient>(patientsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !dob || !user) return;

    setIsRegistering(true);
    try {
      // 1. Create Patient Document
      const patientRef = doc(collection(db, 'patients'));
      const patientData = {
        id: patientRef.id,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        dateOfBirth: dob,
        gender,
        patientIdCode: patientIdCode || `P-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        admissionDate: new Date().toISOString(),
        preExistingConditions: conditions,
        smokingStatus: smoking,
        addedByUserId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await setDoc(patientRef, patientData);

      // 2. Add Initial Vitals Record
      const vitalsRef = collection(db, 'patients', patientRef.id, 'vitalsRecords');
      await addDoc(vitalsRef, {
        patientId: patientRef.id,
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

      toast({ title: "Patient Registered", description: "The patient record has been successfully created." });
      setIsAddPatientOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsRegistering(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setDob('');
    setGender('Male');
    setPatientIdCode('');
    setConditions('');
    setSmoking('Never');
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredPatients = (patients || []).filter(p => 
    (p.firstName + ' ' + p.lastName).toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.patientIdCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary font-headline">Clinical Dashboard</h1>
            <p className="text-muted-foreground">Managing {patients?.length || 0} active patient records</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search patient ID or name..." 
                className="pl-10 w-[300px] border-none shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2 h-11 px-6 shadow-md bg-accent hover:bg-accent/90">
                  <Plus size={18} />
                  Add New Patient
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-primary">Comprehensive Patient Registration</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPatient} className="space-y-6 pt-4">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="basic">Basic Info</TabsTrigger>
                      <TabsTrigger value="vitals">Initial Vitals</TabsTrigger>
                      <TabsTrigger value="clinical">Clinical History</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" required />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" required />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Date of Birth</Label>
                          <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Gender</Label>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Patient ID Code (Optional)</Label>
                        <Input value={patientIdCode} onChange={(e) => setPatientIdCode(e.target.value)} placeholder="e.g. HOSP-12345" />
                      </div>
                    </TabsContent>

                    <TabsContent value="vitals" className="space-y-4 pt-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1"><Heart size={14}/> HR</Label>
                          <Input type="number" value={hr} onChange={(e) => setHr(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1"><Droplets size={14}/> SBP</Label>
                          <Input type="number" value={sbp} onChange={(e) => setSbp(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1"><Droplets size={14}/> DBP</Label>
                          <Input type="number" value={dbp} onChange={(e) => setDbp(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1"><Wind size={14}/> SpO2 %</Label>
                          <Input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1"><Activity size={14}/> RR</Label>
                          <Input type="number" value={rr} onChange={(e) => setRr(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1"><Thermometer size={14}/> Temp °C</Label>
                          <Input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="clinical" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Pre-existing Conditions</Label>
                        <Input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Diabetes, Hypertension, etc." />
                      </div>
                      <div className="space-y-2">
                        <Label>Smoking Status</Label>
                        <Select value={smoking} onValueChange={setSmoking}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Never">Never</SelectItem>
                            <SelectItem value="Former">Former</SelectItem>
                            <SelectItem value="Current">Current</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button type="submit" className="w-full h-12 text-lg" disabled={isRegistering}>
                    {isRegistering ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Stethoscope size={20} className="mr-2" />}
                    Register Complete Patient Profile
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isPatientsLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary/30" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatients.length === 0 ? (
              <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-white/50">
                <User size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-medium text-muted-foreground">No patients found</h3>
                <p className="text-muted-foreground mt-2">Start by adding a new patient to your clinical roster.</p>
              </div>
            ) : (
              filteredPatients.map(patient => (
                <PatientCard key={patient.id} patient={patient} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PatientCard({ patient }: { patient: Patient }) {
  // In a real app, predictions would be fetched from a subcollection
  // For this card, we'll assume a summary or leave it pending
  
  return (
    <Card className="hover:shadow-lg transition-all border-none shadow-sm overflow-hidden group">
      <CardHeader className="pb-4 bg-primary/5 group-hover:bg-primary/10 transition-colors">
        <div className="flex justify-between items-start">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
            <User size={24} />
          </div>
          <Badge variant="outline" className="bg-white">
            {patient.gender}
          </Badge>
        </div>
        <div className="mt-4">
          <CardTitle className="text-xl">{patient.firstName} {patient.lastName}</CardTitle>
          <CardDescription className="flex items-center gap-1 mt-1">
            ID: <span className="font-code text-xs">{patient.patientIdCode}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              Adm: {new Date(patient.admissionDate).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-2">
              <Activity size={14} />
              Age: {patient.age || 'N/A'}
            </div>
          </div>
          
          <Link href={`/dashboard/patients/${patient.id}`}>
            <Button variant="outline" className="w-full group/btn">
              View Patient Details
              <ChevronRight size={16} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
