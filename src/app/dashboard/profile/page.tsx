
"use client";

import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/lib/types';
import { useMemoFirebase } from '@/firebase';

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    return user ? doc(db, 'users', user.uid) : null;
  }, [db, user]);

  const { data: profileData, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    fullName: '',
    hospitalName: '',
    specialization: '',
    experienceYears: 0,
    contactNumber: '',
    address: '',
  });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (profileData) {
      setFormData({
        fullName: profileData.fullName || '',
        hospitalName: profileData.hospitalName || '',
        specialization: profileData.specialization || '',
        experienceYears: profileData.experienceYears || 0,
        contactNumber: profileData.contactNumber || '',
        address: profileData.address || '',
      });
    }
  }, [profileData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'experienceYears' ? parseInt(value) || 0 : value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...formData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      toast({
        title: "Profile Updated",
        description: "Your professional details have been saved successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || isProfileLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white">
            <UserIcon size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-primary font-headline">Doctor Profile</h1>
            <p className="text-muted-foreground">Manage your professional identity and clinical settings</p>
          </div>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Professional Details</CardTitle>
            <CardDescription>This information will be associated with the patients you manage.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    name="fullName"
                    value={formData.fullName} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    value={user.email || ''} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dept">Department</Label>
                  <Input 
                    id="dept" 
                    name="dept"
                    value={formData.hospitalName} 
                    onChange={handleInputChange} 
                    placeholder="e.g. OPD"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input 
                    id="specialization" 
                    name="specialization"
                    value={formData.specialization} 
                    onChange={handleInputChange} 
                    placeholder="e.g. Cardiology"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experienceYears">Years of Experience</Label>
                  <Input 
                    id="experienceYears" 
                    name="experienceYears"
                    type="number"
                    value={formData.experienceYears} 
                    onChange={handleInputChange} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input 
                    id="contactNumber" 
                    name="contactNumber"
                    value={formData.contactNumber} 
                    onChange={handleInputChange} 
                    placeholder="+91 000000000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  name="address"
                  value={formData.address} 
                  onChange={handleInputChange} 
                  placeholder="Full physical address"
                />
              </div>
              
              <Button type="submit" className="w-full h-12 gap-2" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                Save Profile Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
