"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Mail } from "lucide-react";
import { deriveKey, createVerificationData, verifyKey } from "@/lib/crypto";
import { setEncryptionKey } from "@/lib/store";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [mode, setMode] = useState<"login" | "unlock" | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if we have an active session that just needs unlocking
    const isAuth = localStorage.getItem("isAuthenticated") === "true";
    setTimeout(() => setMode(isAuth ? "unlock" : "login"), 0);

    // Network listeners
    setTimeout(() => setIsOffline(!navigator.onLine), 0);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login" && !email) {
      toast.error("Please enter your email");
      return;
    }
    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Derive the encryption key from the password
      const key = await deriveKey(password);

      // 2. Unlock Flow (Used when page is refreshed or app is opened with an active session)
      if (mode === "unlock") {
        const verification = localStorage.getItem("authVerification");
        if (!verification) {
          // Fallback if verification is somehow missing but they are "authenticated"
          toast.error("Verification data missing. Please log in again.");
          localStorage.removeItem("isAuthenticated");
          setMode("login");
          setIsLoading(false);
          return;
        }

        const valid = await verifyKey(key, verification);
        if (valid) {
          setEncryptionKey(key);
          toast.success("Database unlocked!");
          router.refresh();
          router.push("/");
        } else {
          toast.error("Incorrect password.");
        }
        setIsLoading(false);
        return;
      }

      // 3. Full Login Flow (Requires Network)
      if (mode === "login") {
        if (isOffline) {
          toast.error("You must be online to log in for the first time.");
          setIsLoading(false);
          return;
        }

        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          // Save the key to volatile RAM
          setEncryptionKey(key);
          
          // Create an offline verification token and save it to LocalStorage
          const verification = await createVerificationData(key);
          localStorage.setItem("authVerification", verification);
          localStorage.setItem("isAuthenticated", "true");
          
          toast.success("Login successful");
          router.refresh();
          router.push("/");
        } else {
          toast.error(data.error || "Login failed");
        }
      }
    } catch {
      toast.error("Network error during login.");
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent rendering until we determine the mode to avoid hydration flicker
  if (mode === null) return null;

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Brand Header */}
      <header className="w-full py-6 px-4 md:px-8">
        <div className="max-w-sm mx-auto flex items-center gap-3 font-bold tracking-tighter text-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 shrink-0">
            <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
          </svg>
          Sondhani DDC
        </div>
      </header>

      {/* Form centered */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "unlock" ? "Unlock Database" : "Welcome Back"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 px-2">
              {mode === "unlock" 
                ? "Enter your password to decrypt the local database and resume your session."
                : isOffline 
                  ? "You must be connected to the internet to log in."
                  : "Enter your credentials to log in to the system."}
            </p>
          </div>

          <form onSubmit={handleLogin}>
            {mode === "unlock" && (
              <input
                id="unlock-email"
                name="email"
                type="text"
                autoComplete="username"
                className="hidden"
                readOnly
                tabIndex={-1}
              />
            )}
            <div className="flex flex-col w-full overflow-hidden rounded-md border border-border divide-y divide-border focus-within:ring-1 focus-within:ring-ring bg-muted">
              {mode === "login" && (
                <div className="relative w-full">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={isOffline}
                    className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                    style={{ paddingLeft: "2.75rem", paddingRight: "0.75rem" }}
                  />
                </div>
              )}
              <div className="relative w-full">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus={true}
                  disabled={mode === "login" && isOffline}
                  className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  style={{ paddingLeft: "2.75rem", paddingRight: "0.75rem" }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || (mode === "login" && isOffline)}
                className="h-11 w-full bg-primary text-primary-foreground text-xs font-semibold tracking-widest uppercase disabled:opacity-50 transition-colors hover:bg-primary/80"
              >
                {isLoading ? "..." : (mode === "unlock" ? "Unlock" : "Sign In")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
