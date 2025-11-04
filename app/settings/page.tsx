"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { Building2, Tag, Save, CheckCircle, XCircle, Loader2, Clock, Users, HelpCircle, Plus, X } from "lucide-react";

type Business = {
  id: string;
  name: string;
  vertical: string;
  services: string[] | null;
  address: string | null;
  hours: any;
  staff: any;
  faqs: any;
  promos: any;
};

type FAQ = {
  question: string;
  answer: string;
};

type Promo = {
  title: string;
  description: string;
};

type DayHours = {
  day: string;
  hours: string;
  closed: boolean;
};

type StaffMember = {
  name: string;
  role: string;
  hours?: string;
};

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "hours" | "content">("info");
  const [formData, setFormData] = useState({
    name: "",
    vertical: "",
    services: [] as string[],
    address: "",
    hours: [] as DayHours[],
    staff: [] as StaffMember[],
    faqs: [] as FAQ[],
    promos: [] as Promo[],
  });
  
  // Services helpers
  function addService() {
    setFormData({
      ...formData,
      services: [...formData.services, ""],
    });
  }

  function removeService(index: number) {
    setFormData({
      ...formData,
      services: formData.services.filter((_, i) => i !== index),
    });
  }

  function updateService(index: number, value: string) {
    const updated = [...formData.services];
    updated[index] = value;
    setFormData({ ...formData, services: updated });
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function loadBusiness() {
      const supabase = getSupabaseClient();
      
      // Get business_id from sessionStorage
      const businessId = sessionStorage.getItem("business_id");
      
      if (!businessId) {
        console.error("⚠️ No business_id found in sessionStorage");
        setLoading(false);
        return;
      }

      console.log("🔄 Loading business for business_id:", businessId);

      const { data: dataRaw, error } = await supabase
        .from("businesses")
        .select("id, name, vertical, services, address, hours, staff, faqs, promos")
        .eq("id", businessId)
        .maybeSingle();

      if (error) {
        console.error("❌ Error loading business:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        setLoading(false);
        return;
      }

      const data = dataRaw as Business | null;

      if (data) {
        console.log("✅ Loaded business:", data);
        setBusiness(data);
        
        // Parse hours from JSON to visual form
        let hoursData: DayHours[] = [];
        if (data.hours && typeof data.hours === "object") {
          hoursData = DAYS_OF_WEEK.map((day) => ({
            day,
            hours: data.hours[day] || "",
            closed: !data.hours[day] || data.hours[day] === "closed",
          }));
        } else {
          hoursData = DAYS_OF_WEEK.map((day) => ({
            day,
            hours: "",
            closed: false,
          }));
        }
        
        // Parse staff from JSON array to visual form
        let staffData: StaffMember[] = [];
        if (Array.isArray(data.staff)) {
          staffData = data.staff.map((s: any) => ({
            name: s.name || s.Name || "",
            role: s.role || s.Role || s.title || s.Title || "",
            hours: s.hours || s.Hours || s.available_hours || "",
          }));
        }
        
        setFormData({
          name: data.name || "",
          vertical: data.vertical || "",
          services: data.services || [],
          address: data.address || "",
          hours: hoursData,
          staff: staffData,
          faqs: Array.isArray(data.faqs) ? data.faqs : [],
          promos: Array.isArray(data.promos) ? data.promos : [],
        });
      } else {
        console.warn("⚠️ No business found for business_id:", businessId);
        // Initialize with empty hours for all days
        setFormData({
          name: "",
          vertical: "",
          services: [],
          address: "",
          hours: DAYS_OF_WEEK.map((day) => ({ day, hours: "", closed: false })),
          staff: [],
          faqs: [],
          promos: [],
        });
      }
      setLoading(false);
    }

    loadBusiness();
  }, [mounted]);

  async function handleSave() {
    if (!business) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }
    
    setSaving(true);
    setSaveStatus("idle");
    
    const supabase = getSupabaseClient();
    const businessId = sessionStorage.getItem("business_id");
    
    if (!businessId) {
      console.error("No business_id found");
      setSaveStatus("error");
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }

    // Convert visual form data to JSON format
    // Convert hours array to JSON object
    const hoursParsed: Record<string, string> = {};
    formData.hours.forEach((dayHours) => {
      if (dayHours.closed) {
        hoursParsed[dayHours.day] = "closed";
      } else if (dayHours.hours.trim()) {
        hoursParsed[dayHours.day] = dayHours.hours.trim();
      }
    });
    const hoursJson = Object.keys(hoursParsed).length > 0 ? hoursParsed : null;
    
    // Convert staff array to JSON array
    const staffParsed = formData.staff
      .filter((s) => s.name.trim() || s.role.trim())
      .map((s) => {
        const member: any = {
          name: s.name.trim(),
          role: s.role.trim(),
        };
        if (s.hours && s.hours.trim()) {
          member.hours = s.hours.trim();
        }
        return member;
      });
    const staffJson = staffParsed.length > 0 ? staffParsed : null;
    
    const { error } = await supabase
      .from("businesses")
      .update({
        name: formData.name.trim(),
        vertical: formData.vertical.trim(),
        services: formData.services.map(s => s.trim()).filter(Boolean),
        address: formData.address.trim() || null,
        hours: hoursJson,
        staff: staffJson,
        faqs: formData.faqs.length > 0 ? formData.faqs : null,
        promos: formData.promos.length > 0 ? formData.promos : null,
      })
      .eq("id", businessId);

    if (error) {
      console.error("❌ Error saving:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      setSaveStatus("error");
    } else {
      console.log("✅ Settings saved successfully");
      setSaveStatus("success");
      // Update local state
      setBusiness({
        ...business,
        name: formData.name.trim(),
        vertical: formData.vertical.trim(),
        services: formData.services.filter(Boolean),
        address: formData.address.trim() || null,
        hours: hoursJson,
        staff: staffJson,
        faqs: formData.faqs.length > 0 ? formData.faqs : null,
        promos: formData.promos.length > 0 ? formData.promos : null,
      });
    }
    
    setSaving(false);
    
    // Reset status after 3 seconds
    setTimeout(() => {
      setSaveStatus("idle");
    }, 3000);
  }

  function addFAQ() {
    setFormData({
      ...formData,
      faqs: [...formData.faqs, { question: "", answer: "" }],
    });
  }

  function removeFAQ(index: number) {
    setFormData({
      ...formData,
      faqs: formData.faqs.filter((_, i) => i !== index),
    });
  }

  function updateFAQ(index: number, field: "question" | "answer", value: string) {
    const updated = [...formData.faqs];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, faqs: updated });
  }

  function addPromo() {
    setFormData({
      ...formData,
      promos: [...formData.promos, { title: "", description: "" }],
    });
  }

  function removePromo(index: number) {
    setFormData({
      ...formData,
      promos: formData.promos.filter((_, i) => i !== index),
    });
  }

  function updatePromo(index: number, field: "title" | "description", value: string) {
    const updated = [...formData.promos];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, promos: updated });
  }

  function updateHours(dayIndex: number, field: "hours" | "closed", value: string | boolean) {
    const updated = [...formData.hours];
    updated[dayIndex] = { ...updated[dayIndex], [field]: value };
    setFormData({ ...formData, hours: updated });
  }

  function addStaff() {
    setFormData({
      ...formData,
      staff: [...formData.staff, { name: "", role: "", hours: "" }],
    });
  }

  function removeStaff(index: number) {
    setFormData({
      ...formData,
      staff: formData.staff.filter((_, i) => i !== index),
    });
  }

  function updateStaff(index: number, field: "name" | "role" | "hours", value: string) {
    const updated = [...formData.staff];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, staff: updated });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="h-8 w-8 text-yellow-400 animate-spin" />
          <div className="text-white/60">Loading business settings...</div>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: "info" as const, label: "Business Info", icon: Building2 },
    { id: "hours" as const, label: "Hours & Staff", icon: Clock },
    { id: "content" as const, label: "Content", icon: Tag },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-white">Settings</h1>
              <span className="beta-badge">Beta</span>
            </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 border-b border-white/10"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={`h-4 w-4 ${isActive ? "text-yellow-400" : "text-white/60"}`} />
              <span className={isActive ? "text-yellow-400" : "text-white/60"}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "info" && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Business Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl glass-strong border border-white/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                  <Building2 className="h-5 w-5 text-yellow-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Business Information</h2>
              </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Business Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                placeholder="Your Business Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Vertical/Industry
              </label>
              <input
                type="text"
                value={formData.vertical}
                onChange={(e) => setFormData({ ...formData, vertical: e.target.value })}
                className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                placeholder="e.g., Healthcare, Legal, Dental"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                placeholder="Business Address"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-white/80">
                  Services
                </label>
                <button
                  type="button"
                  onClick={addService}
                  className="px-2 py-1 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs text-white/80"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Service
                </button>
              </div>
              {formData.services.length === 0 ? (
                <p className="text-white/40 text-sm py-2">No services added yet. Click "Add Service" to create one.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.services.map((service, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 group"
                    >
                      <input
                        type="text"
                        value={service}
                        onChange={(e) => updateService(index, e.target.value)}
                        className="px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-w-[120px]"
                        placeholder="Service name"
                      />
                      <button
                        type="button"
                        onClick={() => removeService(index)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
          </motion.div>
        )}

        {activeTab === "hours" && (
          <motion.div
            key="hours"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Business Hours */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl glass-strong border border-white/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                  <Clock className="h-5 w-5 text-yellow-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Business Hours</h2>
              </div>
              <div className="space-y-2">
                {formData.hours.map((dayHours, index) => (
                  <motion.div
                    key={dayHours.day}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex items-center gap-4 p-4 rounded-xl glass border transition-all ${
                      dayHours.closed
                        ? "border-white/5 bg-white/2"
                        : "border-white/10 hover:border-yellow-500/30 hover:bg-white/5"
                    }`}
                  >
                    <div className="w-28 flex-shrink-0">
                      <span className={`text-sm font-semibold capitalize ${
                        dayHours.closed ? "text-white/40" : "text-white/90"
                      }`}>
                        {dayHours.day}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={dayHours.closed}
                          onChange={(e) => updateHours(index, "closed", e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-yellow-400 focus:ring-yellow-500/50 cursor-pointer"
                        />
                        <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                          Closed
                        </span>
                      </label>
                      {!dayHours.closed && (
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={dayHours.hours}
                            onChange={(e) => updateHours(index, "hours", e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                            placeholder="9am-5pm"
                          />
                        </div>
                      )}
                      {dayHours.closed && (
                        <div className="flex-1 flex items-center">
                          <span className="px-3 py-2 rounded-lg bg-white/5 text-white/40 text-sm border border-white/10">
                            Closed
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Staff */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl glass-strong border border-white/10"
            >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                <Users className="h-5 w-5 text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Staff</h2>
            </div>
            <button
              onClick={addStaff}
              className="px-3 py-1.5 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-sm text-white/80"
            >
              <Plus className="h-4 w-4" />
              Add Staff
            </button>
          </div>
          <div className="space-y-3">
            {formData.staff.length === 0 ? (
              <p className="text-white/40 text-sm">No staff added yet. Click "Add Staff" to create one.</p>
            ) : (
              formData.staff.map((member, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl glass border border-white/10 hover:border-yellow-500/30 hover:bg-white/5 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">
                          Name
                        </label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateStaff(index, "name", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">
                          Role
                        </label>
                        <input
                          type="text"
                          value={member.role}
                          onChange={(e) => updateStaff(index, "role", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                          placeholder="Receptionist"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">
                          Hours Available <span className="text-white/40">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={member.hours || ""}
                          onChange={(e) => updateStaff(index, "hours", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                          placeholder="Mon-Fri 9am-5pm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeStaff(index)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0 mt-6"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
          </motion.div>
        )}

        {activeTab === "content" && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* FAQs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl glass-strong border border-white/10"
            >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                <HelpCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">FAQs</h2>
            </div>
            <button
              onClick={addFAQ}
              className="px-3 py-1.5 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-sm text-white/80"
            >
              <Plus className="h-4 w-4" />
              Add FAQ
            </button>
          </div>
          <div className="space-y-4">
            {formData.faqs.length === 0 ? (
              <p className="text-white/40 text-sm">No FAQs added yet. Click "Add FAQ" to create one.</p>
            ) : (
              formData.faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl glass border border-white/10 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">
                          Question
                        </label>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => updateFAQ(index, "question", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                          placeholder="Enter question..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">
                          Answer
                        </label>
                        <textarea
                          value={faq.answer}
                          onChange={(e) => updateFAQ(index, "answer", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-h-[60px]"
                          placeholder="Enter answer..."
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeFAQ(index)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

            {/* Promotions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl glass-strong border border-white/10"
            >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                <Tag className="h-5 w-5 text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Promotions</h2>
            </div>
            <button
              onClick={addPromo}
              className="px-3 py-1.5 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-sm text-white/80"
            >
              <Plus className="h-4 w-4" />
              Add Promo
            </button>
          </div>
          <div className="space-y-4">
            {formData.promos.length === 0 ? (
              <p className="text-white/40 text-sm">No promotions added yet. Click "Add Promo" to create one.</p>
            ) : (
              formData.promos.map((promo, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl glass border border-white/10 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">
                          Title
                        </label>
                        <input
                          type="text"
                          value={promo.title}
                          onChange={(e) => updatePromo(index, "title", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                          placeholder="Enter promotion title..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">
                          Description
                        </label>
                        <textarea
                          value={promo.description}
                          onChange={(e) => updatePromo(index, "description", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-h-[60px]"
                          placeholder="Enter promotion description..."
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removePromo(index)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button - Always Visible */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end gap-3 pt-6 border-t border-white/10"
      >
          <AnimatePresence>
            {saveStatus === "success" && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm"
              >
                <CheckCircle className="h-4 w-4" />
                Settings saved successfully
              </motion.div>
            )}
            {saveStatus === "error" && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
              >
                <XCircle className="h-4 w-4" />
                Failed to save settings
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileHover={{ scale: saving ? 1 : 1.02 }}
            whileTap={{ scale: saving ? 1 : 0.98 }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 text-white font-medium hover:from-yellow-500/30 hover:to-yellow-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </motion.button>
      </motion.div>
    </div>
  );
}
