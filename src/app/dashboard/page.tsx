
"use client";

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, User, Calendar, Activity, ChevronRight, Search as SearchIcon, Loader2 } from 'lucide-react';
import { getPatients, addPatient } from '@/lib/db-mock';
import { Patient } from '@/lib/types';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

export default function DoctorDashboard() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState('Male');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    const data = await getPatients();
    setPatients(data);
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAge) return;

    await addPatient({
      id: Math.random().toString(36).substr(2, 9),
      name: newName,
      age: parseInt(newAge),
      gender: newGender,
      admissionDate: new Date().toISOString(),
      clinicalNotes: ''
    });

    setNewName('');
    setNewAge('');
    setIsAddPatientOpen(false);
    loadPatients();
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary font-headline">Clinical Dashboard</h1>
            <p className="text-muted-foreground">Logged in as {user.email}</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search patient ID or name..." 
                className="pl-10 w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus size={18} />
                  Add New Patient
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New Patient</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPatient} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Enter patient name" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="age">Age</Label>
                      <Input id="age" type="number" value={newAge} onChange={(e) => setNewAge(e.target.value)} placeholder="Age" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={newGender} onValueChange={setNewGender}>
                        <SelectTrigger>
                          <SelectValue placeholder="Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Register Patient</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPatients.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-white/50">
              <User size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-medium text-muted-foreground">No patients found</h3>
              <p className="text-muted-foreground mt-2">Start by adding a new patient to your dashboard.</p>
            </div>
          ) : (
            filteredPatients.map(patient => (
              <PatientCard key={patient.id} patient={patient} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PatientCard({ patient }: { patient: Patient }) {
  const latestPrediction = patient.predictions?.[0];
  
  return (
    <Card className="hover:shadow-lg transition-all border-none shadow-sm overflow-hidden group">
      <CardHeader className="pb-4 bg-primary/5 group-hover:bg-primary/10 transition-colors">
        <div className="flex justify-between items-start">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
            <User size={24} />
          </div>
          <Badge variant={
            latestPrediction?.riskLevel === 'High' ? 'destructive' : 
            latestPrediction?.riskLevel === 'Medium' ? 'secondary' : 'outline'
          }>
            {latestPrediction ? `${latestPrediction.riskLevel} Risk` : 'No Predictions'}
          </Badge>
        </div>
        <div className="mt-4">
          <CardTitle className="text-xl">{patient.name}</CardTitle>
          <CardDescription className="flex items-center gap-1 mt-1">
            ID: <span className="font-code">{patient.id}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              Adm: {new Date(patient.admissionDate).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-2">
              <Activity size={14} />
              {patient.vitals.length} Vitals Recorded
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
