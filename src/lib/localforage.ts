import localforage from "localforage";
import type { PatientRecord } from "./types";
import { encryptData, decryptData } from "./crypto";
import { getEncryptionKey } from "./store";

const patientStore = localforage.createInstance({
  name: "SondhaniLabDB",
  storeName: "patients",
  driver: localforage.INDEXEDDB,
});

async function requireKey() {
  const key = getEncryptionKey();
  if (!key) throw new Error("Database is locked: Encryption key missing in volatile memory");
  return key;
}

// Internal wrapper to encrypt and store
async function storeEncrypted(id: string, record: PatientRecord): Promise<void> {
  const key = await requireKey();
  const plaintext = JSON.stringify(record);
  const ciphertext = await encryptData(plaintext, key);
  await patientStore.setItem(id, ciphertext);
}

// Internal wrapper to retrieve and decrypt
async function getDecrypted(id: string): Promise<PatientRecord | null> {
  const key = await requireKey();
  const ciphertext = await patientStore.getItem<string>(id);
  if (!ciphertext) return null;
  
  try {
    const plaintext = await decryptData(ciphertext, key);
    return JSON.parse(plaintext) as PatientRecord;
  } catch (err) {
    console.error("Failed to decrypt patient record:", err);
    throw new Error("Decryption failed. Incorrect key or corrupted data.");
  }
}

export async function savePatient(record: PatientRecord): Promise<void> {
  await storeEncrypted(record.id, record);
}

export async function getPatient(id: string): Promise<PatientRecord | null> {
  return await getDecrypted(id);
}

export async function getAllPatients(): Promise<PatientRecord[]> {
  const patients: PatientRecord[] = [];
  const key = await requireKey(); // fast fail if locked
  
  const keys = await patientStore.keys();
  for (const k of keys) {
    const ciphertext = await patientStore.getItem<string>(k);
    if (ciphertext) {
      try {
        const plaintext = await decryptData(ciphertext, key);
        const value = JSON.parse(plaintext) as PatientRecord;
        if (!value.isDeleted) patients.push(value);
      } catch (e) {
        console.error("Skipping corrupted or un-decryptable record:", k);
      }
    }
  }
  
  return patients.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deletePatient(id: string): Promise<void> {
  const patient = await getDecrypted(id);
  if (patient) {
    patient.isDeleted = true;
    patient.synced = false;
    patient.updatedAt = Date.now();
    await storeEncrypted(id, patient);
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

export async function searchPatients(query: string): Promise<PatientRecord[]> {
  const all = await getAllPatients();
  if (!query.trim()) return all;
  const q = query.trim();
  return all.filter(
    (p) =>
      fuzzyMatch(q, p.name) ||
      p.mobile.includes(q) ||
      p.refId.toLowerCase().includes(q.toLowerCase())
  );
}

export async function updatePatientSync(
  id: string,
  synced: boolean
): Promise<void> {
  const patient = await getDecrypted(id);
  if (patient) {
    patient.synced = synced;
    await storeEncrypted(id, patient);
  }
}

export async function getUnsyncedPatients(): Promise<PatientRecord[]> {
  const all = await getAllPatients();
  return all.filter((p) => !p.synced);
}

export async function clearAllPatients(): Promise<void> {
  await patientStore.clear();
}

export async function mergeServerRecords(serverRecords: PatientRecord[]): Promise<void> {
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
