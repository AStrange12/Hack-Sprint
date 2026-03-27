"use client";

import { useState, useEffect, useRef } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, addDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileSpreadsheet, FileText, UserPlus, CheckCircle2, Search, Table as TableIcon } from 'lucide-react';
import { UserProfile, Patient } from '@/lib/types';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Manual Entry State
  const [manualPatient, setManualPatient] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    gender: 'Male',
    patientIdCode: '',
  });

  // Excel Upload State
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OCR State
  const [ocrResult, setOcrResult] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);

  // Firestore Auth Check
  const userDocRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
    if (!isProfileLoading && profile && profile.role !== 'Admin') {
      toast({ variant: "destructive", title: "Access Denied", description: "You do not have administrative privileges." });
      router.push('/dashboard');
    }
  }, [user, isUserLoading, profile, isProfileLoading, router]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsProcessing(true);
    try {
      const patientId = manualPatient.patientIdCode || `P-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      await addDoc(collection(db, 'patients'), {
        ...manualPatient,
        id: Math.random().toString(36).substr(2, 9),
        patientIdCode: patientId,
        admissionDate: new Date().toISOString(),
        addedByUserId: user.uid,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast({ title: "Patient Added", description: "Manual patient entry successful." });
      setManualPatient({ firstName: '', lastName: '', dob: '', gender: 'Male', patientIdCode: '' });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (data.length > 0) {
        setExcelHeaders(data[0] as string[]);
        const rows = data.slice(1).map((row: any) => {
          const obj: any = {};
          (data[0] as string[]).forEach((header, index) => {
            obj[header.toLowerCase()] = row[index];
          });
          return obj;
        });
        setExcelData(rows);
      }
    };
    reader.readAsBinaryString(file);
  };

  const saveExcelData = async () => {
    if (!user || excelData.length === 0) return;
    setIsProcessing(true);
    let successCount = 0;
    try {
      for (const row of excelData) {
        const patientId = row.patient_id || `EX-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        await addDoc(collection(db, 'patients'), {
          firstName: row.firstname || row.name?.split(' ')[0] || 'Unknown',
          lastName: row.lastname || row.name?.split(' ').slice(1).join(' ') || 'Patient',
          age: parseInt(row.age) || 0,
          gender: row.gender || 'Other',
          patientIdCode: patientId,
          admissionDate: new Date().toISOString(),
          addedByUserId: user.uid,
          source: 'excel',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        successCount++;
      }
      toast({ title: "Bulk Import Complete", description: `Successfully imported ${successCount} patients.` });
      setExcelData([]);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Partial Success", description: `Imported ${successCount} patients before error: ${error.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setOcrPreview(URL.createObjectURL(file));
    setOcrLoading(true);
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      setOcrResult(text);
      
      // Basic Parsing Logic
      const hrMatch = text.match(/HR[:\s]*(\d+)/i);
      const sbpMatch = text.match(/BP[:\s]*(\d+)\//i);
      const nameMatch = text.match(/Name[:\s]*([A-Za-z\s]+)/i);
      const ageMatch = text.match(/Age[:\s]*(\d+)/i);

      if (nameMatch) {
        const parts = nameMatch[1].trim().split(' ');
        setManualPatient(prev => ({ ...prev, firstName: parts[0], lastName: parts.slice(1).join(' ') }));
      }
      if (ageMatch) {
        // Dob placeholder if age found
        const year = new Date().getFullYear() - parseInt(ageMatch[1]);
        setManualPatient(prev => ({ ...prev, dob: `${year}-01-01` }));
      }
      
      toast({ title: "OCR Complete", description: "Data extracted and pre-filled in manual form." });
      setActiveTab('manual');
    } catch (error: any) {
      toast({ variant: "destructive", title: "OCR Failed", description: error.message });
    } finally {
      setOcrLoading(false);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary font-headline flex items-center gap-3">
              <ShieldCheck className="text-accent" />
              Administrative Panel
            </h1>
            <p className="text-muted-foreground">System-wide data management and bulk operations</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
            <TabsTrigger value="manual" className="gap-2"><UserPlus size={16}/> Manual Entry</TabsTrigger>
            <TabsTrigger value="excel" className="gap-2"><FileSpreadsheet size={16}/> Excel Import</TabsTrigger>
            <TabsTrigger value="ocr" className="gap-2"><FileText size={16}/> OCR Parse (Beta)</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Single Patient Registration</CardTitle>
                <CardDescription>Enter patient details manually to create a new record.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleManualSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input value={manualPatient.firstName} onChange={e => setManualPatient({...manualPatient, firstName: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input value={manualPatient.lastName} onChange={e => setManualPatient({...manualPatient, lastName: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input type="date" value={manualPatient.dob} onChange={e => setManualPatient({...manualPatient, dob: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Patient ID Code (Optional)</Label>
                      <Input value={manualPatient.patientIdCode} onChange={e => setManualPatient({...manualPatient, patientIdCode: e.target.value})} placeholder="System will generate if empty" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12" disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <UserPlus className="mr-2" size={18}/>}
                    Register Patient
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="excel">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Bulk Patient Import</CardTitle>
                <CardDescription>Upload a .csv or .xlsx file to register multiple patients at once.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-3xl bg-muted/30">
                  <FileSpreadsheet size={48} className="text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-6 text-center">
                    Drag and drop your file here, or click to browse.<br/>
                    Supported columns: Name, Age, Gender, Patient_ID
                  </p>
                  <Input 
                    type="file" 
                    accept=".csv, .xlsx" 
                    className="hidden" 
                    id="excel-upload" 
                    ref={fileInputRef}
                    onChange={handleExcelUpload}
                  />
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2" size={16}/> Select Excel File
                  </Button>
                </div>

                {excelData.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-primary">Data Preview ({excelData.length} records)</h3>
                      <Button onClick={saveExcelData} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <CheckCircle2 className="mr-2" size={16}/>}
                        Confirm & Import All
                      </Button>
                    </div>
                    <div className="border rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {excelHeaders.slice(0, 5).map(h => (
                              <TableHead key={h}>{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {excelData.slice(0, 10).map((row, idx) => (
                            <TableRow key={idx}>
                              {excelHeaders.slice(0, 5).map(h => (
                                <TableCell key={h}>{row[h.toLowerCase()] || '-'}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {excelData.length > 10 && (
                        <div className="p-4 text-center text-xs text-muted-foreground bg-muted/50">
                          ... and {excelData.length - 10} more rows
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ocr">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Report Scanner (OCR)</CardTitle>
                  <CardDescription>Upload a medical report image to extract patient details automatically.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl bg-muted/30">
                    {ocrPreview ? (
                      <img src={ocrPreview} alt="Preview" className="max-h-[300px] rounded-xl shadow-sm mb-4" />
                    ) : (
                      <FileText size={48} className="text-muted-foreground mb-4" />
                    )}
                    <Input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      id="ocr-upload" 
                      onChange={handleOCR}
                    />
                    <Button variant="secondary" onClick={() => document.getElementById('ocr-upload')?.click()} disabled={ocrLoading}>
                      {ocrLoading ? <Loader2 className="animate-spin mr-2"/> : <Upload className="mr-2" size={16}/>}
                      {ocrPreview ? "Change Image" : "Select Report Image"}
                    </Button>
                  </div>
                  
                  {ocrResult && (
                    <div className="space-y-2">
                      <Label>Raw Extracted Text</Label>
                      <div className="p-4 bg-muted rounded-xl text-xs font-code max-h-[200px] overflow-auto">
                        {ocrResult}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-accent/5 border-accent/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-accent/10 text-accent">BETA</Badge>
                    Parsed Data
                  </CardTitle>
                  <CardDescription>Results extracted from the OCR process. Review and save below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!ocrResult ? (
                    <div className="py-20 text-center text-muted-foreground italic">
                      Upload a report to see parsed results.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-white rounded-lg border">
                          <Label className="text-[10px] text-muted-foreground uppercase">Extracted Name</ilage>
                          <div className="font-semibold text-primary">{manualPatient.firstName} {manualPatient.lastName || 'TBD'}</div>
                        </div>
                        <div className="p-3 bg-white rounded-lg border">
                          <Label className="text-[10px] text-muted-foreground uppercase">Extracted Age</Label>
                          <div className="font-semibold text-primary">{manualPatient.dob ? new Date().getFullYear() - new Date(manualPatient.dob).getFullYear() : 'TBD'}</div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Extracted data has been pre-filled in the <strong>Manual Entry</strong> tab. 
                        Please switch tabs to review and finalize the registration.
                      </p>
                      <Button variant="default" className="w-full" onClick={() => setActiveTab('manual')}>
                        Go to Manual Entry Tab
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
