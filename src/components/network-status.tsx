"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showIndicator, setShowIndicator] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsOnline(navigator.onLine), 0);

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      setShowIndicator(true);
      setTimeout(() => setShowIndicator(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
      setJustReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Always show when offline, briefly show when reconnected
  const visible = !isOnline || showIndicator;

  return (
    <div
      className={`relative z-50 flex items-center justify-center gap-2 px-4 text-xs font-medium transition-all duration-300 overflow-hidden ${
        visible ? "h-10 opacity-100 border-b" : "h-0 opacity-0 border-transparent"
      } ${
        isOnline
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="h-3.5 w-3.5" />
          <span>Online & Synced</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline Mode — Data saved locally</span>
        </>
      )}
    </div>
  );
}
