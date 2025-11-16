"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { updateOnboardingStep, getNextStepRoute } from "@/lib/onboarding";
import { Building2, Phone, MapPin, Globe, Loader2, ArrowRight } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";

const BUSINESS_TYPES = [
  "Therapy",
  "Psychiatry",
  "Dental",
  "Medical",
  "Legal",
  "Veterinary",
  "Fitness",
  "Beauty",
  "Other",
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export default function BusinessSetupPage() {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    vertical: "",
    phone: "",
    timezone: "America/New_York",
    locations_count: 1,
    logo_url: "",
  });

  useEffect(() => {
    async function loadBusiness() {
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");
      
      if (!businessId) {
        router.push("/login");
        return;
      }

      const result = await supabase
        .from("businesses")
        .select("name, vertical, to_number, timezone, locations_count, logo_url")
        .eq("id", businessId)
        .single();

      const data = result.data as {
        name: string | null;
        vertical: string | null;
        to_number: string | null;
        timezone: string | null;
        locations_count: number | null;
        logo_url: string | null;
      } | null;
      const error = result.error;

      if (error) {
        console.error("Error loading business:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setBusiness(data);
        setFormData({
          name: data.name || "",
          vertical: data.vertical || "",
          phone: data.to_number || "",
          timezone: data.timezone || "America/New_York",
          locations_count: data.locations_count || 1,
          logo_url: data.logo_url || "",
        });
      }

      setLoading(false);
    }

    loadBusiness();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const supabase = getSupabaseClient();
    const businessId = sessionStorage.getItem("business_id");

    if (!businessId) {
      router.push("/login");
      return;
    }

    // Update business
    const { error } = await supabase
      .from("businesses")
      .update({
        name: formData.name.trim(),
        vertical: formData.vertical || null,
        timezone: formData.timezone,
        locations_count: formData.locations_count,
        logo_url: formData.logo_url || null,
        onboarding_step: 2,
      })
      .eq("id", businessId);

    if (error) {
      console.error("Error saving business:", error);
      setSaving(false);
      return;
    }

    // Update onboarding step
    await updateOnboardingStep(businessId, 2);

    // Navigate to next step
    router.push("/onboarding/mode-selection");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-3xl p-6 sm:p-8 border border-white/10"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Let's Set Up Your Clinic</h1>
        <p className="text-white/60">
          Tell us about your business so we can personalize your AI receptionist.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Business Name *
          </label>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full pl-12 pr-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all"
              placeholder="Allure Clinic"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Business Type
          </label>
          <select
            value={formData.vertical}
            onChange={(e) => setFormData({ ...formData, vertical: e.target.value })}
            className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 transition-all"
          >
            <option value="" className="bg-gray-900">Select type...</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type.toLowerCase()} className="bg-gray-900">
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Main Phone Line
          </label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <input
              type="tel"
              value={formData.phone}
              disabled
              className="w-full pl-12 pr-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white/60 cursor-not-allowed"
              placeholder="+1234567890"
            />
          </div>
          <p className="text-xs text-white/40 mt-1">
            Configured by COYA - This is your AI receptionist's phone number
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Timezone *
          </label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <select
              required
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full pl-12 pr-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 transition-all"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-gray-900">
                  {tz.replace("America/", "").replace("Pacific/", "")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Number of Locations
          </label>
          <input
            type="number"
            min="1"
            value={formData.locations_count}
            onChange={(e) => setFormData({ ...formData, locations_count: parseInt(e.target.value) || 1 })}
            className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 transition-all"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <motion.button
            type="submit"
            disabled={saving || !formData.name}
            whileHover={{ scale: saving ? 1 : 1.02 }}
            whileTap={{ scale: saving ? 1 : 0.98 }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: `${accentColor}33`,
              borderColor: `${accentColor}4D`,
              color: accentColor,
            }}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}

