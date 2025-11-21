"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { Building2, Tag, Save, CheckCircle, XCircle, Loader2, Clock, Users, HelpCircle, Plus, X, User, Palette, Mail, UserPlus, Lock, Calendar, Link2, Trash2 } from "lucide-react";
import { ColorPicker } from "@/components/ColorPicker";
import { useAccentColor } from "@/components/AccentColorProvider";
import { useUserRole } from "@/lib/useUserRole";
import { useAuditLog } from "@/lib/useAuditLog";

type Business = {
  id: string;
  name: string | null;
  vertical: string | null;
  services: string[] | string | null;
  categories: any | null;
  mobile_services: any | null;
  packages: any | null;
  same_day_booking: boolean | null;
  address: string | null;
  hours: Record<string, string> | null;
  staff: any[] | null;
  faqs: FAQ[] | null;
  promos: Promo[] | null;
};

type Category = {
  id: string;
  name: string;
  display_order: number;
  services: Service[];
};

type Service = {
  id: string;
  name: string;
  price: number | null;
  bookable: boolean;
  requires_deposit: boolean;
  deposit_amount: number | null;
  preparation_instructions: string | null;
  aftercare_instructions: string | null;
  faqs: FAQ[];
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

// Vertical-based templates for quick setup
const VERTICAL_TEMPLATES: Record<string, { categories: Omit<Category, 'id'>[] }> = {
  medspa: {
    categories: [
      {
        name: "Injectables",
        display_order: 0,
        services: [
          {
            id: "template_svc_1",
            name: "Botox",
            price: 350,
            bookable: true,
            requires_deposit: true,
            deposit_amount: 50,
            preparation_instructions: "Avoid blood thinners 1 week before appointment. No alcohol 24 hours prior.",
            aftercare_instructions: "Don't lie down for 4 hours. Avoid touching the area. No exercise for 24 hours.",
            faqs: [
              { question: "How long does Botox last?", answer: "Botox typically lasts 3-4 months." },
              { question: "Does it hurt?", answer: "Most patients experience minimal discomfort, similar to a small pinch." }
            ]
          },
          {
            id: "template_svc_2",
            name: "Dermal Fillers",
            price: 600,
            bookable: true,
            requires_deposit: true,
            deposit_amount: 100,
            preparation_instructions: "Avoid blood thinners 1 week before. No alcohol 24 hours prior.",
            aftercare_instructions: "Avoid touching the area for 24 hours. No exercise for 48 hours.",
            faqs: []
          }
        ]
      },
      {
        name: "Facials",
        display_order: 1,
        services: [
          {
            id: "template_svc_3",
            name: "HydraFacial",
            price: 150,
            bookable: true,
            requires_deposit: false,
            deposit_amount: null,
            preparation_instructions: null,
            aftercare_instructions: "Use gentle cleanser. Avoid exfoliants for 48 hours.",
            faqs: []
          }
        ]
      }
    ]
  },
  wellness: {
    categories: [
      {
        name: "Wellness Services",
        display_order: 0,
        services: [
          {
            id: "template_svc_1",
            name: "Massage Therapy",
            price: 100,
            bookable: true,
            requires_deposit: false,
            deposit_amount: null,
            preparation_instructions: null,
            aftercare_instructions: "Drink plenty of water. Rest if needed.",
            faqs: []
          }
        ]
      }
    ]
  }
};

export default function SettingsPage() {
  const { accentColor } = useAccentColor();
  const { role: userRole, loading: roleLoading } = useUserRole();
  // Owners and admins have the same permissions for settings purposes
  const isAdmin = userRole === "admin" || userRole === "owner";
  const { logBusinessEdit } = useAuditLog();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "info" | "hours" | "content" | "appearance" | "team">("profile");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");
  const [inviteProgramId, setInviteProgramId] = useState<string | null>(null);
  const [availablePrograms, setAvailablePrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<"idle" | "success" | "error">("idle");
  const [inviteError, setInviteError] = useState("");
  const [userName, setUserName] = useState<string>("");
  const [savingUserName, setSavingUserName] = useState(false);
  const [userNameSaveStatus, setUserNameSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [calendarConnections, setCalendarConnections] = useState<Array<{ id: string; email: string; calendar_id: string; provider: string }>>([]);
  const [connectingCalendar, setConnectingCalendar] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    vertical: "",
    services: [] as string[], // Legacy - keep for backward compatibility
    categories: [] as Category[], // NEW: Categories with nested services
    mobile_services: null as any,
    packages: null as any,
    same_day_booking: true,
    address: "",
    hours: [] as DayHours[],
    staff: [] as StaffMember[],
    faqs: [] as FAQ[],
    promos: [] as Promo[],
  });
  
  // Services helpers (legacy - keep for backward compatibility)
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

  // Categories helpers
  function addCategory() {
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name: "",
      display_order: formData.categories.length,
      services: [],
    };
    setFormData({
      ...formData,
      categories: [...formData.categories, newCategory],
    });
  }

  function removeCategory(categoryIndex: number) {
    setFormData({
      ...formData,
      categories: formData.categories.filter((_, i) => i !== categoryIndex),
    });
  }

  function updateCategory(categoryIndex: number, field: "name" | "display_order", value: string | number) {
    const updated = [...formData.categories];
    updated[categoryIndex] = { ...updated[categoryIndex], [field]: value };
    setFormData({ ...formData, categories: updated });
  }

  function addServiceToCategory(categoryIndex: number) {
    const newService: Service = {
      id: `svc_${Date.now()}`,
      name: "",
      price: null,
      bookable: true,
      requires_deposit: false,
      deposit_amount: null,
      preparation_instructions: null,
      aftercare_instructions: null,
      faqs: [],
    };
    const updated = [...formData.categories];
    updated[categoryIndex].services = [...updated[categoryIndex].services, newService];
    setFormData({ ...formData, categories: updated });
  }

  // Add service even without categories (creates "Uncategorized" category)
  function addServiceWithoutCategory() {
    let updated = [...formData.categories];
    
    // Find or create "Uncategorized" category
    let uncategorizedIndex = updated.findIndex(cat => cat.name.toLowerCase() === "uncategorized");
    
    if (uncategorizedIndex === -1) {
      const uncategorizedCategory: Category = {
        id: `cat_uncategorized_${Date.now()}`,
        name: "Uncategorized",
        display_order: updated.length,
        services: [],
      };
      updated.push(uncategorizedCategory);
      uncategorizedIndex = updated.length - 1;
    }
    
    const newService: Service = {
      id: `svc_${Date.now()}`,
      name: "",
      price: null,
      bookable: true,
      requires_deposit: false,
      deposit_amount: null,
      preparation_instructions: null,
      aftercare_instructions: null,
      faqs: [],
    };
    
    updated[uncategorizedIndex].services = [...updated[uncategorizedIndex].services, newService];
    setFormData({ ...formData, categories: updated });
    
    // Auto-expand the uncategorized category
    if (!expandedCategories.has(updated[uncategorizedIndex].id)) {
      toggleCategoryExpanded(updated[uncategorizedIndex].id);
    }
  }

  function removeServiceFromCategory(categoryIndex: number, serviceIndex: number) {
    const updated = [...formData.categories];
    updated[categoryIndex].services = updated[categoryIndex].services.filter((_, i) => i !== serviceIndex);
    setFormData({ ...formData, categories: updated });
  }

  function updateService(categoryIndex: number, serviceIndex: number, field: keyof Service, value: any) {
    const updated = [...formData.categories];
    const service = { ...updated[categoryIndex].services[serviceIndex] } as any;
    
    // If requires_deposit is set to true, automatically set bookable to false
    if (field === "requires_deposit" && value === true) {
      service.bookable = false;
      service.requires_deposit = true;
    } else {
      service[field] = value;
    }
    
    // If bookable is set to true and requires_deposit is true, set requires_deposit to false
    if (field === "bookable" && value === true && service.requires_deposit) {
      service.requires_deposit = false;
      service.deposit_amount = null;
    }
    
    updated[categoryIndex].services[serviceIndex] = service;
    setFormData({ ...formData, categories: updated });
  }

  function addServiceFAQ(categoryIndex: number, serviceIndex: number) {
    const updated = [...formData.categories];
    updated[categoryIndex].services[serviceIndex].faqs = [
      ...updated[categoryIndex].services[serviceIndex].faqs,
      { question: "", answer: "" },
    ];
    setFormData({ ...formData, categories: updated });
  }

  function removeServiceFAQ(categoryIndex: number, serviceIndex: number, faqIndex: number) {
    const updated = [...formData.categories];
    updated[categoryIndex].services[serviceIndex].faqs = updated[categoryIndex].services[serviceIndex].faqs.filter(
      (_, i) => i !== faqIndex
    );
    setFormData({ ...formData, categories: updated });
  }

  function updateServiceFAQ(categoryIndex: number, serviceIndex: number, faqIndex: number, field: "question" | "answer", value: string) {
    const updated = [...formData.categories];
    updated[categoryIndex].services[serviceIndex].faqs[faqIndex] = {
      ...updated[categoryIndex].services[serviceIndex].faqs[faqIndex],
      [field]: value,
    };
    setFormData({ ...formData, categories: updated });
  }

  function loadVerticalTemplate(vertical: string) {
    const template = VERTICAL_TEMPLATES[vertical.toLowerCase()];
    if (template) {
      const categoriesWithIds = template.categories.map((cat, idx) => ({
        ...cat,
        id: `cat_${Date.now()}_${idx}`,
        services: cat.services.map((svc, svcIdx) => ({
          ...svc,
          id: `svc_${Date.now()}_${idx}_${svcIdx}`,
        }))
      }));
      setFormData({ ...formData, categories: categoriesWithIds });
    }
  }

  function toggleCategoryExpanded(categoryId: string) {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Load user data immediately - don't wait for mounted
    async function loadUserData() {
      if (typeof window === "undefined") return;
      const supabase = getSupabaseClient();
      const authUserId = (await supabase.auth.getUser()).data.user?.id;
      
      if (authUserId) {
        const { data: userDataRaw } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        
        const userData = userDataRaw as { id: string; full_name: string | null } | null;
        
        if (userData && userData.full_name) {
          setUserName(userData.full_name);
        }
        
        // Store user id for updates
        if (userData && userData.id) {
          sessionStorage.setItem("user_id", userData.id);
        }
      }
    }

    loadUserData();
  }, []); // Remove mounted dependency - load immediately

  useEffect(() => {
    // Load business data immediately - don't wait for mounted
    async function loadBusiness() {
      if (typeof window === "undefined") return;
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
        .select("id, name, vertical, services, address, hours, staff, faqs, promos, categories, mobile_services, packages, same_day_booking")
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
        if (data.hours && typeof data.hours === "object" && data.hours !== null) {
          hoursData = DAYS_OF_WEEK.map((day) => ({
            day,
            hours: (data.hours as Record<string, string>)[day] || "",
            closed: !(data.hours as Record<string, string>)[day] || (data.hours as Record<string, string>)[day] === "closed",
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
        
        // Parse categories (could be nested in JSONB or direct)
        let categoriesData: Category[] = [];
        if (data.categories) {
          const cats = (data.categories as any).categories || data.categories;
          if (Array.isArray(cats)) {
            categoriesData = cats;
          }
        }
        
        setFormData({
          name: data.name || "",
          vertical: data.vertical || "",
          services: Array.isArray(data.services) ? data.services : (typeof data.services === "string" ? data.services.split(",").map(s => s.trim()).filter(Boolean) : []),
          categories: categoriesData,
          mobile_services: data.mobile_services || null,
          packages: data.packages || null,
          same_day_booking: data.same_day_booking ?? true,
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
          categories: [],
          mobile_services: null,
          packages: null,
          same_day_booking: true,
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
  }, []); // Remove mounted dependency - load immediately

  // Load available programs when team tab is active
  useEffect(() => {
    if (activeTab === "team" && isAdmin) {
      async function loadPrograms() {
        const supabase = getSupabaseClient();
        const businessId = sessionStorage.getItem("business_id");
        if (!businessId) return;

        const { data, error } = await (supabase as any)
          .from("programs")
          .select("id, name")
          .eq("business_id", businessId)
          .order("name");

        if (error) {
          console.error("Error loading programs:", error);
        } else {
          setAvailablePrograms(data || []);
        }
      }

      loadPrograms();
    }
  }, [activeTab, isAdmin]);

  // Load calendar connections when info tab is active
  useEffect(() => {
    if (activeTab === "info" && isAdmin) {
      async function loadCalendarConnections() {
        const supabase = getSupabaseClient();
        const businessId = sessionStorage.getItem("business_id");
        if (!businessId) return;

        const { data, error } = await (supabase as any)
          .from("calendar_connections")
          .select("id, email, calendar_id, provider")
          .eq("business_id", businessId)
          .is("program_id", null)
          .eq("is_active", true);

        if (error && error.code !== "PGRST116") {
          console.error("Error loading calendar connections:", error);
        } else if (data) {
          setCalendarConnections(data || []);
        }
      }

      loadCalendarConnections();
    }
  }, [activeTab, isAdmin]);

  async function handleSaveUserName() {
    setSavingUserName(true);
    setUserNameSaveStatus("idle");

    const supabase = getSupabaseClient();
    const authUserId = (await supabase.auth.getUser()).data.user?.id;
    const userId = sessionStorage.getItem("user_id");

    if (!authUserId && !userId) {
      console.error("❌ No auth_user_id or user_id found");
      setUserNameSaveStatus("error");
      setSavingUserName(false);
      setTimeout(() => setUserNameSaveStatus("idle"), 3000);
      return;
    }

    console.log("🔄 Saving user name:", userName.trim(), "for auth_user_id:", authUserId, "user_id:", userId);

    // Try updating by user id first (more reliable with RLS)
    let result;
    
    if (userId) {
      result = await supabase
        .from("users")
        .update({ full_name: userName.trim() })
        .eq("id", userId)
        .select();
    } else if (authUserId) {
      result = await supabase
        .from("users")
        .update({ full_name: userName.trim() })
        .eq("auth_user_id", authUserId)
        .select();
    } else {
      setUserNameSaveStatus("error");
      setSavingUserName(false);
      return;
    }

    const { data, error } = result;

    if (error) {
      console.error("❌ Error saving user name:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setUserNameSaveStatus("error");
    } else if (!data || data.length === 0) {
      console.error("❌ No rows updated - user might not exist or RLS blocked update");
      console.error("💡 Tip: Check your RLS policies allow users to update their own record");
      setUserNameSaveStatus("error");
    } else {
      console.log("✅ User name saved successfully:", data);
      setUserNameSaveStatus("success");
      // Trigger a custom event to notify dashboard to refresh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("userNameUpdated", { detail: { full_name: userName.trim() } }));
      }
    }

    setSavingUserName(false);
    setTimeout(() => {
      setUserNameSaveStatus("idle");
    }, 3000);
  }

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
    
    // Convert categories to JSONB format
    const categoriesJson = formData.categories.length > 0 
      ? { categories: formData.categories } 
      : null;
    
    const { error } = await supabase
      .from("businesses")
      .update({
        name: formData.name.trim(),
        vertical: formData.vertical.trim(),
        services: formData.services.map(s => s.trim()).filter(Boolean), // Keep for backward compatibility
        categories: categoriesJson, // NEW: Categories structure
        mobile_services: formData.mobile_services || null,
        packages: formData.packages || null,
        same_day_booking: formData.same_day_booking,
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
      
      // Log audit event for business edit
      if (isAdmin) {
        const resourceType = activeTab === "info" ? "business_info" 
          : activeTab === "hours" ? "hours" 
          : activeTab === "content" ? "content" 
          : "business_info";
        
        await logBusinessEdit(resourceType, {
          name: formData.name.trim(),
          vertical: formData.vertical.trim(),
          services: formData.services.filter(Boolean),
          categories: categoriesJson,
          mobile_services: formData.mobile_services || null,
          packages: formData.packages || null,
          same_day_booking: formData.same_day_booking,
          address: formData.address.trim() || null,
          hours: hoursJson,
          staff: staffJson,
          faqs: formData.faqs.length > 0 ? formData.faqs : null,
          promos: formData.promos.length > 0 ? formData.promos : null,
        });
      }
      
      // Update local state
      setBusiness({
        ...business,
        name: formData.name.trim(),
        vertical: formData.vertical.trim(),
        services: formData.services.filter(Boolean),
        categories: categoriesJson,
        mobile_services: formData.mobile_services || null,
        packages: formData.packages || null,
        same_day_booking: formData.same_day_booking,
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
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor }} />
          <div className="text-white/60">Loading business settings...</div>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: "profile" as const, label: "User Profile", icon: User },
    { id: "info" as const, label: "Business Info", icon: Building2, adminOnly: true },
    { id: "hours" as const, label: "Hours & Staff", icon: Clock, adminOnly: true },
    { id: "content" as const, label: "Content", icon: Tag, adminOnly: true },
    { id: "team" as const, label: "Team", icon: Users },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
  ];

  async function handleInviteUser() {
    if (!inviteEmail.trim()) {
      setInviteStatus("error");
      setInviteError("Email is required");
      setTimeout(() => {
        setInviteStatus("idle");
        setInviteError("");
      }, 3000);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setInviteStatus("error");
      setInviteError("Invalid email format");
      setTimeout(() => {
        setInviteStatus("idle");
        setInviteError("");
      }, 3000);
      return;
    }

    setInviting(true);
    setInviteStatus("idle");
    setInviteError("");

    try {
      const businessId = sessionStorage.getItem("business_id");
      if (!businessId) {
        throw new Error("Business ID not found");
      }

      const response = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          business_id: businessId,
          role: isAdmin ? inviteRole : "user", // Only admins can assign admin role
          program_id: inviteProgramId || null, // Include program_id if selected
        }),
      });

      // Get response text first to handle both JSON and non-JSON responses
      const responseText = await response.text();
      let result: any = {};
      
      try {
        if (responseText) {
          result = JSON.parse(responseText);
        }
      } catch (jsonError) {
        console.error("Failed to parse response as JSON:", jsonError);
        console.error("Response text:", responseText);
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        const errorMessage = result?.error || result?.details || result?.message || `Server error: ${response.status} ${response.statusText}`;
        console.error("API Error Details:", {
          status: response.status,
          statusText: response.statusText,
          statusCode: response.status,
          responseBody: result,
          rawResponse: responseText,
        });
        console.error("Full error object:", JSON.stringify(result, null, 2));
        console.error("Error details:", result?.details);
        console.error("Error message:", result?.error);
        throw new Error(errorMessage);
      }

      setInviteStatus("success");
      setInviteEmail("");
      setInviteProgramId(null); // Reset program selection
      setTimeout(() => {
        setInviteStatus("idle");
      }, 3000);
    } catch (error) {
      console.error("Error inviting user:", error);
      setInviteStatus("error");
      setInviteError(error instanceof Error ? error.message : "Failed to send invitation");
      setTimeout(() => {
        setInviteStatus("idle");
        setInviteError("");
      }, 5000);
    } finally {
      setInviting(false);
    }
  }

  async function handleConnectCalendar(provider: "google" | "outlook" | "calendly") {
    setConnectingCalendar(provider);
    try {
      const businessId = sessionStorage.getItem("business_id");
      if (!businessId) {
        throw new Error("Business ID not found");
      }

      const response = await fetch(`/api/calendar/connect?business_id=${businessId}&provider=${provider}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get calendar connection URL");
      }

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const providerNames: Record<string, string> = {
        google: "Google Calendar",
        outlook: "Microsoft Outlook",
        calendly: "Calendly"
      };

      const popup = window.open(
        data.auth_url,
        `Connect ${providerNames[provider]}`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      // Check if popup was blocked
      if (!popup) {
        throw new Error("Popup blocked. Please allow popups and try again.");
      }

      // Poll for popup to close (user completed OAuth)
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setConnectingCalendar(null);
          // Reload calendar connections
          const supabase = getSupabaseClient();
          (supabase as any)
            .from("calendar_connections")
            .select("id, email, calendar_id, provider")
            .eq("business_id", businessId)
            .is("program_id", null)
            .eq("is_active", true)
            .then(({ data, error }: { data: any; error: any }) => {
              if (!error && data) {
                setCalendarConnections(data || []);
              }
            });
        }
      }, 1000);
    } catch (error) {
      console.error("Error connecting calendar:", error);
      setConnectingCalendar(null);
      alert(error instanceof Error ? error.message : "Failed to connect calendar");
    }
  }

  async function handleDisconnectCalendar(connectionId: string, provider: string) {
    if (!confirm(`Are you sure you want to disconnect your ${provider} calendar? This will prevent AI from scheduling appointments.`)) {
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase as any)
        .from("calendar_connections")
        .update({ is_active: false })
        .eq("id", connectionId);

      if (error) {
        throw error;
      }

      setCalendarConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
      alert("Failed to disconnect calendar");
    }
  }

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
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xs font-medium drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]"
            style={{ color: `${accentColor}CC` }}
          >
            #Founders Program
          </motion.span>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-1 sm:gap-2 border-b border-white/10 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isAdminOnly = tab.adminOnly && !isAdmin;
          return (
            <button
              key={tab.id}
              onClick={() => !isAdminOnly && setActiveTab(tab.id)}
              disabled={isAdminOnly}
              className={`relative px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 min-h-[44px] whitespace-nowrap ${
                isAdminOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: "var(--accent-color, #eab308)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={`h-4 w-4 ${isActive ? "" : "text-white/60"}`} style={isActive ? { color: "var(--accent-color, #eab308)" } : {}} />
              <span className={isActive ? "" : "text-white/60"} style={isActive ? { color: "var(--accent-color, #eab308)" } : {}}>
                {tab.label}
              </span>
              {isAdminOnly && (
                <Lock className="h-3 w-3 text-white/40 ml-1" />
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "profile" && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* User Profile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl border border-white/10"
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div 
                  className="p-2 rounded-xl border"
                  style={{
                    background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                    borderColor: `${accentColor}4D`,
                  }}
                >
                  <User className="h-5 w-5" style={{ color: accentColor }} />
                </div>
                <h2 className="text-lg font-semibold text-white">User Profile</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="user-name"
                    name="user-name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all"
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = `${accentColor}80`;
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    placeholder="Your Full Name"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <AnimatePresence>
                    {userNameSaveStatus === "success" && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Name saved successfully
                      </motion.div>
                    )}
                    {userNameSaveStatus === "error" && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
                      >
                        <XCircle className="h-4 w-4" />
                        Failed to save name
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button
                    onClick={handleSaveUserName}
                    disabled={savingUserName}
                    whileHover={{ scale: savingUserName ? 1 : 1.02 }}
                    whileTap={{ scale: savingUserName ? 1 : 0.98 }}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 text-white font-medium hover:from-yellow-500/30 hover:to-yellow-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingUserName ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Name
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "info" && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {!isAdmin ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl border border-white/10"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="h-5 w-5 text-white/40" />
                  <h2 className="text-lg font-semibold text-white/60">Admin Only</h2>
                </div>
                <p className="text-white/40">
                  Only administrators can edit business information. Contact your admin to make changes.
                </p>
              </motion.div>
            ) : (
              <>
                {/* Two-Column Layout: Business Info + Calendar */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Business Info Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-xl bg-black border border-white/10"
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div 
                        className="p-2 rounded-lg border"
                        style={{
                          background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                          borderColor: `${accentColor}4D`,
                        }}
                      >
                        <Building2 className="h-5 w-5" style={{ color: accentColor }} />
                      </div>
                      <h2 className="text-lg font-semibold text-white">Business Info</h2>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                          Business Name
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                          placeholder="Your Business Name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                          Vertical/Industry
                        </label>
                        <input
                          type="text"
                          value={formData.vertical}
                          onChange={(e) => {
                            setFormData({ ...formData, vertical: e.target.value });
                            // Auto-load template if vertical matches
                            if (e.target.value && VERTICAL_TEMPLATES[e.target.value.toLowerCase()] && formData.categories.length === 0) {
                              loadVerticalTemplate(e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                          placeholder="e.g., medspa, wellness"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                          Address
                        </label>
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                          placeholder="Business Address"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.same_day_booking}
                            onChange={(e) => setFormData({ ...formData, same_day_booking: e.target.checked })}
                            className="w-4 h-4 rounded border-white/20 text-yellow-400 focus:ring-yellow-500/50 cursor-pointer"
                          />
                          <span className="text-xs text-white/70">Same-Day Booking</span>
                        </label>
                      </div>
                    </div>
                  </motion.div>

                  {/* Right Column: Calendar Connections Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-5 rounded-xl bg-black border border-white/10"
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div 
                        className="p-2 rounded-lg border"
                        style={{
                          background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                          borderColor: `${accentColor}4D`,
                        }}
                      >
                        <Calendar className="h-5 w-5" style={{ color: accentColor }} />
                      </div>
                      <h2 className="text-lg font-semibold text-white">Calendar</h2>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs text-white/50 mb-3">Connect your calendar for automatic appointment scheduling</p>
                      
                      {/* Google Calendar */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-400">G</span>
                          </div>
                          <span className="text-sm text-white/80">Google Calendar</span>
                        </div>
                        {calendarConnections.find(c => c.provider === "google") ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-400">Connected</span>
                            <button
                              onClick={() => handleDisconnectCalendar(calendarConnections.find(c => c.provider === "google")!.id, "Google")}
                              className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConnectCalendar("google")}
                            disabled={connectingCalendar === "google"}
                            className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors text-xs text-white/80 disabled:opacity-50"
                          >
                            {connectingCalendar === "google" ? "Connecting..." : "Connect"}
                          </button>
                        )}
                      </div>

                      {/* Microsoft Outlook */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-blue-600/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-300">M</span>
                          </div>
                          <span className="text-sm text-white/80">Microsoft Outlook</span>
                        </div>
                        {calendarConnections.find(c => c.provider === "outlook") ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-400">Connected</span>
                            <button
                              onClick={() => handleDisconnectCalendar(calendarConnections.find(c => c.provider === "outlook")!.id, "Outlook")}
                              className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConnectCalendar("outlook")}
                            disabled={connectingCalendar === "outlook"}
                            className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors text-xs text-white/80 disabled:opacity-50"
                          >
                            {connectingCalendar === "outlook" ? "Connecting..." : "Connect"}
                          </button>
                        )}
                      </div>

                      {/* Calendly */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-purple-400">C</span>
                          </div>
                          <span className="text-sm text-white/80">Calendly</span>
                        </div>
                        {calendarConnections.find(c => c.provider === "calendly") ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-400">Connected</span>
                            <button
                              onClick={() => handleDisconnectCalendar(calendarConnections.find(c => c.provider === "calendly")!.id, "Calendly")}
                              className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConnectCalendar("calendly")}
                            disabled={connectingCalendar === "calendly"}
                            className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors text-xs text-white/80 disabled:opacity-50"
                          >
                            {connectingCalendar === "calendly" ? "Connecting..." : "Connect"}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Categories & Services Card - Full Width Below */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-5 rounded-xl glass-strong border border-white/10"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-lg border"
                        style={{
                          background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                          borderColor: `${accentColor}4D`,
                        }}
                      >
                        <Tag className="h-5 w-5" style={{ color: accentColor }} />
                      </div>
                      <h2 className="text-lg font-semibold text-white">Categories & Services</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Vertical Template Dropdown */}
                      <select
                        onChange={(e) => {
                          if (e.target.value === "custom") {
                            addCategory();
                          } else if (e.target.value) {
                            loadVerticalTemplate(e.target.value);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                        defaultValue=""
                      >
                        <option value="" className="bg-black">Quick Setup</option>
                        <option value="medspa" className="bg-black">Medspa Template</option>
                        <option value="wellness" className="bg-black">Wellness Template</option>
                        <option value="custom" className="bg-black">Custom (Start Empty)</option>
                      </select>
                      <button
                        type="button"
                        onClick={addCategory}
                                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors flex items-center gap-2 text-xs text-white/80"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Category
                      </button>
                    </div>
                  </div>
                  
                  {formData.categories.length === 0 ? (
                    <div className="p-8 rounded-xl border border-white/10 text-center">
                      <Tag className="h-12 w-12 mx-auto mb-4 text-white/30" />
                      <p className="text-white/60 mb-2">No categories yet</p>
                      <p className="text-white/40 text-sm mb-4">Add a service to get started, or use a template above</p>
                      <button
                        type="button"
                        onClick={addServiceWithoutCategory}
                        className="px-4 py-2 rounded-lg border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors text-sm text-white/80 flex items-center gap-2 mx-auto"
                      >
                        <Plus className="h-4 w-4" />
                        Add Service
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.categories.map((category, categoryIndex) => {
                        const isExpanded = expandedCategories.has(category.id);
                        return (
                          <motion.div
                            key={category.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                                          className="rounded-lg border border-white/10 overflow-hidden"
                          >
                            {/* Category Header - Collapsible */}
                            <button
                              type="button"
                              onClick={() => toggleCategoryExpanded(category.id)}
                              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <motion.div
                                  animate={{ rotate: isExpanded ? 90 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <X className="h-4 w-4 text-white/40 rotate-45" />
                                </motion.div>
                                <input
                                  type="text"
                                  value={category.name}
                                  onChange={(e) => updateCategory(categoryIndex, "name", e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 text-sm font-semibold"
                                  placeholder="Category name"
                                />
                                <span className="text-xs text-white/40 px-2 py-1 rounded border border-white/10">
                                  {category.services.length} {category.services.length === 1 ? 'service' : 'services'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addServiceToCategory(categoryIndex);
                                    if (!isExpanded) toggleCategoryExpanded(category.id);
                                  }}
                                  className="px-2 py-1 rounded border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors text-xs text-white/70"
                                >
                                  <Plus className="h-3 w-3 inline mr-1" />
                                  Service
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCategory(categoryIndex);
                                  }}
                                  className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </button>
                            
                            {/* Services - Collapsible Content */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 pt-0 space-y-3 border-t border-white/5">
                                    {category.services.length === 0 ? (
                                      <p className="text-white/40 text-sm text-center py-4">No services in this category</p>
                                    ) : (
                                      category.services.map((service, serviceIndex) => (
                                        <motion.div
                                          key={service.id}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          className="p-4 rounded-lg border border-white/10 space-y-3"
                                        >
                                          {/* Service Name & Basic Info */}
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="md:col-span-2">
                                              <label className="block text-xs font-medium text-white/60 mb-1.5">
                                                Service Name *
                                              </label>
                                              <input
                                                type="text"
                                                value={service.name}
                                                onChange={(e) => updateService(categoryIndex, serviceIndex, "name", e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                                placeholder="e.g., Botox, HydraFacial"
                                              />
                                            </div>
                                            
                                            <div>
                                              <label className="block text-xs font-medium text-white/60 mb-1.5">
                                                Price ($)
                                              </label>
                                              <input
                                                type="number"
                                                step="0.01"
                                                value={service.price || ""}
                                                onChange={(e) => updateService(categoryIndex, serviceIndex, "price", e.target.value ? parseFloat(e.target.value) : null)}
                                                className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                                placeholder="350.00"
                                              />
                                            </div>
                                            
                                            <div className="flex items-center gap-4 pt-6">
                                              <label className={`flex items-center gap-2 ${service.requires_deposit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                                <input
                                                  type="checkbox"
                                                  checked={service.bookable}
                                                  disabled={service.requires_deposit}
                                                  onChange={(e) => updateService(categoryIndex, serviceIndex, "bookable", e.target.checked)}
                                                  className="w-4 h-4 rounded border-white/20 text-yellow-400 focus:ring-yellow-500/50 disabled:cursor-not-allowed"
                                                />
                                                <span className="text-xs text-white/70">Bookable {service.requires_deposit && '(disabled when deposit required)'}</span>
                                              </label>
                                              
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={service.requires_deposit}
                                                  onChange={(e) => updateService(categoryIndex, serviceIndex, "requires_deposit", e.target.checked)}
                                                  className="w-4 h-4 rounded border-white/20 text-yellow-400 focus:ring-yellow-500/50 cursor-pointer"
                                                />
                                                <span className="text-xs text-white/70">Requires Deposit</span>
                                              </label>
                                            </div>
                                            
                                            {service.requires_deposit && (
                                              <div>
                                                <label className="block text-xs font-medium text-white/60 mb-1.5">
                                                  Deposit Amount ($)
                                                </label>
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  value={service.deposit_amount || ""}
                                                  onChange={(e) => updateService(categoryIndex, serviceIndex, "deposit_amount", e.target.value ? parseFloat(e.target.value) : null)}
                                                  className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                                                  placeholder="50.00"
                                                />
                                              </div>
                                            )}
                                          </div>
                                          
                                          {/* Care Instructions */}
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                              <label className="block text-xs font-medium text-white/60 mb-1.5">
                                                Pre-Care Instructions
                                              </label>
                                              <textarea
                                                value={service.preparation_instructions || ""}
                                                onChange={(e) => updateService(categoryIndex, serviceIndex, "preparation_instructions", e.target.value || null)}
                                                className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-h-[60px]"
                                                placeholder="Avoid blood thinners 1 week before..."
                                              />
                                            </div>
                                            
                                            <div>
                                              <label className="block text-xs font-medium text-white/60 mb-1.5">
                                                Aftercare Instructions
                                              </label>
                                              <textarea
                                                value={service.aftercare_instructions || ""}
                                                onChange={(e) => updateService(categoryIndex, serviceIndex, "aftercare_instructions", e.target.value || null)}
                                                className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-h-[60px]"
                                                placeholder="Don't lie down for 4 hours..."
                                              />
                                            </div>
                                          </div>
                                          
                                          {/* Service FAQs */}
                                          <div>
                                            <div className="flex items-center justify-between mb-2">
                                              <label className="block text-xs font-medium text-white/60">
                                                Service FAQs
                                              </label>
                                              <button
                                                type="button"
                                                onClick={() => addServiceFAQ(categoryIndex, serviceIndex)}
                                                className="px-2 py-1 rounded text-xs border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors text-white/70"
                                              >
                                                <Plus className="h-3 w-3 inline mr-1" />
                                                Add FAQ
                                              </button>
                                            </div>
                                            {service.faqs.length > 0 && (
                                              <div className="space-y-2 mt-2">
                                                {service.faqs.map((faq, faqIndex) => (
                                                  <div key={faqIndex} className="p-2 rounded-lg border border-white/10 space-y-2">
                                                    <input
                                                      type="text"
                                                      value={faq.question}
                                                      onChange={(e) => updateServiceFAQ(categoryIndex, serviceIndex, faqIndex, "question", e.target.value)}
                                                      className="w-full px-2 py-1 rounded border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 text-xs"
                                                      placeholder="Question"
                                                    />
                                                    <div className="flex items-start gap-2">
                                                      <textarea
                                                        value={faq.answer}
                                                        onChange={(e) => updateServiceFAQ(categoryIndex, serviceIndex, faqIndex, "answer", e.target.value)}
                                                        className="flex-1 px-2 py-1 rounded border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 text-xs min-h-[40px]"
                                                        placeholder="Answer"
                                                      />
                                                      <button
                                                        type="button"
                                                        onClick={() => removeServiceFAQ(categoryIndex, serviceIndex, faqIndex)}
                                                        className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                                                      >
                                                        <X className="h-3 w-3" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          
                                          {/* Remove Service Button */}
                                          <div className="flex justify-end pt-2 border-t border-white/5">
                                            <button
                                              type="button"
                                              onClick={() => removeServiceFromCategory(categoryIndex, serviceIndex)}
                                              className="px-2 py-1 rounded hover:bg-red-500/20 text-red-400 transition-colors text-xs flex items-center gap-1"
                                            >
                                              <X className="h-3 w-3" />
                                              Remove
                                            </button>
                                          </div>
                                        </motion.div>
                                      ))
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === "hours" && (
          <motion.div
            key="hours"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {!isAdmin ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl border border-white/10 lg:col-span-2"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="h-5 w-5 text-white/40" />
                  <h2 className="text-lg font-semibold text-white/60">Admin Only</h2>
                </div>
                <p className="text-white/40">
                  Only administrators can edit business hours and staff. Contact your admin to make changes.
                </p>
              </motion.div>
            ) : (
              <>
                {/* Business Hours Card */}
                <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl border border-white/10"
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div 
                  className="p-2 rounded-xl border"
                  style={{
                    background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                    borderColor: `${accentColor}4D`,
                  }}
                >
                  <Clock className="h-5 w-5" style={{ color: accentColor }} />
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
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      dayHours.closed
                        ? "border-white/5"
                        : "border-white/10 hover:border-yellow-500/30"
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
                          id={`hours-closed-${index}`}
                          name={`hours-closed-${index}`}
                          checked={dayHours.closed}
                          onChange={(e) => updateHours(index, "closed", e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 text-yellow-400 focus:ring-yellow-500/50 cursor-pointer"
                        />
                        <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                          Closed
                        </span>
                      </label>
                      {!dayHours.closed && (
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            id={`hours-${index}`}
                            name={`hours-${index}`}
                            value={dayHours.hours}
                            onChange={(e) => updateHours(index, "hours", e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                            placeholder="9am-5pm"
                          />
                        </div>
                      )}
                      {dayHours.closed && (
                        <div className="flex-1 flex items-center">
                          <span className="px-3 py-2 rounded-lg text-white/40 text-sm border border-white/10">
                            Closed
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Staff Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl border border-white/10"
            >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-xl border"
                style={{
                  background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                  borderColor: `${accentColor}4D`,
                }}
              >
                <Users className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <h2 className="text-lg font-semibold text-white">Staff</h2>
            </div>
            <button
              onClick={addStaff}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors flex items-center gap-2 text-sm text-white/80"
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
                  className="p-4 rounded-xl border border-white/10 hover:border-yellow-500/30 transition-all"
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
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
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
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
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
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
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
              </>
            )}
          </motion.div>
        )}

        {activeTab === "content" && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {!isAdmin ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl border border-white/10 lg:col-span-2"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="h-5 w-5 text-white/40" />
                  <h2 className="text-lg font-semibold text-white/60">Admin Only</h2>
                </div>
                <p className="text-white/40">
                  Only administrators can edit content (FAQs and Promotions). Contact your admin to make changes.
                </p>
              </motion.div>
            ) : (
              <>
                {/* FAQs Card */}
                <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl border border-white/10"
            >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-xl border"
                style={{
                  background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                  borderColor: `${accentColor}4D`,
                }}
              >
                <HelpCircle className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <h2 className="text-lg font-semibold text-white">FAQs</h2>
            </div>
            <button
              onClick={addFAQ}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors flex items-center gap-2 text-sm text-white/80"
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
                  className="p-4 rounded-xl border border-white/10 space-y-3"
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
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
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
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-h-[60px]"
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

            {/* Promotions Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl border border-white/10"
            >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-xl border"
                style={{
                  background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                  borderColor: `${accentColor}4D`,
                }}
              >
                <Tag className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <h2 className="text-lg font-semibold text-white">Promotions</h2>
            </div>
            <button
              onClick={addPromo}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors flex items-center gap-2 text-sm text-white/80"
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
                  className="p-4 rounded-xl border border-white/10 space-y-3"
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
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
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
                          className="w-full px-3 py-2 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm min-h-[60px]"
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
              </>
            )}
          </motion.div>
        )}
        {activeTab === "team" && (
          <motion.div
            key="team"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Invite Team Member Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl border border-white/10"
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div 
                  className="p-2 rounded-xl border"
                  style={{
                    background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                    borderColor: `${accentColor}4D`,
                  }}
                >
                  <UserPlus className="h-5 w-5" style={{ color: accentColor }} />
                </div>
                <h2 className="text-lg font-semibold text-white">Invite Team Member</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all"
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = `${accentColor}80`;
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    placeholder="user@example.com"
                    disabled={inviting}
                  />
                </div>
                {isAdmin && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Role
                      </label>
                      <select
                        id="invite-role"
                        name="invite-role"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as "user" | "admin")}
                        className="w-full px-4 py-3 rounded-xl border border-white/10 text-white focus:outline-none focus:ring-2 transition-all"
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = `${accentColor}80`;
                          e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        disabled={inviting}
                      >
                        <option value="user" className="bg-black text-white">User</option>
                        <option value="admin" className="bg-black text-white">Admin</option>
                      </select>
                    </div>
                    {availablePrograms.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Program (Optional)
                        </label>
                        <select
                          id="invite-program"
                          name="invite-program"
                          value={inviteProgramId || ""}
                          onChange={(e) => setInviteProgramId(e.target.value || null)}
                          className="w-full px-4 py-3 rounded-xl border border-white/10 text-white focus:outline-none focus:ring-2 transition-all"
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = `${accentColor}80`;
                            e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                          disabled={inviting}
                        >
                          <option value="" className="bg-black text-white">All Programs (Default)</option>
                          {availablePrograms.map((program) => (
                            <option key={program.id} value={program.id} className="bg-black text-white">
                              {program.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-white/60 mt-1">
                          Assign user to a specific program, or leave blank for all programs
                        </p>
                      </div>
                    )}
                  </>
                )}
                {!isAdmin && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-white/60">
                      New users will be assigned the "User" role. Only admins can assign admin roles.
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-4">
                  <AnimatePresence>
                    {inviteStatus === "success" && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Invitation sent successfully!
                      </motion.div>
                    )}
                    {inviteStatus === "error" && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
                      >
                        <XCircle className="h-4 w-4" />
                        {inviteError || "Failed to send invitation"}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button
                    onClick={handleInviteUser}
                    disabled={inviting || !inviteEmail.trim()}
                    whileHover={{ scale: inviting || !inviteEmail.trim() ? 1 : 1.02 }}
                    whileTap={{ scale: inviting || !inviteEmail.trim() ? 1 : 0.98 }}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 text-white font-medium hover:from-yellow-500/30 hover:to-yellow-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Send Invitation
                      </>
                    )}
                  </motion.button>
                </div>
                <div className="mt-4 p-3 rounded-lg border border-white/10">
                  <p className="text-xs text-white/60">
                    The user will receive an email invitation to join your team. They'll be able to set their password and access the dashboard.
                  </p>
                </div>
              </div>
            </motion.div>

          </motion.div>
        )}

        {activeTab === "appearance" && (
          <motion.div
            key="appearance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl border border-white/10"
            >
              <ColorPicker />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button - Only show for admin when editing admin-only tabs */}
      {(isAdmin || (activeTab !== "info" && activeTab !== "hours" && activeTab !== "content")) && (
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
            {(activeTab === "info" || activeTab === "hours" || activeTab === "content") && isAdmin && (
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
            )}
        </motion.div>
      )}
    </div>
  );
}
