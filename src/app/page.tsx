"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getEncryptionKey, clearEncryptionKey } from "@/lib/store";
import { clearAllReports } from "@/lib/localforage";
import { InstallPWA } from "@/components/install-pwa";
import { LabForm } from "@/components/lab-form";
import { HistoryTable } from "@/components/history-table";
import { NetworkStatus } from "@/components/network-status";
import { cleanupExpiredRecords } from "@/lib/ttl";
import { initSyncListeners } from "@/lib/sync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, ClipboardList, Beaker, Droplet, LogOut } from "lucide-react";
import { Dialog, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ReportRecord } from "@/lib/types";

const PdfPreview = dynamic(() => import("@/components/pdf/pdf-preview"), {
  ssr: false,
});

export default function Dashboard() {
  const router = useRouter();
  const [pdfRecord, setPdfRecord] = useState<ReportRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<ReportRecord | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Cryptographic Lock Check
    const key = getEncryptionKey();
    if (!key) {
      router.replace("/login");
      return;
    }

    cleanupExpiredRecords();
    const cleanup = initSyncListeners();
    return cleanup;
  }, [router]);

  const handleSaved = useCallback((record: ReportRecord, generatePdf: boolean) => {
    setRefreshTrigger((n) => n + 1);
    if (generatePdf) {
      setPdfRecord(record);
    }
  }, []);

  const handleLogout = async () => {
    try {
      // 1. Data remains encrypted on disk. We NEVER obliterate data.
      // 2. Wipe derived decryption key from RAM
      clearEncryptionKey();
      // 3. Wipe UI verification flags
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("authVerification");
      
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login"; // Hard reload to clear all states
    } catch (e) {
      console.error("Logout failed", e);
      window.location.href = "/login";
    }
  };

  return (
    <div className="bg-background font-sans text-foreground selection:bg-primary/10 flex flex-col flex-1">
      <NetworkStatus />
      
      {/* Top Navigation */}
      <header className="w-full bg-background">
        <div className="container max-w-4xl mx-auto flex py-6 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4 font-bold tracking-tighter text-2xl md:text-3xl">
            <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center bg-foreground text-background">
              <Droplet className="h-6 w-6" />
            </div>
            Sondhani DDC
          </div>
          <div className="flex items-center border border-input overflow-hidden">
            <InstallPWA className="rounded-none border-0 bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3 md:px-6 gap-2 h-10" />
            <Button onClick={handleLogout} variant="ghost" className="rounded-none border-0 hover:bg-muted font-medium px-3 md:px-6 h-10 gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container max-w-4xl px-4 md:px-8 py-10 md:py-16 mx-auto">
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Lab Operations</h1>
            <p className="text-muted-foreground mt-2">Manage report test records and generate PDF reports.</p>
          </div>

          <Tabs defaultValue="new-report" className="w-full">
            <TabsList className="mb-8 flex w-full p-0 gap-0 border border-border bg-background h-14 overflow-hidden">
              <TabsTrigger value="new-report" className="flex flex-1 items-center justify-center gap-2 px-3 md:px-6 h-full text-sm font-medium border-r border-border text-muted-foreground hover:text-muted-foreground data-active:bg-foreground data-active:text-background data-active:hover:text-background transition-colors m-0 rounded-none !shadow-none min-w-0">
                <Droplet className="h-4 w-4 shrink-0" />
                <span className="truncate">New Report</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex flex-1 items-center justify-center gap-2 px-3 md:px-6 h-full text-sm font-medium text-muted-foreground hover:text-muted-foreground data-active:bg-foreground data-active:text-background data-active:hover:text-background transition-colors m-0 rounded-none !shadow-none min-w-0">
                <ClipboardList className="h-4 w-4 shrink-0" />
                <span className="truncate">Report History</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="new-report" className="focus-visible:outline-none">
              <LabForm onSaved={handleSaved} />
            </TabsContent>
            
            <TabsContent value="history" className="focus-visible:outline-none">
              <HistoryTable onViewPdf={setPdfRecord} onEdit={setEditingRecord} refreshTrigger={refreshTrigger} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* PDF Overlay */}
      {pdfRecord && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-xl bg-white px-6 py-4 shadow-lg">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
              <span className="text-sm font-medium text-slate-700">Loading PDF viewer...</span>
            </div>
          </div>
        }>
          <PdfPreview record={pdfRecord} onClose={() => setPdfRecord(null)} />
        </Suspense>
      )}



      {/* Edit Record Modal/Drawer */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="max-w-4xl w-full max-h-[95vh] md:max-h-[90vh] bottom-0 md:bottom-auto p-0 md:p-0 rounded-none flex flex-col overflow-hidden border border-border bg-background">
            <div className="p-6 md:p-8 border-b border-border bg-muted/40 flex-shrink-0">
              <DialogTitle className="text-xl font-bold tracking-tight">Edit Report</DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1">
                Make changes to this laboratory report record.
              </DialogDescription>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-background relative">
              {editingRecord && (
                <div className="pb-32">
                  <LabForm
                    key={editingRecord.id}
                    initialData={editingRecord}
                    isEditMode={true}
                    onSaved={(updatedRecord, generatePdf) => {
                      handleSaved(updatedRecord, generatePdf);
                      setEditingRecord(null);
                    }}
                  />
                </div>
              )}
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
