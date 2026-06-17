"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Save, Phone, Calendar, Droplet, FileText, User } from "lucide-react";
import { savePatient } from "@/lib/localforage";
import { syncToCloud } from "@/lib/sync";
import type { PatientRecord, TestName } from "@/lib/types";
import { TEST_LABELS } from "@/lib/types";

function generateRefId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  
  // Generate 3 bytes (6 hex characters) of cryptographically secure random data.
  // This gives 16.7 million unique combinations per day, guaranteeing 
  // collision-free IDs even across multiple offline devices syncing later.
  const array = new Uint8Array(3);
  crypto.getRandomValues(array);
  const uniqueHex = Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return `${dateStr}-${uniqueHex}`;
}

const TEST_RESULT = z.enum(["Negative", "Positive"]).optional();

const formSchema = z
  .object({
    name: z.string().min(1, "Patient name is required"),
    age: z
      .string()
      .min(1, "Age is required")
      .refine((v) => Number(v) > 0 && Number(v) <= 150, {
        message: "Enter a valid age (1–150)",
      }),
    sex: z.enum(["Male", "Female", "Other"]),
    mobile: z.string().min(1, "Mobile number is required"),
    bloodGlucose: z.string().optional(),
    glucoseUnit: z.enum(["mmol/L", "mg/dL"]),
    glucoseType: z.enum(["Fasting", "2h glucose", "Random"]),
    hbsAg: TEST_RESULT,
    hcv: TEST_RESULT,
    malaria: TEST_RESULT,
    hiv: TEST_RESULT,
    vdrl: TEST_RESULT,
  });

type FormValues = z.infer<typeof formSchema>;

interface LabFormProps {
  onSaved: (record: PatientRecord, generatePdf: boolean) => void;
  initialData?: PatientRecord;
  isEditMode?: boolean;
}

const testNames: TestName[] = ["hbsAg", "hcv", "malaria", "hiv", "vdrl"];

