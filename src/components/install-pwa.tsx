"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

// The BeforeInstallPromptEvent interface is not natively in TS DOM yet
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPWA({ className }: { className?: string }) {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    prompt.prompt();

    const { outcome } = await prompt.userChoice;

    if (outcome === "accepted") {
      setIsInstallable(false);
    }

    deferredPromptRef.current = null;
  };

  if (!isInstallable || isInstalled) return null;

  return (
    <Button 
      variant="default" 
      onClick={handleInstallClick}
      className={className || "gap-2 font-medium"}
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Install App</span>
    </Button>
  );
}
