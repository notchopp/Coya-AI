"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { 
  Building2,
  Phone,
  TrendingUp,
  Edit,
  Save,
  X,
  Plus,
  BarChart3,
  Users,
  Calendar,
  DollarSign,
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";

type Program = {
  id: string;
  name: string;
  extension: string | null;
  business_id: string;
  business_name?: string;
  description: string | null;
  vertical: string | null;
  address: string | null;
  hours: any;
  services: any;
  staff: any;
  faqs: any;
  promos: any;
  insurances: any;
  settings: any;
  created_at: string;
};

type ProgramStats = {
  totalCalls: number;
  totalBookings: number;
  conversionRate: number;
  revenue: number;
  avgCallDuration: number;
};

export default function ProgramsManagementPage() {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [programStats, setProgramStats] = useState<Record<string, ProgramStats>>({});
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadPrograms();
  }, []);

  async function loadPrograms() {
    setLoading(true);
    const supabase = getSupabaseAdminClient();

    const { data, error } = await (supabase
      .from("programs") as any)
      .select(`
        *,
        businesses!inner(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading programs:", error);
      setLoading(false);
      return;
    }

    const programsWithBusiness = (data || []).map((p: any) => ({
      ...p,
      business_name: p.businesses?.name || null,
    }));

    setPrograms(programsWithBusiness);
    
    // Load stats for each program
    for (const program of programsWithBusiness) {
      await loadProgramStats(program.id);
    }
    
    setLoading(false);
  }

  async function loadProgramStats(programId: string) {
    const supabase = getSupabaseAdminClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get calls for this program
    const { data: calls } = await (supabase
      .from("calls") as any)
      .select("id, schedule, success, duration_sec")
      .eq("program_id", programId)
      .gte("started_at", thirtyDaysAgo.toISOString());

    const callsData = (calls || []) as Array<{ id: string; schedule: any; success: boolean | null; duration_sec: number | null }>;
    const totalCalls = callsData.length;
    const totalBookings = callsData.filter(c => c.schedule !== null).length;
    const conversionRate = totalCalls > 0 ? (totalBookings / totalCalls) * 100 : 0;
    const revenue = totalBookings * 300; // Estimated $300 per booking
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

  async function handleSaveProgram(program: Program) {
    setSaving(true);
    const supabase = getSupabaseAdminClient();

    const updateData: any = {
      name: program.name,
      extension: program.extension,
      description: program.description,
      vertical: program.vertical,
      address: program.address,
      hours: program.hours,
      services: program.services,
      staff: program.staff,
      faqs: program.faqs,
      promos: program.promos,
      insurances: program.insurances,
      settings: program.settings,
    };

    const { error } = await (supabase
      .from("programs") as any)
      .update(updateData)
      .eq("id", program.id);

    if (error) {
      console.error("Error saving program:", error);
      alert("Failed to save program");
    } else {
      setEditingProgram(null);
      await loadPrograms();
    }

    setSaving(false);
  }

  const filteredPrograms = programs.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.extension?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white/60">Loading programs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => router.push("/ops")}
            className="flex items-center gap-2 text-white/60 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Operations</span>
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Program Management</h1>
              <p className="text-white/60 text-sm sm:text-base">
                Manage all programs across businesses
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search programs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40"
              />
            </div>
          </div>
        </div>

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
          {filteredPrograms.map((program, index) => {
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
                  {/* Program Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingProgram.name}
                            onChange={(e) => setEditingProgram({ ...editingProgram, name: e.target.value })}
                            className="text-xl font-bold text-white bg-white/10 border border-white/20 rounded px-3 py-1 mb-2 focus:outline-none focus:border-white/40"
                          />
                        ) : (
                          <h3 className="text-xl font-bold text-white mb-2">{program.name}</h3>
                        )}
                        <div className="flex items-center gap-3 text-sm text-white/60">
                          <span>{program.business_name}</span>
                          {program.extension && (
                            <>
                              <span>•</span>
                              <span>Ext: {program.extension}</span>
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
                          <button
                            onClick={() => setEditingProgram({ ...program })}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="text-sm text-white/60 mb-1 block">Extension</label>
                          <input
                            type="text"
                            value={editingProgram.extension || ""}
                            onChange={(e) => setEditingProgram({ ...editingProgram, extension: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-white/60 mb-1 block">Description</label>
                          <textarea
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
          })}
        </div>

        {filteredPrograms.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-white/40" />
            <p className="text-white/60">No programs found</p>
          </div>
        )}
      </div>
    </div>
  );
}