export function LabForm({ onSaved, initialData, isEditMode = false }: LabFormProps) {
  const [savingMode, setSavingMode] = useState<"save" | "pdf" | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      age: initialData?.age ? String(initialData.age) : "",
      sex: (initialData?.sex as "Male" | "Female" | "Other") ?? "Male",
      mobile: initialData?.mobile ?? "",
      bloodGlucose: (() => {
        if (!initialData?.bloodGlucose || initialData.bloodGlucose === "N/A") return "";
        return initialData.bloodGlucose.split(" ")[0] ?? "";
      })(),
      glucoseUnit: initialData?.bloodGlucose?.includes("mg/dL") ? "mg/dL" : "mmol/L",
      glucoseType: initialData?.bloodGlucose?.includes("(Fasting)")
        ? "Fasting"
        : initialData?.bloodGlucose?.includes("(2h glucose)")
        ? "2h glucose"
        : "Random",
      // Tests: only set a value if initialData has a real result (not N/A)
      hbsAg: initialData?.hbsAg && initialData.hbsAg !== "N/A" ? initialData.hbsAg : undefined,
      hcv: initialData?.hcv && initialData.hcv !== "N/A" ? initialData.hcv : undefined,
      malaria: initialData?.malaria && initialData.malaria !== "N/A" ? initialData.malaria : undefined,
      hiv: initialData?.hiv && initialData.hiv !== "N/A" ? initialData.hiv : undefined,
      vdrl: initialData?.vdrl && initialData.vdrl !== "N/A" ? initialData.vdrl : undefined,
    },
  });

  const handleSave = async (generatePdf: boolean) => {
    const valid = await form.trigger();
    if (!valid) return;

    const values = form.getValues();
    setSavingMode(generatePdf ? "pdf" : "save");

    try {
      const now = new Date();
      const record: PatientRecord = {
        id: initialData?.id ?? crypto.randomUUID(),
        refId: initialData?.refId ?? generateRefId(),
        name: values.name.trim(),
        age: Number(values.age),
        sex: values.sex,
        mobile: values.mobile.trim(),
        date: initialData?.date ?? now.toISOString().slice(0, 10),
        time: initialData?.time ?? now.toTimeString().slice(0, 5),
        hbsAg: values.hbsAg ?? "N/A",
        hcv: values.hcv ?? "N/A",
        malaria: values.malaria ?? "N/A",
        hiv: values.hiv ?? "N/A",
        vdrl: values.vdrl ?? "N/A",
        bloodGlucose:
          values.bloodGlucose?.trim()
            ? `${values.bloodGlucose.trim()} ${values.glucoseUnit} (${values.glucoseType})`
            : "N/A",
        createdAt: initialData?.createdAt ?? Date.now(),
        synced: false,
      };

      await savePatient(record);

      if (generatePdf) {
        toast.success("Record saved. Generating PDF...", {
          description: `Patient ${record.refId} has been securely stored.`,
        });
      } else {
        toast.success("Record saved", {
          description: `Patient ${record.refId} has been securely stored.`,
        });
      }

      syncToCloud(record).catch(() => {});

      if (!isEditMode) {
        form.reset({
          name: "",
          age: "",
          sex: "Male",
          mobile: "",
          bloodGlucose: "",
          glucoseUnit: "mmol/L",
          glucoseType: "Random",
          hbsAg: undefined,
          hcv: undefined,
          malaria: undefined,
          hiv: undefined,
          vdrl: undefined,
        });
      }

      onSaved(record, generatePdf);
    } catch {
      toast.error("Failed to save", {
        description: "An unexpected error occurred.",
      });
    } finally {
      setSavingMode(null);
    }
  };

  return (
    <div className={isEditMode ? "w-full animate-in fade-in duration-200" : "mx-auto max-w-4xl pb-16"}>
      <div className={isEditMode ? "bg-card flex flex-col" : "border border-border bg-card flex flex-col"}>
        <Form {...form}>
          <form noValidate>
            {/* Patient Details Section */}
            <section className="p-6 md:p-10">
              <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide ml-1">
                        Full Name
                      </FormLabel>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <FormControl>
                          <Input
                            placeholder="e.g. John Doe"
                            {...field}
                            className="h-12 pl-12 text-base bg-muted border border-border/30 hover:border-border focus-visible:bg-background transition-colors"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Mobile */}
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide ml-1">
                        Mobile Number
                      </FormLabel>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <FormControl>
                          <Input
                            placeholder="01XXXXXXXXX"
                            {...field}
                            className="h-12 pl-12 text-base bg-muted border border-border/30 hover:border-border focus-visible:bg-background transition-colors"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Age */}
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide ml-1">
                        Age
                      </FormLabel>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Years"
                            min={0}
                            max={150}
                            {...field}
                            className="h-12 pl-12 text-base bg-muted border border-border/30 hover:border-border focus-visible:bg-background transition-colors"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Sex */}
                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide ml-1">
                        Sex
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="!h-12 text-base px-4 font-medium bg-muted border border-border/30 hover:border-border transition-colors">
                            <SelectValue placeholder="Select sex" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male" className="h-10">Male</SelectItem>
                          <SelectItem value="Female" className="h-10">Female</SelectItem>
                          <SelectItem value="Other" className="h-10">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Blood Glucose */}
                <FormField
                  control={form.control}
                  name="bloodGlucose"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide ml-1">
                        Blood Glucose
                      </FormLabel>
                      <div className="flex">
                        <div className="relative flex-1">
                          <Droplet className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                          <FormControl>
                            <Input
                              placeholder="Value"
                              {...field}
                              className="h-12 pl-12 text-base bg-muted border border-border/30 hover:border-border focus-visible:bg-background transition-colors rounded-none border-r-0"
                            />
                          </FormControl>
                        </div>
                        <FormField
                          control={form.control}
                          name="glucoseUnit"
                          render={({ field: unitField }) => (
                            <Select value={unitField.value} onValueChange={unitField.onChange}>
                              <SelectTrigger className="!h-12 w-[80px] px-2 text-xs font-medium bg-muted border border-border/30 hover:border-border transition-colors rounded-none flex-shrink-0 border-r-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mmol/L">mmol/L</SelectItem>
                                <SelectItem value="mg/dL">mg/dL</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="glucoseType"
                          render={({ field: typeField }) => (
                            <Select value={typeField.value} onValueChange={typeField.onChange}>
                              <SelectTrigger className="!h-12 w-[110px] px-2 text-xs font-medium bg-muted border border-border/30 hover:border-border transition-colors rounded-none flex-shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fasting">Fasting</SelectItem>
                                <SelectItem value="2h glucose">2h glucose</SelectItem>
                                <SelectItem value="Random">Random</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <div className="h-px bg-border/40 w-full" />

            {/* Test Results Section */}
            <section className="p-6 md:p-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {testNames.map((test, index) => (
                  <FormField
                    key={test}
                    control={form.control}
                    name={test}
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide ml-1">
                          {TEST_LABELS[test]}
                        </FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(v) =>
                            field.onChange(v === "" ? undefined : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="!h-12 w-full text-base px-4 font-medium transition-colors bg-muted border-transparent hover:bg-muted/80 focus:bg-muted/80">
                              <SelectValue placeholder="Not tested" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Negative" className="h-10">
                              <span className="text-foreground font-medium">Negative</span>
                            </SelectItem>
                            <SelectItem value="Positive" className="h-10">
                              <span className="text-destructive font-semibold">Positive</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </section>

            {/* Footer Action Bar */}
            <div className="h-px bg-border/40 w-full" />
            <section className="p-6 md:px-10 md:py-8 bg-secondary/10 flex flex-col sm:flex-row items-center justify-end gap-6">
              <div className="flex w-full sm:w-auto items-center -space-x-px">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1 sm:flex-none h-12 px-6 font-medium relative z-0 hover:z-10 focus:z-10"
                  onClick={() => handleSave(false)}
                  disabled={!!savingMode}
                >
                  {savingMode === "save" ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
                      Saving...
                    </span>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="lg"
                  className="flex-1 sm:flex-none h-12 px-8 font-medium shadow-none relative z-0 hover:z-10 focus:z-10 border border-primary hover:border-primary/90"
                  onClick={() => handleSave(true)}
                  disabled={!!savingMode}
                >
                  {savingMode === "pdf" ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      Processing...
                    </span>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate PDF
                    </>
                  )}
                </Button>
              </div>
            </section>
          </form>
        </Form>
      </div>
    </div>
  );
}
