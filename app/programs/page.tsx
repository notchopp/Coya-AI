"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { 
  Building2,
  Phone,
  TrendingUp,
  Edit,
  Save,
  X,
  Calendar,
  DollarSign,
  Loader2,
  Plus,
  Trash2,
  Store,
  Tag,
  Clock,
  HelpCircle,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import { useUserRole } from "@/lib/useUserRole";
import { useProgram } from "@/components/ProgramProvider";

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

type Program = {
  id: string;
  name: string;
  extension: string | null;
  phone_number: string | null;
  business_id: string;
  description: string | null;
  services: any;
  staff: any;
  hours: any;
  faqs: any;
  promos: any;
  created_at: string;
};

type Business = {
  id: string;
  name: string | null;
  to_number: string | null;
  vertical: string | null;
  address: string | null;
  program_id: string | null;
};

type ProgramStats = {
  totalCalls: number;
  totalBookings: number;
  conversionRate: number;
  revenue: number;
  avgCallDuration: number;
};

export default function ProgramsPage() {
  const { accentColor } = useAccentColor();
  const { role: userRole } = useUserRole();
  const isAdmin = userRole === "admin";
  const { businessId } = useProgram();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [newProgram, setNewProgram] = useState<Partial<Program>>({
    name: "",
    extension: "",
    phone_number: "",
    description: "",
  });
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [programStats, setProgramStats] = useState<Record<string, ProgramStats>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"programs" | "business">("programs");

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    loadData();
  }, [isAdmin, businessId]);

  async function loadData() {
    const storedBusinessId = businessId || sessionStorage.getItem("business_id");
    if (!storedBusinessId) {
      setLoading(false);
      return;
    }
    await Promise.all([
      loadProgramsForBusiness(storedBusinessId),
      loadBusiness(storedBusinessId),
    ]);
  }

  async function loadBusiness(businessId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, to_number, vertical, address, program_id")
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      console.error("Error loading business:", error);
    } else {
      setBusiness(data as Business | null);
    }
  }

  async function loadProgramsForBusiness(businessId: string) {
    setLoading(true);
    const supabase = getSupabaseClient();

    const { data, error } = await (supabase as any)
      .from("programs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading programs:", error);
      setLoading(false);
      return;
    }

    const programsData = data || [];
    setPrograms(programsData);
    
    // Load stats for each program
    for (const program of programsData) {
      await loadProgramStats(program.id);
    }
    
    setLoading(false);
  }

  async function loadProgramStats(programId: string) {
    const supabase = getSupabaseClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: calls } = await (supabase as any)
      .from("calls")
      .select("id, schedule, success, duration_sec")
      .eq("program_id", programId)
      .gte("started_at", thirtyDaysAgo.toISOString());

    const callsData = (calls || []) as Array<{ id: string; schedule: any; success: boolean | null; duration_sec: number | null }>;
    const totalCalls = callsData.length;
    const totalBookings = callsData.filter(c => c.schedule !== null).length;
    const conversionRate = totalCalls > 0 ? (totalBookings / totalCalls) * 100 : 0;
    const revenue = totalBookings * 300;
    const avgCallDuration = callsData.length > 0
      ? callsData.reduce((sum, c) => sum + (c.duration_sec || 0), 0) / callsData.length
      : 0;

    setProgramStats(prev => ({
      ...prev,
      [programId]: {
        totalCalls,
        totalBookings,
        conversionRate,
        revenue,
        avgCallDuration,
      },
    }));
  }

  async function handleCreateProgram() {
    const storedBusinessId = businessId || sessionStorage.getItem("business_id");
    if (!storedBusinessId || !newProgram.name) {
      alert("Program name is required");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/programs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newProgram.name,
          extension: newProgram.extension || null,
          phone_number: newProgram.phone_number || null,
          description: newProgram.description || null,
          business_id: storedBusinessId,
          services: null,
          staff: null,
          hours: null,
          faqs: null,
          promos: null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error creating program:", result);
        alert(result.error || "Failed to create program");
        setSaving(false);
        return;
      } else {
        setCreatingProgram(false);
        setNewProgram({ name: "", extension: "", phone_number: "", description: "" });
        // Force reload by resetting loading state
        setLoading(true);
        await loadProgramsForBusiness(storedBusinessId);
      }
    } catch (error) {
      console.error("Error creating program:", error);
      alert("Failed to create program");
    }

    setSaving(false);
  }

  async function handleSaveProgram(program: Program) {
    setSaving(true);

    try {
      const response = await fetch("/api/programs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: program.id,
          name: program.name,
          extension: program.extension,
          phone_number: program.phone_number,
          description: program.description,
          services: program.services,
          staff: program.staff,
          hours: program.hours,
          faqs: program.faqs,
          promos: program.promos,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error saving program:", result);
        alert(result.error || "Failed to save program");
      } else {
        setEditingProgram(null);
        await loadProgramsForBusiness(program.business_id);
      }
    } catch (error) {
      console.error("Error saving program:", error);
      alert("Failed to save program");
    }

    setSaving(false);
  }

  async function handleDeleteProgram(programId: string) {
    if (!confirm("Are you sure you want to delete this program? This action cannot be undone.")) {
      return;
    }

    setDeleting(programId);

    try {
      const response = await fetch(`/api/programs?id=${programId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error deleting program:", result);
        alert(result.error || "Failed to delete program");
      } else {
        await loadProgramsForBusiness(businessId || sessionStorage.getItem("business_id") || "");
      }
    } catch (error) {
      console.error("Error deleting program:", error);
      alert("Failed to delete program");
    }

    setDeleting(null);
  }

  async function handleSaveBusiness(business: Business) {
    setSaving(true);
    const supabase = getSupabaseClient();

    const updateData: any = {
      name: business.name,
      to_number: business.to_number,
      vertical: business.vertical,
      address: business.address,
      program_id: business.program_id,
    };

    const { error } = await (supabase as any)
      .from("businesses")
      .update(updateData)
      .eq("id", business.id);

    if (error) {
      console.error("Error saving business:", error);
      alert("Failed to save business");
    } else {
      setEditingBusiness(null);
      await loadBusiness(business.id);
    }

    setSaving(false);
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/60">You need admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: accentColor }} />
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Programs & Business</h1>
              <p className="text-white/60 text-sm sm:text-base">
                Manage your business programs and settings
              </p>
            </div>
            {activeTab === "programs" && (
              <button
                onClick={() => setCreatingProgram(true)}
                className="px-4 py-2 rounded-lg border text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                style={{ borderColor: accentColor }}
              >
                <Plus className="h-4 w-4" />
                Add Program
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10">
            <button
              onClick={() => setActiveTab("programs")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "programs"
                  ? "text-white border-b-2"
                  : "text-white/60 hover:text-white/80"
              }`}
              style={activeTab === "programs" ? { borderColor: accentColor } : {}}
            >
              Programs
            </button>
            <button
              onClick={() => setActiveTab("business")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "business"
                  ? "text-white border-b-2"
                  : "text-white/60 hover:text-white/80"
              }`}
              style={activeTab === "business" ? { borderColor: accentColor } : {}}
            >
              Business Settings
            </button>
          </div>
        </motion.div>

        {/* Create Program Modal */}
        <AnimatePresence>
          {creatingProgram && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => !saving && setCreatingProgram(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-md w-full"
                style={{ borderColor: `${accentColor}33` }}
              >
                <h3 className="text-xl font-bold text-white mb-4">Create New Program</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="new-program-name" className="block text-sm text-white/60 mb-1">Name *</label>
                    <input
                      type="text"
                      id="new-program-name"
                      name="new-program-name"
                      value={newProgram.name || ""}
                      onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                      placeholder="Program Name"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-program-extension" className="block text-sm text-white/60 mb-1">Extension</label>
                    <input
                      type="text"
                      id="new-program-extension"
                      name="new-program-extension"
                      value={newProgram.extension || ""}
                      onChange={(e) => setNewProgram({ ...newProgram, extension: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                      placeholder="Extension"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-program-phone" className="block text-sm text-white/60 mb-1">Phone Number</label>
                    <input
                      type="text"
                      id="new-program-phone"
                      name="new-program-phone"
                      value={newProgram.phone_number || ""}
                      onChange={(e) => setNewProgram({ ...newProgram, phone_number: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                      placeholder="Phone Number"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-program-description" className="block text-sm text-white/60 mb-1">Description</label>
                    <textarea
                      id="new-program-description"
                      name="new-program-description"
                      value={newProgram.description || ""}
                      onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                      rows={3}
                      placeholder="Description"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={handleCreateProgram}
                    disabled={saving || !newProgram.name}
                    className="px-4 py-2 rounded-lg text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Create
                  </button>
                  <button
                    onClick={() => setCreatingProgram(false)}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Programs Tab */}
        {activeTab === "programs" && (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="h-5 w-5" style={{ color: accentColor }} />
                  <div className="text-sm text-white/60">Total Programs</div>
                </div>
                <div className="text-2xl font-bold text-white">{programs.length}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="h-5 w-5" style={{ color: accentColor }} />
                  <div className="text-sm text-white/60">Total Calls (30d)</div>
                </div>
                <div className="text-2xl font-bold text-white">
                  {Object.values(programStats).reduce((sum, stats) => sum + stats.totalCalls, 0)}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="h-5 w-5" style={{ color: accentColor }} />
                  <div className="text-sm text-white/60">Total Bookings (30d)</div>
                </div>
                <div className="text-2xl font-bold text-white">
                  {Object.values(programStats).reduce((sum, stats) => sum + stats.totalBookings, 0)}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="h-5 w-5" style={{ color: accentColor }} />
                  <div className="text-sm text-white/60">Est. Revenue (30d)</div>
                </div>
                <div className="text-2xl font-bold text-white">
                  ${Object.values(programStats).reduce((sum, stats) => sum + stats.revenue, 0).toLocaleString()}
                </div>
              </motion.div>
            </div>

            {/* Programs List */}
            <div className="space-y-4">
              {programs.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-8 rounded-xl bg-white/5 border border-white/10 text-center"
                >
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-white/40" />
                  <h3 className="text-xl font-bold text-white mb-2">No Programs Yet</h3>
                  <p className="text-white/60 mb-4">Create your first program to get started.</p>
                  <button
                    onClick={() => setCreatingProgram(true)}
                    className="px-4 py-2 rounded-lg border text-white hover:bg-white/10 transition-colors"
                    style={{ borderColor: accentColor }}
                  >
                    <Plus className="h-4 w-4 inline mr-2" />
                    Create Program
                  </button>
                </motion.div>
              ) : (
                programs.map((program, index) => {
                  const stats = programStats[program.id] || {
                    totalCalls: 0,
                    totalBookings: 0,
                    conversionRate: 0,
                    revenue: 0,
                    avgCallDuration: 0,
                  };
                  const isEditing = editingProgram?.id === program.id;

                  return (
                    <motion.div
                      key={program.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              {isEditing ? (
                                <input
                                  type="text"
                                  id={`program-name-${program.id}`}
                                  name={`program-name-${program.id}`}
                                  value={editingProgram.name}
                                  onChange={(e) => setEditingProgram({ ...editingProgram, name: e.target.value })}
                                  className="text-xl font-bold text-white bg-white/10 border border-white/20 rounded px-3 py-1 mb-2 focus:outline-none focus:border-white/40"
                                />
                              ) : (
                                <h3 className="text-xl font-bold text-white mb-2">{program.name}</h3>
                              )}
                              <div className="flex items-center gap-3 text-sm text-white/60">
                                {program.extension && <span>Ext: {program.extension}</span>}
                                {program.phone_number && (
                                  <>
                                    {program.extension && <span>•</span>}
                                    <span>{program.phone_number}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveProgram(editingProgram)}
                                    disabled={saving}
                                    className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 transition-colors"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingProgram(null)}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      // Ensure hours is properly initialized as an object
                                      const programWithHours = {
                                        ...program,
                                        hours: program.hours && typeof program.hours === "object" ? program.hours : (program.hours || {})
                                      };
                                      setEditingProgram(programWithHours);
                                    }}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProgram(program.id)}
                                    disabled={deleting === program.id}
                                    className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                                  >
                                    {deleting === program.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {isEditing && editingProgram && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-4 mb-4 p-4 rounded-xl bg-white/5 border border-white/10"
                            >
                              {/* Basic Info */}
                              <div className="space-y-3">
                                <div>
                                  <label htmlFor={`program-extension-${program.id}`} className="block text-xs font-medium text-white/80 mb-1.5">Extension</label>
                                  <input
                                    type="text"
                                    id={`program-extension-${program.id}`}
                                    name={`program-extension-${program.id}`}
                                    value={editingProgram.extension || ""}
                                    onChange={(e) => setEditingProgram({ ...editingProgram, extension: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                    placeholder="Extension"
                                  />
                                </div>
                                <div>
                                  <label htmlFor={`program-phone-${program.id}`} className="block text-xs font-medium text-white/80 mb-1.5">Phone Number</label>
                                  <input
                                    type="text"
                                    id={`program-phone-${program.id}`}
                                    name={`program-phone-${program.id}`}
                                    value={editingProgram.phone_number || ""}
                                    onChange={(e) => setEditingProgram({ ...editingProgram, phone_number: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                    placeholder="Phone Number"
                                  />
                                </div>
                                <div>
                                  <label htmlFor={`program-description-${program.id}`} className="block text-xs font-medium text-white/80 mb-1.5">Description</label>
                                  <textarea
                                    id={`program-description-${program.id}`}
                                    name={`program-description-${program.id}`}
                                    value={editingProgram.description || ""}
                                    onChange={(e) => setEditingProgram({ ...editingProgram, description: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                    rows={2}
                                    placeholder="Description"
                                  />
                                </div>
                              </div>

                              {/* Services */}
                              <div className="pt-3 border-t border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg border" style={{ background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`, borderColor: `${accentColor}4D` }}>
                                      <Tag className="h-3.5 w-3.5" style={{ color: accentColor }} />
                                    </div>
                                    <h4 className="text-sm font-semibold text-white">Services</h4>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const currentServices = Array.isArray(editingProgram.services) ? editingProgram.services : [];
                                      setEditingProgram({ ...editingProgram, services: [...currentServices, ""] });
                                    }}
                                    className="px-2 py-1 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs text-white/80"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {(Array.isArray(editingProgram.services) && editingProgram.services.length > 0) ? (
                                    editingProgram.services.map((service: string, idx: number) => (
                                      <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center gap-2 group"
                                      >
                                        <label htmlFor={`service-${idx}-${program.id}`} className="sr-only">Service Name</label>
                                        <input
                                          type="text"
                                          id={`service-${idx}-${program.id}`}
                                          name={`service-${idx}-${program.id}`}
                                          value={service}
                                          onChange={(e) => {
                                            const currentServices = Array.isArray(editingProgram.services) ? editingProgram.services : [];
                                            const updatedServices = currentServices.map((s, i) => (i === idx ? e.target.value : s));
                                            setEditingProgram({ ...editingProgram, services: updatedServices });
                                          }}
                                          className="px-3 py-1.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-w-[120px]"
                                          placeholder="Service name"
                                        />
                                        <button
                                          onClick={() => {
                                            const currentServices = Array.isArray(editingProgram.services) ? editingProgram.services : [];
                                            const updatedServices = currentServices.filter((_, i) => i !== idx);
                                            setEditingProgram({ ...editingProgram, services: updatedServices });
                                          }}
                                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </motion.div>
                                    ))
                                  ) : (
                                    <p className="text-white/40 text-xs">No services added yet.</p>
                                  )}
                                </div>
                              </div>

                              {/* Staff */}
                              <div className="pt-3 border-t border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg border" style={{ background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`, borderColor: `${accentColor}4D` }}>
                                      <User className="h-3.5 w-3.5" style={{ color: accentColor }} />
                                    </div>
                                    <h4 className="text-sm font-semibold text-white">Staff</h4>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const currentStaff = Array.isArray(editingProgram.staff) ? editingProgram.staff : [];
                                      setEditingProgram({ ...editingProgram, staff: [...currentStaff, { name: "", role: "", hours: "" }] });
                                    }}
                                    className="px-2 py-1 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs text-white/80"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {(Array.isArray(editingProgram.staff) && editingProgram.staff.length > 0) ? (
                                    editingProgram.staff.map((member: any, idx: number) => (
                                      <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-2.5 rounded-lg glass border border-white/10 hover:border-yellow-500/30 hover:bg-white/5 transition-all space-y-2"
                                      >
                                        <div className="flex items-center gap-2">
                                          <label htmlFor={`staff-name-${idx}-${program.id}`} className="sr-only">Staff Name</label>
                                          <input
                                            type="text"
                                            id={`staff-name-${idx}-${program.id}`}
                                            name={`staff-name-${idx}-${program.id}`}
                                            value={member.name || ""}
                                            onChange={(e) => {
                                              const currentStaff = Array.isArray(editingProgram.staff) ? editingProgram.staff : [];
                                              const updatedStaff = currentStaff.map((m, i) => i === idx ? { ...m, name: e.target.value } : m);
                                              setEditingProgram({ ...editingProgram, staff: updatedStaff });
                                            }}
                                            className="flex-1 px-2.5 py-1.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                            placeholder="Name"
                                          />
                                          <label htmlFor={`staff-role-${idx}-${program.id}`} className="sr-only">Staff Role</label>
                                          <input
                                            type="text"
                                            id={`staff-role-${idx}-${program.id}`}
                                            name={`staff-role-${idx}-${program.id}`}
                                            value={member.role || ""}
                                            onChange={(e) => {
                                              const currentStaff = Array.isArray(editingProgram.staff) ? editingProgram.staff : [];
                                              const updatedStaff = currentStaff.map((m, i) => i === idx ? { ...m, role: e.target.value } : m);
                                              setEditingProgram({ ...editingProgram, staff: updatedStaff });
                                            }}
                                            className="flex-1 px-2.5 py-1.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                            placeholder="Role"
                                          />
                                          <button
                                            onClick={() => {
                                              const currentStaff = Array.isArray(editingProgram.staff) ? editingProgram.staff : [];
                                              const updatedStaff = currentStaff.filter((_, i) => i !== idx);
                                              setEditingProgram({ ...editingProgram, staff: updatedStaff });
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                        {/* Staff Hours Section - Simple Text Input */}
                                        <div className="pt-2 border-t border-white/5">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <Clock className="h-3 w-3 text-white/60" />
                                            <label htmlFor={`staff-hours-${idx}-${program.id}`} className="text-xs font-medium text-white/80">Availability</label>
                                          </div>
                                          <input
                                            type="text"
                                            id={`staff-hours-${idx}-${program.id}`}
                                            name={`staff-hours-${idx}-${program.id}`}
                                            value={typeof member.hours === "string" ? member.hours : (typeof member.hours === "object" && member.hours !== null ? "" : (member.hours || ""))}
                                            onChange={(e) => {
                                              const currentStaff = Array.isArray(editingProgram.staff) ? editingProgram.staff : [];
                                              const updatedStaff = currentStaff.map((m, i) => 
                                                i === idx ? { ...m, hours: e.target.value } : m
                                              );
                                              setEditingProgram({ ...editingProgram, staff: updatedStaff });
                                            }}
                                            className="w-full px-2.5 py-1.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                            placeholder="e.g., MON - FRI 3PM - 5PM or OUT TODAY BACK NOV"
                                          />
                                        </div>
                                      </motion.div>
                                    ))
                                  ) : (
                                    <p className="text-white/40 text-xs">No staff added yet.</p>
                                  )}
                                </div>
                              </div>

                              {/* Hours */}
                              <div className="pt-3 border-t border-white/10">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="p-1.5 rounded-lg border" style={{ background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`, borderColor: `${accentColor}4D` }}>
                                    <Clock className="h-3.5 w-3.5" style={{ color: accentColor }} />
                                  </div>
                                  <h4 className="text-sm font-semibold text-white">Hours</h4>
                                </div>
                                <div className="space-y-2">
                                  {DAYS_OF_WEEK.map((day) => {
                                    const currentHours = (editingProgram.hours as Record<string, string>)?.[day] || "";
                                    const isClosed = currentHours === "closed" || !currentHours;
                                    return (
                                      <motion.div
                                        key={day}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`flex items-center gap-2 p-2 rounded-lg glass border transition-all ${
                                          isClosed ? "border-white/5 bg-white/2" : "border-white/10 hover:border-yellow-500/30 hover:bg-white/5"
                                        }`}
                                      >
                                        <div className="w-20 flex-shrink-0">
                                          <span className={`text-xs font-semibold capitalize ${
                                            isClosed ? "text-white/40" : "text-white/90"
                                          }`}>
                                            {day.slice(0, 3)}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-1">
                                          <label className="flex items-center gap-1.5 cursor-pointer group">
                                            <input
                                              type="checkbox"
                                              id={`closed-${day}-${program.id}`}
                                              name={`closed-${day}-${program.id}`}
                                              checked={isClosed}
                                              onChange={(e) => {
                                                const updatedHours = { ...(editingProgram.hours as Record<string, string> || {}) };
                                                if (e.target.checked) {
                                                  updatedHours[day] = "closed";
                                                } else {
                                                  delete updatedHours[day];
                                                }
                                                setEditingProgram({ ...editingProgram, hours: updatedHours });
                                              }}
                                              className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-yellow-400 focus:ring-yellow-500/50 cursor-pointer"
                                            />
                                            <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                                              Closed
                                            </span>
                                          </label>
                                          {!isClosed && (
                                            <>
                                              <label htmlFor={`hours-${day}-${program.id}`} className="sr-only">{day} hours</label>
                                              <input
                                                type="text"
                                                id={`hours-${day}-${program.id}`}
                                                name={`hours-${day}-${program.id}`}
                                                value={currentHours}
                                                onChange={(e) => {
                                                  const updatedHours = { ...(editingProgram.hours as Record<string, string> || {}) };
                                                  updatedHours[day] = e.target.value;
                                                  setEditingProgram({ ...editingProgram, hours: updatedHours });
                                                }}
                                                className="flex-1 px-2.5 py-1.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                                placeholder="9am-5pm"
                                              />
                                            </>
                                          )}
                                          {isClosed && (
                                            <span className="px-2.5 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs border border-white/10">
                                              Closed
                                            </span>
                                          )}
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* FAQs */}
                              <div className="pt-3 border-t border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg border" style={{ background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`, borderColor: `${accentColor}4D` }}>
                                      <HelpCircle className="h-3.5 w-3.5" style={{ color: accentColor }} />
                                    </div>
                                    <h4 className="text-sm font-semibold text-white">FAQs</h4>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const currentFaqs = Array.isArray(editingProgram.faqs) ? editingProgram.faqs : [];
                                      setEditingProgram({ ...editingProgram, faqs: [...currentFaqs, { question: "", answer: "" }] });
                                    }}
                                    className="px-2 py-1 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs text-white/80"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {(Array.isArray(editingProgram.faqs) && editingProgram.faqs.length > 0) ? (
                                    editingProgram.faqs.map((faq: any, idx: number) => (
                                      <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-2.5 rounded-lg glass border border-white/10 hover:border-yellow-500/30 hover:bg-white/5 transition-all space-y-2"
                                      >
                                        <label htmlFor={`faq-question-${idx}-${program.id}`} className="sr-only">FAQ Question</label>
                                        <input
                                          type="text"
                                          id={`faq-question-${idx}-${program.id}`}
                                          name={`faq-question-${idx}-${program.id}`}
                                          value={faq.question || ""}
                                          onChange={(e) => {
                                            const currentFaqs = Array.isArray(editingProgram.faqs) ? editingProgram.faqs : [];
                                            const updatedFaqs = currentFaqs.map((f, i) => i === idx ? { ...f, question: e.target.value } : f);
                                            setEditingProgram({ ...editingProgram, faqs: updatedFaqs });
                                          }}
                                          className="w-full px-2.5 py-1.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                          placeholder="Question"
                                        />
                                        <div className="flex items-center gap-2">
                                          <label htmlFor={`faq-answer-${idx}-${program.id}`} className="sr-only">FAQ Answer</label>
                                          <textarea
                                            id={`faq-answer-${idx}-${program.id}`}
                                            name={`faq-answer-${idx}-${program.id}`}
                                            value={faq.answer || ""}
                                            onChange={(e) => {
                                              const currentFaqs = Array.isArray(editingProgram.faqs) ? editingProgram.faqs : [];
                                              const updatedFaqs = currentFaqs.map((f, i) => i === idx ? { ...f, answer: e.target.value } : f);
                                              setEditingProgram({ ...editingProgram, faqs: updatedFaqs });
                                            }}
                                            className="flex-1 px-2.5 py-1.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-h-[50px]"
                                            placeholder="Answer"
                                            rows={2}
                                          />
                                          <button
                                            onClick={() => {
                                              const currentFaqs = Array.isArray(editingProgram.faqs) ? editingProgram.faqs : [];
                                              const updatedFaqs = currentFaqs.filter((_, i) => i !== idx);
                                              setEditingProgram({ ...editingProgram, faqs: updatedFaqs });
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </motion.div>
                                    ))
                                  ) : (
                                    <p className="text-white/40 text-xs">No FAQs added yet.</p>
                                  )}
                                </div>
                              </div>

                              {/* Promotions */}
                              <div className="pt-3 border-t border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg border" style={{ background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`, borderColor: `${accentColor}4D` }}>
                                      <Tag className="h-3.5 w-3.5" style={{ color: accentColor }} />
                                    </div>
                                    <h4 className="text-sm font-semibold text-white">Promotions</h4>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const currentPromos = Array.isArray(editingProgram.promos) ? editingProgram.promos : [];
                                      setEditingProgram({ ...editingProgram, promos: [...currentPromos, { title: "", description: "" }] });
                                    }}
                                    className="px-2 py-1 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs text-white/80"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {(Array.isArray(editingProgram.promos) && editingProgram.promos.length > 0) ? (
                                    editingProgram.promos.map((promo: any, idx: number) => (
                                      <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-2.5 rounded-lg glass border border-white/10 hover:border-yellow-500/30 hover:bg-white/5 transition-all space-y-2"
                                      >
                                        <label htmlFor={`promo-title-${idx}-${program.id}`} className="sr-only">Promotion Title</label>
                                        <input
                                          type="text"
                                          id={`promo-title-${idx}-${program.id}`}
                                          name={`promo-title-${idx}-${program.id}`}
                                          value={promo.title || ""}
                                          onChange={(e) => {
                                            const currentPromos = Array.isArray(editingProgram.promos) ? editingProgram.promos : [];
                                            const updatedPromos = currentPromos.map((p, i) => i === idx ? { ...p, title: e.target.value } : p);
                                            setEditingProgram({ ...editingProgram, promos: updatedPromos });
                                          }}
                                          className="w-full px-2.5 py-1.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                          placeholder="Title"
                                        />
                                        <div className="flex items-center gap-2">
                                          <label htmlFor={`promo-description-${idx}-${program.id}`} className="sr-only">Promotion Description</label>
                                          <textarea
                                            id={`promo-description-${idx}-${program.id}`}
                                            name={`promo-description-${idx}-${program.id}`}
                                            value={promo.description || ""}
                                            onChange={(e) => {
                                              const currentPromos = Array.isArray(editingProgram.promos) ? editingProgram.promos : [];
                                              const updatedPromos = currentPromos.map((p, i) => i === idx ? { ...p, description: e.target.value } : p);
                                              setEditingProgram({ ...editingProgram, promos: updatedPromos });
                                            }}
                                            className="flex-1 px-2.5 py-1.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-h-[50px]"
                                            placeholder="Description"
                                            rows={2}
                                          />
                                          <button
                                            onClick={() => {
                                              const currentPromos = Array.isArray(editingProgram.promos) ? editingProgram.promos : [];
                                              const updatedPromos = currentPromos.filter((_, i) => i !== idx);
                                              setEditingProgram({ ...editingProgram, promos: updatedPromos });
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </motion.div>
                                    ))
                                  ) : (
                                    <p className="text-white/40 text-xs">No promotions added yet.</p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {program.description && !isEditing && (
                            <p className="text-white/80 mb-4">{program.description}</p>
                          )}

                          {/* Stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-white/60 mb-1">Calls (30d)</div>
                              <div className="text-lg font-bold text-white">{stats.totalCalls}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-white/60 mb-1">Bookings (30d)</div>
                              <div className="text-lg font-bold text-white">{stats.totalBookings}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-white/60 mb-1">Conversion</div>
                              <div className="text-lg font-bold text-white">{stats.conversionRate.toFixed(1)}%</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-white/60 mb-1">Revenue (30d)</div>
                              <div className="text-lg font-bold text-white">${stats.revenue.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Business Tab */}
        {activeTab === "business" && business && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl bg-white/5 border border-white/10"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Business Information</h3>
                {!editingBusiness && (
                  <div className="text-sm text-white/60">
                    <p>Name: {business.name || "N/A"}</p>
                    <p>Phone: {business.to_number || "N/A"}</p>
                    <p>Vertical: {business.vertical || "N/A"}</p>
                    <p>Address: {business.address || "N/A"}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingBusiness ? (
                  <>
                    <button
                      onClick={() => handleSaveBusiness(editingBusiness)}
                      disabled={saving}
                      className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingBusiness(null)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditingBusiness({ ...business })}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {editingBusiness && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="business-name-edit" className="block text-sm text-white/60 mb-1">Business Name</label>
                  <input
                    type="text"
                    id="business-name-edit"
                    name="business-name-edit"
                    value={editingBusiness.name || ""}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label htmlFor="business-phone-edit" className="block text-sm text-white/60 mb-1">Phone Number</label>
                  <input
                    type="text"
                    id="business-phone-edit"
                    name="business-phone-edit"
                    value={editingBusiness.to_number || ""}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, to_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label htmlFor="business-vertical-edit" className="block text-sm text-white/60 mb-1">Vertical</label>
                  <input
                    type="text"
                    id="business-vertical-edit"
                    name="business-vertical-edit"
                    value={editingBusiness.vertical || ""}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, vertical: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label htmlFor="business-address-edit" className="block text-sm text-white/60 mb-1">Address</label>
                  <textarea
                    id="business-address-edit"
                    name="business-address-edit"
                    value={editingBusiness.address || ""}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                    rows={2}
                  />
                </div>
                <div>
                  <label htmlFor="business-program-id-edit" className="block text-sm text-white/60 mb-1">Default Program ID</label>
                  <input
                    type="text"
                    id="business-program-id-edit"
                    name="business-program-id-edit"
                    value={editingBusiness.program_id || ""}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, program_id: e.target.value || null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                    placeholder="Program UUID (optional)"
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
