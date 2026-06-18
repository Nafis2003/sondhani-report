import localforage from "localforage";
import type { ReportRecord } from "./types";
import { encryptData, decryptData } from "./crypto";
import { getEncryptionKey } from "./store";

const reportStore = localforage.createInstance({
  name: "SondhaniLabDB",
  storeName: "reports",
  driver: localforage.INDEXEDDB,
});

async function requireKey() {
  const key = getEncryptionKey();
  if (!key) throw new Error("Database is locked: Encryption key missing in volatile memory");
  return key;
}

// Internal wrapper to encrypt and store
async function storeEncrypted(id: string, record: ReportRecord): Promise<void> {
  const key = await requireKey();
  const plaintext = JSON.stringify(record);
  const ciphertext = await encryptData(plaintext, key);
  await reportStore.setItem(id, ciphertext);
}

// Internal wrapper to retrieve and decrypt
async function getDecrypted(id: string): Promise<ReportRecord | null> {
  const key = await requireKey();
  const ciphertext = await reportStore.getItem<string>(id);
  if (!ciphertext) return null;
  
  try {
    const plaintext = await decryptData(ciphertext, key);
    return JSON.parse(plaintext) as ReportRecord;
  } catch (err) {
    console.error("Failed to decrypt report record:", err);
    throw new Error("Decryption failed. Incorrect key or corrupted data.");
  }
}

export async function saveReport(record: ReportRecord): Promise<void> {
  await storeEncrypted(record.id, record);
}

export async function getAllReports(): Promise<ReportRecord[]> {
  const reports: ReportRecord[] = [];
  const key = await requireKey(); // fast fail if locked
  
  const keys = await reportStore.keys();
  for (const k of keys) {
    const ciphertext = await reportStore.getItem<string>(k);
    if (ciphertext) {
      try {
        const plaintext = await decryptData(ciphertext, key);
        const value = JSON.parse(plaintext) as ReportRecord;
        if (!value.isDeleted) reports.push(value);
      } catch {
        console.error("Skipping corrupted or un-decryptable record:", k);
      }
    }
  }
  
  return reports.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteReport(id: string): Promise<void> {
  const report = await getDecrypted(id);
  if (report) {
    report.isDeleted = true;
    report.synced = false;
    report.updatedAt = Date.now();
    await storeEncrypted(id, report);
  }
}

function fuzzyMatch(pattern: string, str: string): boolean {
  const p = pattern.toLowerCase();
  const s = str.toLowerCase();
  let i = 0, j = 0;
  while (i < p.length && j < s.length) {
    if (p[i] === s[j]) i++;
    j++;
  }
  return i === p.length;
}

export async function searchReports(query: string): Promise<ReportRecord[]> {
  const all = await getAllReports();
  if (!query.trim()) return all;
  const q = query.trim();
  return all.filter(
    (p) =>
      fuzzyMatch(q, p.name) ||
      p.mobile.includes(q) ||
      p.refId.toLowerCase().includes(q.toLowerCase())
  );
}

export async function updateReportSync(
  id: string,
  synced: boolean
): Promise<void> {
  const report = await getDecrypted(id);
  if (report) {
    report.synced = synced;
    await storeEncrypted(id, report);
  }
}

export async function getUnsyncedReports(): Promise<ReportRecord[]> {
  const all = await getAllReports();
  return all.filter((p) => !p.synced);
}

export async function mergeServerRecords(serverRecords: ReportRecord[]): Promise<void> {
  for (const serverRecord of serverRecords) {
    const localRecord = await getDecrypted(serverRecord.id).catch(() => null);
    
    if (localRecord) {
      // If the local record has pending edits (synced: false), we prioritize local changes 
      // over the server changes to avoid losing offline work.
      if (!localRecord.synced) {
        continue;
      }
      
      // If local is synced, safe to overwrite with server's updated version.
      await storeEncrypted(serverRecord.id, { ...serverRecord, synced: true });
    } else {
      // New record from server
      await storeEncrypted(serverRecord.id, { ...serverRecord, synced: true });
    }
  }
}
