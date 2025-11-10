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
} from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import { useUserRole } from "@/lib/useUserRole";
import { useProgram } from "@/components/ProgramProvider";

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

    setPrograms(data || []);
    
    // Load stats for each program
    for (const program of (data || [])) {
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
    const supabase = getSupabaseClient();

    const { error } = await (supabase as any)
      .from("programs")
      .insert({
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
      });

    if (error) {
      console.error("Error creating program:", error);
      alert("Failed to create program");
    } else {
      setCreatingProgram(false);
      setNewProgram({ name: "", extension: "", phone_number: "", description: "" });
      await loadProgramsForBusiness(storedBusinessId);
    }

    setSaving(false);
  }

  async function handleSaveProgram(program: Program) {
    setSaving(true);
    const supabase = getSupabaseClient();

    const updateData: any = {
      name: program.name,
      extension: program.extension,
      phone_number: program.phone_number,
      description: program.description,
      services: program.services,
      staff: program.staff,
      hours: program.hours,
      faqs: program.faqs,
      promos: program.promos,
    };

    const { error } = await (supabase as any)
      .from("programs")
      .update(updateData)
      .eq("id", program.id);

    if (error) {
      console.error("Error saving program:", error);
      alert("Failed to save program");
    } else {
      setEditingProgram(null);
      await loadProgramsForBusiness(program.business_id);
    }

    setSaving(false);
  }

  async function handleDeleteProgram(programId: string) {
    if (!confirm("Are you sure you want to delete this program? This action cannot be undone.")) {
      return;
    }

    setDeleting(programId);
    const supabase = getSupabaseClient();

    const { error } = await (supabase as any)
      .from("programs")
      .delete()
      .eq("id", programId);

    if (error) {
      console.error("Error deleting program:", error);
      alert("Failed to delete program");
    } else {
      await loadProgramsForBusiness(businessId || sessionStorage.getItem("business_id") || "");
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
                    <label className="block text-sm text-white/60 mb-1">Name *</label>
                    <input
                      type="text"
                      value={newProgram.name || ""}
                      onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                      placeholder="Program Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Extension</label>
                    <input
                      type="text"
                      value={newProgram.extension || ""}
                      onChange={(e) => setNewProgram({ ...newProgram, extension: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                      placeholder="Extension"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={newProgram.phone_number || ""}
                      onChange={(e) => setNewProgram({ ...newProgram, phone_number: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                      placeholder="Phone Number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Description</label>
                    <textarea
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
                                    onClick={() => setEditingProgram({ ...program })}
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

                          {isEditing && (
                            <div className="space-y-3 mb-4">
                              <div>
                                <label className="text-sm text-white/60 mb-1 block">Extension</label>
                                <input
                                  type="text"
                                  id={`program-extension-${program.id}`}
                                  name={`program-extension-${program.id}`}
                                  value={editingProgram.extension || ""}
                                  onChange={(e) => setEditingProgram({ ...editingProgram, extension: e.target.value })}
                                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                                />
                              </div>
                              <div>
                                <label className="text-sm text-white/60 mb-1 block">Phone Number</label>
                                <input
                                  type="text"
                                  id={`program-phone-${program.id}`}
                                  name={`program-phone-${program.id}`}
                                  value={editingProgram.phone_number || ""}
                                  onChange={(e) => setEditingProgram({ ...editingProgram, phone_number: e.target.value })}
                                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                                />
                              </div>
                              <div>
                                <label className="text-sm text-white/60 mb-1 block">Description</label>
                                <textarea
                                  id={`program-description-${program.id}`}
                                  name={`program-description-${program.id}`}
                                  value={editingProgram.description || ""}
                                  onChange={(e) => setEditingProgram({ ...editingProgram, description: e.target.value })}
                                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                                  rows={2}
                                />
                              </div>
                            </div>
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
                  <label className="block text-sm text-white/60 mb-1">Business Name</label>
                  <input
                    type="text"
                    value={editingBusiness.name || ""}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editingBusiness.to_number || ""}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, to_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Vertical</label>
                  <input
                    type="text"
                    value={editingBusiness.vertical || ""}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, vertical: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Address</label>
                  <textarea
                    value={editingBusiness.address || ""}
                    onChange={(e) => setEditingBusiness({ ...editingBusiness, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Default Program ID</label>
                  <input
                    type="text"
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
