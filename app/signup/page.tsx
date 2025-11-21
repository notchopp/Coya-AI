"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import Coyalogo from "@/components/Coyalogo";
import { Loader2 } from "lucide-react";

function SignupPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [hasExistingAccount, setHasExistingAccount] = useState(false);
  const [isFromInvite, setIsFromInvite] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [tokenVerified, setTokenVerified] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");

  // Pre-fill email from URL parameter (from login page)
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
      // Check if this email exists in users table without auth_user_id
      checkEmailForSignup(emailParam);
    }
  }, [emailParam]);

  // Check if user came from invite link
  useEffect(() => {
    if (token) {
      // User came from invite link, check if they need to set password
      setIsFromInvite(true);
      setInviteToken(token);
      checkInviteToken(token);
    }
  }, [token]);

  async function checkInviteToken(token: string) {
    try {
      const supabase = getSupabaseClient();
      // Verify the token - this creates a session if valid
      const { data, error: tokenError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "invite",
      });

      if (tokenError) {
        setError("Invalid or expired invitation link.");
        return;
      }

      if (data.user?.email) {
        const userEmail = data.user.email.toLowerCase();
        setEmail(userEmail);
        setTokenVerified(true); // Mark that we've verified the token and have a session
        
        // Extract program_id from user metadata (set during invite)
        const programId = data.user.user_metadata?.program_id || null;
        
        // Check if user exists in users table and if they have auth_user_id
        // Try to select program_id, but handle if column doesn't exist
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, email, auth_user_id, business_id, program_id")
          .eq("email", userEmail)
          .maybeSingle();
        
        // Handle case where program_id column might not exist
        if (userError && userError.message?.includes("program_id")) {
          // Retry without program_id
          const { data: userDataRetry } = await supabase
            .from("users")
            .select("id, email, auth_user_id, business_id")
            .eq("email", userEmail)
            .maybeSingle();
          
          const user = userDataRetry as { id: string; email: string; auth_user_id: string | null; business_id: string; program_id?: string | null } | null;
          
          if (user && user.auth_user_id) {
            setHasExistingAccount(true);
            setEmailExists(false);
          } else {
            setEmailExists(true);
            setLoading(false);
          }
        } else {
          const user = userData as { id: string; email: string; auth_user_id: string | null; business_id: string; program_id?: string | null } | null;
          
          if (user && user.auth_user_id) {
            // User already has a complete account - show option to sign in
            setHasExistingAccount(true);
            setEmailExists(false); // Don't show password form
          } else {
            // User exists in users table but no auth_user_id, or invite created auth user
            // Update program_id if it was in the invite metadata and user doesn't have it
            if (programId && user && !user.program_id) {
              try {
                await (supabase
                  .from("users") as any)
                  .update({ program_id: programId })
                  .eq("id", user.id);
              } catch (updateError) {
                // Column might not exist, ignore error
                console.log("Could not update program_id:", updateError);
              }
            }
            
            // Go directly to password creation screen (we already have session from token verification)
            setEmailExists(true);
            setLoading(false);
          }
        }
      }
    } catch (err) {
      setError("Failed to verify invitation.");
    }
  }

  async function checkEmailForSignup(emailToCheck: string) {
    if (!emailToCheck) {
      setError("Please enter your email address.");
      return;
    }

    setCheckingEmail(true);
    setError("");

    try {
      // Use API endpoint to check email (bypasses RLS)
      const response = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToCheck.toLowerCase() }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || result.message || "Failed to check email. Please try again.");
        setCheckingEmail(false);
        return;
      }

      if (!result.exists) {
        // Email doesn't exist in users table
        setError(result.message || "This email is not registered. Please contact your administrator to be added to the system.");
        setCheckingEmail(false);
        return;
      }

      if (result.hasAuth) {
        // User already has account - show option to sign in
        setHasExistingAccount(true);
        setEmailExists(false);
        setCheckingEmail(false);
        return;
      }

      // Email exists but no auth account - show password creation form immediately
      setEmailExists(true);
      setCheckingEmail(false);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setCheckingEmail(false);
    }
  }

  async function checkEmail() {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    await checkEmailForSignup(email);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    try {
      // Use API endpoint to check email (bypasses RLS)
      const checkResponse = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const checkResult = await checkResponse.json();

      if (!checkResponse.ok) {
        setError(checkResult.error || checkResult.message || "Failed to verify email. Please try again.");
        setLoading(false);
        return;
      }

      if (!checkResult.exists) {
        setError(checkResult.message || "This email is not registered. Please contact your administrator.");
        setLoading(false);
        return;
      }

      if (checkResult.hasAuth) {
        setError("This email already has an account. Please sign in instead.");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
        setLoading(false);
        return;
      }

      // Email exists but no auth_user_id - proceed with signup
      const user = checkResult.user as { id: string; email: string; auth_user_id: string | null; business_id: string; program_id?: string | null };
      
      const supabase = getSupabaseClient();

      // If we came from an invite and token was verified, we already have a session
      // Just update the password using updateUser
      if (isFromInvite && tokenVerified) {
        // We already have a session from token verification, just update password
        const { error: updatePasswordError } = await supabase.auth.updateUser({
          password: password
        });
        
        if (updatePasswordError) {
          setError(updatePasswordError.message || "Failed to set password. Please try again.");
          setLoading(false);
          return;
        }
        
        // Get the auth user ID
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser) {
          // Update users table with auth_user_id
          const { error: updateError } = await supabase
            .from("users")
            .update({ auth_user_id: authUser.id })
            .eq("id", user.id);

          if (updateError) {
            console.error("Error updating user auth_user_id:", updateError);
          }

          // Store in sessionStorage
          sessionStorage.setItem("business_id", user.business_id);
          
          // Store program_id if user has one
          if (user.program_id) {
            sessionStorage.setItem("program_id", user.program_id);
          }

          // Check onboarding status
          const result = await supabase
            .from("businesses")
            .select("onboarding_completed_at, onboarding_step")
            .eq("id", user.business_id)
            .maybeSingle();

          const businessData = result.data as {
            onboarding_completed_at: string | null;
            onboarding_step: number | null;
          } | null;

          // If onboarding not completed, redirect to onboarding
          if (businessData && !businessData.onboarding_completed_at) {
            const { getStepRoute } = await import("@/lib/onboarding");
            const step = (businessData.onboarding_step || 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
            const onboardingRoute = getStepRoute(step);
            router.push(onboardingRoute);
          } else {
            // Mark as new user to show welcome/tutorial page
            sessionStorage.setItem("show_welcome", "true");
            sessionStorage.setItem("show_tutorial", "true");
            // Go to dashboard (welcome page will show as modal)
            router.push("/");
          }
          router.refresh();
          setLoading(false);
          return;
        }
      }

      // Regular signup flow (not from invite)
      // Try to sign up - this will create auth user if it doesn't exist
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
        options: {
          emailRedirectTo: undefined, // Skip email confirmation for beta
          data: {
            business_id: user.business_id,
          },
        },
      });

      if (signUpError) {
        // Check if error is because user already exists in auth (from invite)
        if (signUpError.message.includes("already registered") || 
            signUpError.message.includes("User already registered") ||
            signUpError.message.includes("email address is already registered")) {
          
          // Auth user exists from invite, but users table doesn't have auth_user_id yet
          // The invite created an auth user, so signUp fails
          // Use the API endpoint to set password for invited users
          try {
            const response = await fetch("/api/set-password-invited", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: email.toLowerCase(), password: password }),
            });

            const result = await response.json();

            if (!response.ok) {
              setError(result.error || "Failed to set password. Please use the invitation link from your email.");
              setLoading(false);
              return;
            }

            // Password set successfully
            if (result.session) {
              // Session created, store business_id and program_id, then redirect
              sessionStorage.setItem("business_id", result.business_id || user.business_id);
              if (result.program_id) {
                sessionStorage.setItem("program_id", result.program_id);
              } else if (user.program_id) {
                sessionStorage.setItem("program_id", user.program_id);
              }
              
              // Mark as new user to show welcome/tutorial page
              sessionStorage.setItem("show_welcome", "true");
              sessionStorage.setItem("show_tutorial", "true");
              
              router.push("/");
              router.refresh();
            } else {
              // Password set but need to sign in
              setError("Password set successfully. Please sign in.");
              setTimeout(() => {
                router.push(`/login?email=${encodeURIComponent(email)}`);
              }, 2000);
            }
            setLoading(false);
            return;
          } catch (apiError) {
            setError("Failed to set password. Please use the invitation link from your email or contact your administrator.");
            setLoading(false);
            return;
          }
        } else {
          // Other signup error
          console.error("SignUp error:", signUpError);
          setError(signUpError.message || "Failed to create account. Please try again.");
        }
        setLoading(false);
        return;
      }

      // Check if signUp actually created a user (might return null if email confirmation is required)
      if (!authData.user) {
        setError("Account creation failed. Please try again or contact support.");
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Link auth_user_id to users table using API endpoint (bypasses RLS)
        try {
          const linkResponse = await fetch("/api/link-auth-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              user_id: user.id, 
              auth_user_id: authData.user.id 
            }),
          });

          const linkResult = await linkResponse.json();

          if (!linkResponse.ok) {
            console.error("Error linking auth_user_id:", linkResult);
            // Continue anyway - we'll try to sign in
          }
        } catch (linkError) {
          console.error("Error calling link-auth-user API:", linkError);
          // Continue anyway
        }

        // Check if we have a session - if not, sign in to create one
        if (!authData.session) {
          // Sign in to create a session
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password: password,
          });

          if (signInError) {
            console.error("Error signing in after account creation:", signInError);
            
            // If email not confirmed, try to confirm it via admin API
            if (signInError.message.includes("Email not confirmed") || signInError.message.includes("email_not_confirmed")) {
              // The link-auth-user API should have confirmed it, but if it didn't work, try again
              // For now, just show error and redirect to login
              setError("Account created. Please check your email to confirm your account, or contact support.");
              setTimeout(() => {
                router.push(`/login?email=${encodeURIComponent(email)}`);
              }, 3000);
            } else {
              setError("Account created but failed to sign in. Please try signing in manually.");
              setTimeout(() => {
                router.push(`/login?email=${encodeURIComponent(email)}`);
              }, 2000);
            }
            setLoading(false);
            return;
          }

          // Use the session from sign in
          if (signInData.session) {
            // Store in sessionStorage
            sessionStorage.setItem("business_id", user.business_id);
            
            // Store program_id if user has one
            if (user.program_id) {
              sessionStorage.setItem("program_id", user.program_id);
            }

            // Mark as new user to show welcome/tutorial page
            sessionStorage.setItem("show_welcome", "true");
            sessionStorage.setItem("show_tutorial", "true");

            // Redirect to dashboard
            router.push("/");
            router.refresh();
            setLoading(false);
            return;
          }
        } else {
          // We have a session from signUp
          // Store in sessionStorage
          sessionStorage.setItem("business_id", user.business_id);
          
          // Store program_id if user has one
          if (user.program_id) {
            sessionStorage.setItem("program_id", user.program_id);
          }

          // Mark as new user to show welcome/tutorial page
          sessionStorage.setItem("show_welcome", "true");
          sessionStorage.setItem("show_tutorial", "true");

          // Redirect to dashboard
          router.push("/");
          router.refresh();
        }
      }
    } catch (err) {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-black overflow-hidden">
      {/* Animated Gold Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Floating Gold Particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute rounded-full"
            style={{
              width: `${4 + (i % 3) * 2}px`,
              height: `${4 + (i % 3) * 2}px`,
              background: `radial-gradient(circle, #fde047, #eab308)`,
              boxShadow: `0 0 ${8 + (i % 4) * 4}px rgba(234, 179, 8, 0.6)`,
              left: `${(i * 37) % 100}%`,
              top: `${(i * 23) % 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.sin(i) * 20, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
        
        {/* Animated Gold Waves */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 20% 50%, rgba(234, 179, 8, 0.15) 0%, transparent 50%),
                         radial-gradient(ellipse at 80% 80%, rgba(253, 224, 71, 0.1) 0%, transparent 50%),
                         radial-gradient(ellipse at 50% 20%, rgba(234, 179, 8, 0.1) 0%, transparent 50%)`,
          }}
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        
        {/* Pulsing Gold Orbs */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={`orb-${i}`}
            className="absolute rounded-full blur-3xl"
            style={{
              width: `${200 + i * 100}px`,
              height: `${200 + i * 100}px`,
              background: `radial-gradient(circle, rgba(234, 179, 8, ${0.2 - i * 0.05}), transparent)`,
              left: `${20 + i * 30}%`,
              top: `${30 + i * 20}%`,
            }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 1.3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      
      {/* Logo - Top Left of Background - Always Yellow/Gold */}
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
          <Coyalogo src="/logo.gif" size={50} accentColorOverride="#eab308" />
        </motion.div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md z-20"
      >
        <div className="rounded-3xl p-12 border border-yellow-500/30 shadow-2xl backdrop-blur-xl" style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(20px)',
        }}>
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
                className="text-5xl font-bold bg-clip-text text-transparent"
                style={{
                  background: `linear-gradient(to right, #eab308, #fde047, #eab308)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                COYA AI
              </motion.h1>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="beta-badge self-start mt-2"
                style={{ color: "#eab308" }}
              >
                Beta
              </motion.span>
            </div>
            <p className="text-sm bg-clip-text text-transparent"
              style={{
                background: `linear-gradient(to right, #eab308, #fde047, #eab308)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {isFromInvite ? "Welcome! Set Up Your Account" : "Set Up Your Account"}
            </p>
          </motion.div>

          {/* Show existing account message */}
          {hasExistingAccount && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm text-center mb-6"
            >
              <p className="mb-3">You already have an account with this email.</p>
              <div className="flex gap-3">
                <motion.button
                  onClick={() => router.push(`/login?email=${encodeURIComponent(email)}`)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-2 rounded-lg bg-yellow-500/30 border border-yellow-500/40 text-white font-semibold hover:bg-yellow-500/40 transition-all"
                >
                  Sign In
                </motion.button>
                <motion.button
                  onClick={() => {
                    setHasExistingAccount(false);
                    setEmail("");
                    setEmailExists(null);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-2 rounded-lg bg-black border border-white/10 text-white font-semibold hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-all"
                >
                  Use Different Email
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Signup Form */}
          {!hasExistingAccount && emailExists === null ? (
            <form onSubmit={(e) => { e.preventDefault(); checkEmail(); }} className="space-y-6">
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
                <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-yellow-500/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                  placeholder="your@email.com"
                  autoComplete="email"
                />
              </div>

              <motion.button
                type="submit"
                disabled={checkingEmail}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-500/40 text-white font-semibold hover:from-yellow-500/40 hover:to-yellow-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingEmail ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Continue"
                )}
              </motion.button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push(`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`)}
                  className="text-sm text-white/60 hover:text-white/80 transition-colors"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-6">
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
                <label htmlFor="signup-email" className="block text-sm font-medium text-white/80 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="signup-email"
                  name="signup-email"
                  value={email}
                  disabled
                  className="w-full px-4 py-3 rounded-xl border border-yellow-500/20 text-white/60 cursor-not-allowed backdrop-blur-sm"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                />
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-white/80 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="signup-password"
                  name="signup-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl border border-yellow-500/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <p className="text-xs text-white/40 mt-1">Must be at least 8 characters</p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-white/80 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirm-password"
                  name="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl border border-yellow-500/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                  placeholder="••••••••"
                  autoComplete="new-password"
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
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </motion.button>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmailExists(null);
                    setPassword("");
                    setConfirmPassword("");
                    setError("");
                    setHasExistingAccount(false);
                  }}
                  className="text-sm text-white/60 hover:text-white/80 transition-colors block w-full"
                >
                  Use different email
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/login?email=${encodeURIComponent(email)}`)}
                  className="text-sm text-white/60 hover:text-white/80 transition-colors block w-full"
                >
                  Already have an account? Sign in instead
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    }>
      <SignupPageContent />
    </Suspense>
  );
}

