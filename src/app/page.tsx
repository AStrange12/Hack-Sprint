
"use client";

import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Activity, ShieldAlert, Heart, FileText, Stethoscope, ShieldCheck, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';

export default function LandingPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    return user ? doc(db, 'users', user.uid) : null;
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const isAdmin = profile?.role === 'Admin';

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-24 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border shadow-sm mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <ShieldAlert size={16} className="text-accent" />
              <span className="text-sm font-medium text-muted-foreground">Advanced Clinical Deterioration Monitoring</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-primary mb-6 max-w-4xl mx-auto font-headline">
              Predicting Patient Outcomes with <span className="text-accent">Precision AI</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Empower clinical teams with multimodal predictions for ICU transfer, cardiac arrest, and mortality using real-time vitals and clinical notes.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isUserLoading || isProfileLoading ? (
                <Button disabled size="lg" className="h-14 px-8 rounded-xl">
                  <Loader2 className="animate-spin mr-2" />
                  Verifying Access...
                </Button>
              ) : (
                <>
                  {isAdmin ? (
                    <Link href="/admin/dashboard">
                      <Button size="lg" className="h-14 px-8 text-lg font-semibold rounded-xl bg-accent hover:bg-accent/90">
                        <ShieldCheck className="mr-2" />
                        Go to Admin Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/dashboard">
                      <Button size="lg" className="h-14 px-8 text-lg font-semibold rounded-xl">
                        Go to Doctor Dashboard
                      </Button>
                    </Link>
                  )}
                  <Link href="/public">
                    <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold rounded-xl">
                      Public Patient Portal
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10" />
        </section>

        {/* Features Grid */}
        <section className="py-24 max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Activity className="text-primary" />}
              title="Multimodal Analysis"
              description="Combines time-series vitals (HR, BP, SpO2) with unstructured clinical notes for a holistic risk assessment."
            />
            <FeatureCard 
              icon={<Heart className="text-primary" />}
              title="Early Deterioration Detection"
              description="Predicts ICU transfer and cardiac arrest risk up to 48 hours in advance, allowing for early intervention."
            />
            <FeatureCard 
              icon={<FileText className="text-primary" />}
              title="Explainable AI"
              description="Provides transparent, doctor-friendly explanations and feature importance breakdowns for every prediction."
            />
          </div>
        </section>

        {/* Stats Section */}
        <section className="bg-primary text-white py-20">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-12 md:gap-24 text-center">
            <Stat label="Prediction Accuracy" value="94%" />
            <Stat label="Risk Factors Monitored" value="25+" />
            <Stat label="Real-time Processing" value="< 2s" />
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-primary/60 font-semibold">
            <Stethoscope size={20} />
            HealthPredict AI
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Clinical AI Systems. For professional medical use only.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <div className="text-4xl md:text-5xl font-bold mb-2 font-headline">{value}</div>
      <div className="text-primary-foreground/70 font-medium">{label}</div>
    </div>
  );
}
