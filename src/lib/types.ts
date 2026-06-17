export interface PatientRecord {
  id: string;
  refId: string;
  name: string;
  age: number;
  sex: "Male" | "Female" | "Other" | string;
  mobile: string;
  date: string;
  time: string;
  hbsAg: "Negative" | "Positive" | "N/A";
  hcv: "Negative" | "Positive" | "N/A";
  malaria: "Negative" | "Positive" | "N/A";
  hiv: "Negative" | "Positive" | "N/A";
  vdrl: "Negative" | "Positive" | "N/A";
  bloodGlucose: string;
  createdAt: number;
  updatedAt?: number;
  isDeleted?: boolean;
  synced: boolean;
}

export type TestName = "hbsAg" | "hcv" | "malaria" | "hiv" | "vdrl";

export const TEST_LABELS: Record<TestName, string> = {
  hbsAg: "HBsAg",
  hcv: "HCV",
  malaria: "Malaria",
  hiv: "HIV",
  vdrl: "VDRL",
};

export const TEST_OPTIONS = ["Negative", "Positive"] as const;
