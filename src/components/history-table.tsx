"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Trash2, Clock, Eye, SlidersHorizontal, Pencil, Download } from "lucide-react";
import { getAllReports, searchReports, deleteReport } from "@/lib/localforage";
import { cleanupExpiredRecords } from "@/lib/ttl";
import type { ReportRecord } from "@/lib/types";
import { toast } from "sonner";

interface HistoryTableProps {
  onViewPdf: (record: ReportRecord) => void;
  onEdit: (record: ReportRecord) => void;
  refreshTrigger?: number;
}

export function HistoryTable({ onViewPdf, onEdit, refreshTrigger }: HistoryTableProps) {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Separate TTL cleanup — runs on mount and every 5 min, never on search
  useEffect(() => {
    const run = async () => {
      try {
        const deleted = await cleanupExpiredRecords();
        if (deleted > 0) {
          toast.info(`Cleaned up ${deleted} expired record(s)`);
        }
      } catch {
        // silent
      }
    };
    run();
    const interval = setInterval(run, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const data = debouncedSearchQuery
      ? await searchReports(debouncedSearchQuery)
      : await getAllReports();
    setReports(data);
    setLoading(false);
  }, [debouncedSearchQuery]);

  useEffect(() => {
    setTimeout(() => loadReports(), 0);
  }, [loadReports, refreshTrigger]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleDownload = async (report: ReportRecord) => {
    try {
      toast.loading("Generating PDF...", { id: "pdf-gen" });
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportDocument } = await import("@/components/pdf/report-document");
      
      const blob = await pdf(<ReportDocument record={report} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sondhani_Report_${report.refId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 500);
      
      toast.success("Download started", { id: "pdf-gen" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF", { id: "pdf-gen" });
    }
  };

  const handleDelete = async (id: string, refId: string) => {
    if (!window.confirm(`Are you sure you want to delete report ${refId}? This action cannot be undone.`)) {
      return;
    }
    await deleteReport(id);
    toast.success(`Deleted ${refId}`);
    loadReports();
  };

  const hasPositiveTests = (p: ReportRecord) =>
    p.hbsAg === "Positive" ||
    p.hcv === "Positive" ||
    p.malaria === "Positive" ||
    p.hiv === "Positive" ||
    p.vdrl === "Positive";

  const displayedReports = useMemo(
    () =>
      reports
        .filter((p) => {
          if (filter === "positive") return hasPositiveTests(p);
          if (filter === "negative") return !hasPositiveTests(p);
          return true;
        })
        .sort((a, b) => {
          if (filter === "oldest") return a.createdAt - b.createdAt;
          return b.createdAt - a.createdAt;
        }),
    [reports, filter],
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="mb-4">
        <div className="flex w-full items-center -space-x-px">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by phone no, name, or ID..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-12 rounded-none focus:z-10 bg-card border-border h-12 text-base shadow-none"
            />
          </div>
          <Select value={filter} onValueChange={(val) => setFilter(val || "all")}>
            <SelectTrigger className="!h-12 w-[160px] sm:w-[180px] px-4 text-sm font-medium bg-card border border-border transition-colors rounded-none flex-shrink-0 shadow-none focus:z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-foreground"><SelectValue placeholder="Filter" /></span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="positive">Positive Only</SelectItem>
              <SelectItem value="negative">Negative Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table Area */}
      <div className="border border-border/50 bg-background/50 overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery
                ? "No reports match your search."
                : "No report records found in history."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50 bg-secondary/30">
                  <TableHead className="font-medium text-xs uppercase tracking-wider h-10 text-muted-foreground pl-4">Ref ID</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider h-10 text-muted-foreground">Name</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider h-10 text-muted-foreground">Age</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider h-10 text-muted-foreground">Mobile</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider h-10 text-muted-foreground">Date</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider h-10 text-muted-foreground">Status</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider h-10 text-muted-foreground text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedReports.map((report) => (
                  <TableRow key={report.id} className="border-border/50 hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-mono text-xs text-muted-foreground pl-4">
                      {report.refId}
                    </TableCell>
                    <TableCell className="font-medium">
                      {report.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{report.age}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {report.mobile}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {report.date}
                    </TableCell>
                    <TableCell>
                      {hasPositiveTests(report) ? (
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-none border-none px-2.5 py-1">
                          Positive
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 shadow-none border-none px-2.5 py-1">
                          Negative
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(report)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onViewPdf(report)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          title="View PDF"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(report)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          title="Edit report"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(report.id, report.refId)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
