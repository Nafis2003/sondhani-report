import { getUnsyncedReports, updateReportSync, mergeServerRecords } from "./localforage";
import { clearEncryptionKey } from "./store";
import type { ReportRecord } from "./types";

const SYNC_QUEUE_KEY = "sondhani_sync_queue";

interface SyncQueueItem {
  reportId: string;
  timestamp: number;
}

function getSyncQueue(): SyncQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setSyncQueue(queue: SyncQueueItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

function addToSyncQueue(reportId: string): void {
  const queue = getSyncQueue();
  if (!queue.find((q) => q.reportId === reportId)) {
    queue.push({ reportId, timestamp: Date.now() });
    setSyncQueue(queue);
  }
}

function removeFromSyncQueue(reportId: string): void {
  const queue = getSyncQueue().filter((q) => q.reportId !== reportId);
  setSyncQueue(queue);
}

async function forceLogout() {
  // We NEVER obliterate data. It is safely encrypted at rest.
  clearEncryptionKey();
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("authVerification");
  window.location.href = "/login?error=session_expired";
}

async function syncRecordToCloud(record: ReportRecord): Promise<boolean> {
  console.log("[Sync] Pushing record to cloud:", record.refId);
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (res.status === 401) {
      await forceLogout();
      return false;
    }
    const data = await res.json();
    return data.success;
  } catch (err) {
    console.error("[Sync] Error:", err);
    return false;
  }
}

export async function syncToCloud(record: ReportRecord): Promise<void> {
  if (!navigator.onLine) {
    addToSyncQueue(record.id);
    return;
  }

  try {
    const success = await syncRecordToCloud(record);
    if (success) {
      await updateReportSync(record.id, true);
      removeFromSyncQueue(record.id);
    } else {
      addToSyncQueue(record.id);
    }
  } catch {
    addToSyncQueue(record.id);
  }
}

export async function flushSyncQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const queue = getSyncQueue();
  if (queue.length === 0) return;

  const unsynced = await getUnsyncedReports();
  const unsyncedMap = new Map(unsynced.map((p) => [p.id, p]));

  for (const item of queue) {
    const record = unsyncedMap.get(item.reportId);
    if (record) {
      try {
        const success = await syncRecordToCloud(record);
        if (success) {
          await updateReportSync(record.id, true);
          removeFromSyncQueue(record.id);
        }
      } catch {
        // Will retry next time
      }
    } else {
      removeFromSyncQueue(item.reportId);
    }
  }
}
export async function pullFromCloud(): Promise<void> {
  if (!navigator.onLine) return;
  
  try {
    console.log("[Sync] Pulling records from cloud...");
    const res = await fetch("/api/sync");
    if (!res.ok) {
      // Silently fail — the proxy handles auth redirects at the routing level.
      // Forcing logout here on a background sync failure causes an infinite reload loop in dev.
      console.warn("[Sync] Pull failed with status:", res.status);
      return;
    }
    const data = await res.json();
    if (data.success && data.records) {
      await mergeServerRecords(data.records);
      console.log("[Sync] Successfully merged server records");
    }
  } catch (err) {
    console.error("[Sync] Pull error:", err);
  }
}

export function initSyncListeners(): () => void {
  const handleOnline = async () => {
    console.log("[Sync] Back online, syncing...");
    await pullFromCloud();
    await flushSyncQueue();
  };

  window.addEventListener("online", handleOnline);

  // Try syncing on init if online
  if (navigator.onLine) {
    pullFromCloud().then(() => flushSyncQueue());
  }

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
