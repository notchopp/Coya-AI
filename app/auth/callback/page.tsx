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
        // Supabase can pass code in different ways: as query param or hash fragment
        let code: string | null = searchParams.get("code");
        let type: string | null = searchParams.get("type");
        
        // If not in query params, check hash fragment (Supabase sometimes uses this)
        if (!code && typeof window !== "undefined") {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          code = hashParams.get("code") || code;
          type = hashParams.get("type") || type;
        }
        
        // Debug logging
        if (typeof window !== "undefined") {
          console.log("🔍 Full URL:", window.location.href);
          console.log("🔍 Hash:", window.location.hash);
          console.log("🔍 Search:", window.location.search);
          console.log("🔍 Code found:", code);
          console.log("🔍 Type found:", type);
        }
        
        if (!code) {
          // Try using Supabase's built-in session recovery
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (session && session.user) {
            console.log("✅ Found existing session, user:", session.user.email);
            // User already has a session, proceed with password setup if needed
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user && (!user.email_confirmed_at || type === "invite")) {
              setEmail(user.email || "");
              setNeedsPassword(true);
              setLoading(false);
              return;
            }
          } else {
            setError("Invalid invitation link. No code provided. Please check that the redirect URL is correctly configured in Supabase Dashboard → Authentication → URL Configuration.");
            setLoading(false);
            return;
          }
          // If we reach here, we should have returned above
          return;
        }

        // Exchange the code for a session
        // TypeScript now knows code is string (not null) due to the check above
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error("Auth exchange error:", exchangeError);
          setError(exchangeError.message || "Failed to verify invitation. Please try again.");
          setLoading(false);
          return;
        }

        if (data?.user) {
          // After exchanging code, check if user needs to set password
          // For invite flow, user might not have a password set yet
          const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser();
          
          if (getUserError) {
            console.error("Get user error:", getUserError);
            setError("Failed to retrieve user information.");
            setLoading(false);
            return;
          }

          // Check if this is an invite flow - user might need to set password
          // Supabase invite users typically don't have email_confirmed_at set until password is set
          if (currentUser && (!currentUser.email_confirmed_at || type === "invite")) {
            // User needs to set password
            setEmail(currentUser.email || "");
            setNeedsPassword(true);
            setLoading(false);
            return;
          }

          // User is authenticated, check if they need to set password first
          // For invite flow, they should set password before accessing dashboard
          // This check is already handled above, so if we reach here, user is fully set up
          
          // Get their business_id from users table
          let { data: userData, error: userError } = await supabase
            .from("users")
            .select("business_id, is_active, role")
            .eq("auth_user_id", data.user.id)
            .maybeSingle();

          // If user doesn't exist by auth_user_id, try to find by email or create from metadata
          if (userError || !userData) {
            if (data.user.email) {
              // Try to find user by email (might have been pre-created)
              const { data: emailUserData, error: emailError } = await supabase
                .from("users")
                .select("business_id, is_active, role, auth_user_id")
                .eq("email", data.user.email)
                .maybeSingle();

              if (emailUserData && !emailUserData.auth_user_id) {
                // User exists but doesn't have auth_user_id yet - update it
                const { data: updatedUser, error: updateError } = await supabase
                  .from("users")
                  .update({ auth_user_id: data.user.id })
                  .eq("email", data.user.email)
                  .select("business_id, is_active, role")
                  .single();

                if (updateError) {
                  console.error("Error updating user auth_user_id:", updateError);
                  setError("Failed to link account. Please contact your administrator.");
                  setLoading(false);
                  return;
                }

                userData = updatedUser;
              } else if (emailUserData && emailUserData.auth_user_id === data.user.id) {
                // User found by email with matching auth_user_id
                userData = emailUserData;
              } else {
                // No user found by email, try to create from metadata
                const businessId = data.user.user_metadata?.business_id || data.user.app_metadata?.business_id;
                
                if (businessId) {
                  // Create user record
                  const { data: newUserData, error: createError } = await supabase
                    .from("users")
                    .insert({
                      auth_user_id: data.user.id,
                      business_id: businessId,
                      email: data.user.email,
                      is_active: true,
                      role: data.user.user_metadata?.role || null,
                    })
                    .select("business_id, is_active, role")
                    .single();

                  if (createError) {
                    console.error("Error creating user record:", createError);
                    setError("Failed to create user account. Please contact your administrator.");
                    setLoading(false);
                    return;
                  }

                  userData = newUserData;
                } else {
                  setError("User account not found. Please contact your administrator to complete account setup. They may need to create your user record first.");
                  setLoading(false);
                  return;
                }
              }
            } else {
              setError("Email address not found. Please contact your administrator.");
              setLoading(false);
              return;
            }
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

      // Check if user exists in users table by auth_user_id
      let { data: userData, error: userError } = await supabase
        .from("users")
        .select("business_id, is_active, role")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      // If user doesn't exist by auth_user_id, try to find by email (user might have been pre-created)
      if (userError || !userData) {
        if (user.email) {
          const { data: emailUserData, error: emailError } = await supabase
            .from("users")
            .select("business_id, is_active, role, auth_user_id")
            .eq("email", user.email)
            .maybeSingle();

          if (emailUserData && !emailUserData.auth_user_id) {
            // User exists but doesn't have auth_user_id yet - update it
            const { data: updatedUser, error: updateError } = await supabase
              .from("users")
              .update({ auth_user_id: user.id })
              .eq("email", user.email)
              .select("business_id, is_active, role")
              .single();

            if (updateError) {
              console.error("Error updating user auth_user_id:", updateError);
              setError("Failed to link account. Please contact your administrator.");
              setSettingPassword(false);
              return;
            }

            userData = updatedUser;
          } else if (emailUserData && emailUserData.auth_user_id === user.id) {
            // User found by email with matching auth_user_id
            userData = emailUserData;
          } else {
            // No user found by email, try to create from metadata
            const businessId = user.user_metadata?.business_id || user.app_metadata?.business_id;
            
            if (businessId) {
              // Create user record in users table
              const { data: newUserData, error: createError } = await supabase
                .from("users")
                .insert({
                  auth_user_id: user.id,
                  business_id: businessId,
                  email: user.email,
                  is_active: true,
                  role: user.user_metadata?.role || null,
                })
                .select("business_id, is_active, role")
                .single();

              if (createError) {
                console.error("Error creating user record:", createError);
                setError("Failed to create user account. Please contact your administrator.");
                setSettingPassword(false);
                return;
              }

              userData = newUserData;
            } else {
              // No business_id in metadata and no user record found
              setError("User account not found. Please contact your administrator to complete account setup. They may need to create your user record first.");
              setSettingPassword(false);
              return;
            }
          }
        } else {
          setError("Email address not found. Please contact your administrator.");
          setSettingPassword(false);
          return;
        }
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

