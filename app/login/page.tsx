"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import Coyalogo from "@/components/Coyalogo";
import { Loader2 } from "lucide-react";

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill email from URL parameter
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  // Check for OTP expiration error in URL hash and redirect to signup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.substring(1); // Remove the '#'
      if (hash) {
        const params = new URLSearchParams(hash);
        const errorCode = params.get("error_code");
        const error = params.get("error");
        
        if (error === "access_denied" && errorCode === "otp_expired") {
          // Redirect to signup page so user can set their password
          router.push("/signup");
          return;
        }
      }
    }
  }, [router]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Provide more helpful error messages
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please check your credentials.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        // Check if user is admin (whochoppa@gmail.com or specific user ID)
        const userEmail = data.user.email?.toLowerCase();
        const userId = data.user.id;
        const isAdminUser = userEmail === "whochoppa@gmail.com" || userId === "9c0e8c58-8a36-47e9-aa68-909b22b4443f";
        
        if (isAdminUser) {
          // Admin user - skip users table check, go directly to ops
          // Don't set welcome flag on login - only signup should trigger welcome
          console.log("✅ Admin user signed in:", userEmail || userId);
          router.push("/ops");
          router.refresh();
          setLoading(false);
          return;
        }

        // Regular users - get business_id from users table
        type UserData = {
          business_id: string;
          is_active: boolean;
          role: string | null;
        };
        
        const { data: userDataRaw, error: userError } = await supabase
          .from("users")
          .select("business_id, is_active, role")
          .eq("auth_user_id", data.user.id)
          .maybeSingle();
        
        const userData = userDataRaw as UserData | null;

        if (userError) {
          console.error("Error fetching user:", userError);
          console.error("Error details:", JSON.stringify(userError, null, 2));
          
          // Check if it's an RLS policy issue
          if (userError.code === '42501' || userError.message?.includes('permission denied') || userError.message?.includes('RLS')) {
            setError("Database permissions error. Please ensure RLS policies allow users to query their own record.");
          } else {
            setError(`Failed to load user data: ${userError.message || 'Unknown error'}`);
          }
          setLoading(false);
          return;
        }

        if (!userData) {
          setError("User not found. Please contact your administrator.");
          setLoading(false);
          return;
        }

        if (!userData.is_active) {
          setError("Your account has been deactivated. Please contact your administrator.");
          setLoading(false);
          return;
        }

        // Store in sessionStorage for multi-tenant
        sessionStorage.setItem("business_id", userData.business_id);
        if (userData.role) {
          sessionStorage.setItem("user_role", userData.role);
        }

        // Check if business has a default program_id and auto-set it
        const { data: businessData } = await supabase
          .from("businesses")
          .select("program_id, name")
          .eq("id", userData.business_id)
          .maybeSingle();
        
        if (businessData && (businessData as any).program_id) {
          sessionStorage.setItem("program_id", (businessData as any).program_id);
          console.log("✅ Auto-selected program from business on login");
        }

        // Don't set welcome flag on login - only signup should trigger welcome
        // Login is for existing users, signup is for new accounts (even if email was re-added)
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-yellow-950/20 to-black" />
      
      {/* Logo - Top Left of Background */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="absolute top-6 left-6 z-10"
      >
        <motion.div
          animate={{
            rotate: [0, 5, -5, 5, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Coyalogo src="/logo.gif" size={50} />
        </motion.div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md z-20"
      >
        <div className="glass-strong rounded-3xl p-12 border border-white/10 shadow-2xl">

          {/* Logo & Branding - Centered */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center mb-10"
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <motion.h1
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="text-5xl font-bold text-white"
              >
                COYA
              </motion.h1>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-semibold text-yellow-400/90"
              >
                AI
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="beta-badge self-start mt-2"
              >
                Beta
              </motion.span>
            </div>
            <p className="text-white/60 text-sm">Live Receptionist Dashboard</p>
          </motion.div>

          {/* Login Form */}
          <form onSubmit={handleSignIn} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm text-center"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-500/40 text-white font-semibold hover:from-yellow-500/40 hover:to-yellow-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </motion.button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  const emailParam = email ? `?email=${encodeURIComponent(email)}` : "";
                  router.push(`/signup${emailParam}`);
                }}
                className="text-sm text-white/60 hover:text-white/80 transition-colors"
              >
                Don't have an account? Sign up
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

