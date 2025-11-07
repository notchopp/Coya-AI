"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import Coyalogo from "@/components/Coyalogo";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const supabase = getSupabaseClient();
        
        // Get the code and type from URL params
        const code = searchParams.get("code");
        const type = searchParams.get("type");
        
        if (!code) {
          setError("Invalid invitation link. No code provided.");
          setLoading(false);
          return;
        }

        // Exchange the code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error("Auth exchange error:", exchangeError);
          
          // Check if user needs to set password
          if (exchangeError.message.includes("password") || exchangeError.message.includes("set password")) {
            // Get email from the error or from the user data if available
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              setEmail(user.email);
              setNeedsPassword(true);
              setLoading(false);
              return;
            }
          }
          
          setError(exchangeError.message || "Failed to verify invitation. Please try again.");
          setLoading(false);
          return;
        }

        if (data?.user) {
          // Check if user needs to set password (user exists but password is null)
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          
          if (currentUser && !currentUser.email_confirmed_at) {
            // User needs to set password
            setEmail(currentUser.email || "");
            setNeedsPassword(true);
            setLoading(false);
            return;
          }

          // User is authenticated, get their business_id
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("business_id, is_active, role")
            .eq("auth_user_id", data.user.id)
            .maybeSingle();

          if (userError || !userData) {
            setError("User account not found. Please contact your administrator.");
            setLoading(false);
            return;
          }

          if (!userData.is_active) {
            setError("Your account has been deactivated. Please contact your administrator.");
            setLoading(false);
            return;
          }

          // Store in sessionStorage
          sessionStorage.setItem("business_id", userData.business_id);
          if (userData.role) {
            sessionStorage.setItem("user_role", userData.role);
          }

          // Redirect to dashboard
          router.push("/");
          router.refresh();
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError("An unexpected error occurred. Please try again.");
        setLoading(false);
      }
    }

    handleAuthCallback();
  }, [searchParams, router]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSettingPassword(true);

    try {
      const supabase = getSupabaseClient();
      
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || "Failed to set password. Please try again.");
        setSettingPassword(false);
        return;
      }

      // Password set successfully, get user data
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("Failed to retrieve user information.");
        setSettingPassword(false);
        return;
      }

      // Get business_id from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("business_id, is_active, role")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (userError || !userData) {
        setError("User account not found. Please contact your administrator.");
        setSettingPassword(false);
        return;
      }

      if (!userData.is_active) {
        setError("Your account has been deactivated. Please contact your administrator.");
        setSettingPassword(false);
        return;
      }

      // Store in sessionStorage
      sessionStorage.setItem("business_id", userData.business_id);
      if (userData.role) {
        sessionStorage.setItem("user_role", userData.role);
      }

      setSuccess(true);
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 2000);
    } catch (err) {
      console.error("Set password error:", err);
      setError("An unexpected error occurred. Please try again.");
      setSettingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-yellow-950/20 to-black" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-20 text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-6 flex justify-center"
          >
            <Coyalogo src="/logo.gif" size={80} />
          </motion.div>
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500 mx-auto mb-4" />
          <p className="text-white/80 text-lg">Verifying your invitation...</p>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-yellow-950/20 to-black" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-20 w-full max-w-md"
        >
          <div className="glass-strong rounded-3xl p-12 border border-white/10 shadow-2xl text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="mb-6 flex justify-center"
            >
              <CheckCircle className="h-16 w-16 text-green-500" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-4">Password Set Successfully!</h2>
            <p className="text-white/60 mb-6">Redirecting you to the dashboard...</p>
            <Loader2 className="h-6 w-6 animate-spin text-yellow-500 mx-auto" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-yellow-950/20 to-black" />
        
        {/* Logo - Top Left */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-6 left-6 z-10"
        >
          <Coyalogo src="/logo.gif" size={50} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md z-20"
        >
          <div className="glass-strong rounded-3xl p-12 border border-white/10 shadow-2xl">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center mb-8"
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-white">COYA</h1>
                <span className="text-2xl font-semibold text-yellow-400/90">AI</span>
                <span className="beta-badge self-start mt-2">Beta</span>
              </div>
              <p className="text-white/60 text-sm">Set Your Password</p>
            </motion.div>

            {/* Form */}
            <form onSubmit={handleSetPassword} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white/60 cursor-not-allowed"
                />
                <p className="text-xs text-white/40 mt-1">This is the email address you were invited with</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                  placeholder="Enter your password (min. 8 characters)"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                />
              </div>

              <motion.button
                type="submit"
                disabled={settingPassword || !password || !confirmPassword}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-500/40 text-white font-semibold hover:from-yellow-500/40 hover:to-yellow-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingPassword ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  "Set Password"
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-yellow-950/20 to-black" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-20 w-full max-w-md"
      >
        <div className="glass-strong rounded-3xl p-12 border border-white/10 shadow-2xl text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="mb-6 flex justify-center"
          >
            <XCircle className="h-16 w-16 text-red-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-4">Verification Failed</h2>
          <p className="text-white/60 mb-6">{error || "Invalid or expired invitation link."}</p>
          <motion.button
            onClick={() => router.push("/login")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-500/40 text-white font-semibold hover:from-yellow-500/40 hover:to-yellow-600/40 transition-all"
          >
            Go to Login
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

