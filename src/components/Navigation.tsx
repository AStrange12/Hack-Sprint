
"use client";

import Link from 'next/link';
import { Stethoscope, User, LayoutDashboard, Search, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export function Navigation() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
            <Stethoscope size={20} />
          </div>
          HealthPredict AI
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/public" className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1">
            <Search size={16} />
            Patient Search
          </Link>
          
          {!isUserLoading && (
            <>
              {user ? (
                <div className="flex items-center gap-4">
                  <Link href="/dashboard">
                    <Button variant="ghost" className="flex items-center gap-2">
                      <LayoutDashboard size={16} />
                      Dashboard
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2">
                    <LogOut size={16} />
                    Logout
                  </Button>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <User size={18} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/login">
                    <Button variant="ghost">Login</Button>
                  </Link>
                  <Link href="/signup">
                    <Button variant="default">Sign Up</Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
