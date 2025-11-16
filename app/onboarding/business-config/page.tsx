"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { updateOnboardingStep } from "@/lib/onboarding";
import { Clock, Users, Tag, HelpCircle, ArrowRight, ArrowLeft, Loader2, Plus, X, CheckCircle2 } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";

type ConfigStep = "hours" | "staff" | "services" | "faqs";

interface StaffMember {
  name: string;
  role: string;
  email: string;
  phone: string;
  hours: string;
  can_take_bookings: boolean;
}

interface FAQ {
  question: string;
  answer: string;
}

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function BusinessConfigPage() {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const [currentStep, setCurrentStep] = useState<ConfigStep>("hours");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [hours, setHours] = useState<Record<string, { hours: string; closed: boolean }>>({});
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Set<ConfigStep>>(new Set());

  useEffect(() => {
    async function loadBusinessData() {
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");

      if (!businessId) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("businesses")
        .select("hours, staff, services, faqs, vertical")
        .eq("id", businessId)
        .single();

      if (error) {
        console.error("Error loading business:", error);
        setLoading(false);
        return;
      }

      // Load hours
      if (data.hours && typeof data.hours === "object") {
        const hoursData: Record<string, { hours: string; closed: boolean }> = {};
        DAYS_OF_WEEK.forEach((day) => {
          const dayHours = (data.hours as any)[day];
          hoursData[day] = {
            hours: dayHours && dayHours !== "closed" ? dayHours : "",
            closed: !dayHours || dayHours === "closed",
          };
        });
        setHours(hoursData);
      } else {
        // Initialize empty hours
        const emptyHours: Record<string, { hours: string; closed: boolean }> = {};
        DAYS_OF_WEEK.forEach((day) => {
          emptyHours[day] = { hours: "", closed: false };
        });
        setHours(emptyHours);
      }

      // Load staff
      if (Array.isArray(data.staff)) {
        setStaff(
          data.staff.map((s: any) => ({
            name: s.name || "",
            role: s.role || "",
            email: s.email || "",
            phone: s.phone || "",
            hours: s.hours || "",
            can_take_bookings: s.can_take_bookings !== false,
          }))
        );
      }

      // Load services
      if (Array.isArray(data.services)) {
        setServices(data.services);
      }

      // Load FAQs
      if (Array.isArray(data.faqs)) {
        setFaqs(data.faqs as unknown as FAQ[]);
      } else if (data.vertical) {
        // Auto-generate initial FAQs based on business type
        const initialFAQs = generateInitialFAQs(data.vertical);
        setFaqs(initialFAQs);
      }

      setLoading(false);
    }

    loadBusinessData();
  }, [router]);

  const generateInitialFAQs = (vertical: string): FAQ[] => {
    const faqTemplates: Record<string, FAQ[]> = {
      therapy: [
        {
          question: "What types of therapy do you offer?",
          answer: "We offer individual therapy, couples counseling, and group therapy sessions.",
        },
        {
          question: "Do you accept insurance?",
          answer: "Yes, we accept most major insurance plans. Please call to verify your coverage.",
        },
        {
          question: "How do I schedule an appointment?",
          answer: "You can schedule an appointment by calling us or booking online through our website.",
        },
      ],
      psychiatry: [
        {
          question: "Do you provide medication management?",
          answer: "Yes, our psychiatrists provide comprehensive medication management services.",
        },
        {
          question: "What should I bring to my first appointment?",
          answer: "Please bring your insurance card, ID, and a list of current medications.",
        },
      ],
    };

    return faqTemplates[vertical.toLowerCase()] || [
      {
        question: "What are your hours?",
        answer: "Our hours vary by day. Please call for specific availability.",
      },
      {
        question: "How do I schedule an appointment?",
        answer: "You can schedule by calling us or booking online.",
      },
    ];
  };

  const saveStep = async (step: ConfigStep) => {
    const supabase = getSupabaseClient();
    const businessId = sessionStorage.getItem("business_id");

    if (!businessId) return;

    const updateData: any = {};

    if (step === "hours") {
      const hoursJson: Record<string, string> = {};
      Object.entries(hours).forEach(([day, data]) => {
        if (data.closed) {
          hoursJson[day] = "closed";
        } else if (data.hours.trim()) {
          hoursJson[day] = data.hours.trim();
        }
      });
      updateData.hours = Object.keys(hoursJson).length > 0 ? hoursJson : null;
    } else if (step === "staff") {
      updateData.staff = staff.filter((s) => s.name.trim() || s.role.trim()).map((s) => ({
        name: s.name.trim(),
        role: s.role.trim(),
        email: s.email.trim() || null,
        phone: s.phone.trim() || null,
        hours: s.hours.trim() || null,
        can_take_bookings: s.can_take_bookings,
      }));
    } else if (step === "services") {
      updateData.services = services.filter((s) => s.trim());
    } else if (step === "faqs") {
      updateData.faqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    }

    await supabase.from("businesses").update(updateData).eq("id", businessId);
    setCompletedSteps(new Set([...completedSteps, step]));
  };

  const handleNext = async () => {
    // Save current step
    await saveStep(currentStep);

    // Move to next step
    const steps: ConfigStep[] = ["hours", "staff", "services", "faqs"];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      // All steps complete, move to test call
      const businessId = sessionStorage.getItem("business_id");
      if (businessId) {
        await updateOnboardingStep(businessId, 4);
        router.push("/onboarding/test-call");
      }
    }
  };

  const handleBack = () => {
    const steps: ConfigStep[] = ["hours", "staff", "services", "faqs"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      router.push("/onboarding/mode-selection");
    }
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
        <h1 className="text-3xl font-bold text-white mb-2">Configure Your Receptionist</h1>
        <p className="text-white/60">
          Set up the essential information your AI receptionist needs to know.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-2 mb-8">
        {(["hours", "staff", "services", "faqs"] as ConfigStep[]).map((step) => {
          const stepNames = {
            hours: "Hours",
            staff: "Staff",
            services: "Services",
            faqs: "FAQs",
          };
          const isActive = currentStep === step;
          const isCompleted = completedSteps.has(step);

          return (
            <div
              key={step}
              className={`flex-1 h-2 rounded-full transition-all ${
                isActive
                  ? "bg-white/20"
                  : isCompleted
                  ? "bg-white/10"
                  : "bg-white/5"
              }`}
              style={isActive ? { backgroundColor: `${accentColor}66` } : {}}
            />
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {currentStep === "hours" && (
          <HoursStep
            key="hours"
            hours={hours}
            setHours={setHours}
            accentColor={accentColor}
          />
        )}
        {currentStep === "staff" && (
          <StaffStep
            key="staff"
            staff={staff}
            setStaff={setStaff}
            accentColor={accentColor}
          />
        )}
        {currentStep === "services" && (
          <ServicesStep
            key="services"
            services={services}
            setServices={setServices}
            accentColor={accentColor}
          />
        )}
        {currentStep === "faqs" && (
          <FAQsStep
            key="faqs"
            faqs={faqs}
            setFaqs={setFaqs}
            accentColor={accentColor}
          />
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-white/10">
        <motion.button
          onClick={handleBack}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl glass border border-white/10 hover:bg-white/10 transition-colors text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </motion.button>

        <motion.button
          onClick={handleNext}
          disabled={saving}
          whileHover={{ scale: saving ? 1 : 1.02 }}
          whileTap={{ scale: saving ? 1 : 0.98 }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border font-medium transition-all disabled:opacity-50"
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
          ) : currentStep === "faqs" ? (
            <>
              Continue to Test Call
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

// Hours Step Component
function HoursStep({
  hours,
  setHours,
  accentColor,
}: {
  hours: Record<string, { hours: string; closed: boolean }>;
  setHours: (hours: Record<string, { hours: string; closed: boolean }>) => void;
  accentColor: string;
}) {
  const updateDay = (day: string, field: "hours" | "closed", value: string | boolean) => {
    setHours({
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value,
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 mb-6">
        <Clock className="h-6 w-6" style={{ color: accentColor }} />
        <h2 className="text-2xl font-bold text-white">Set Your Clinic's Operating Hours</h2>
      </div>

      <div className="space-y-3">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="flex items-center gap-4 p-4 rounded-xl glass border border-white/10"
          >
            <div className="w-32 flex-shrink-0">
              <span className="text-sm font-semibold text-white capitalize">
                {day}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hours[day]?.closed || false}
                  onChange={(e) => updateDay(day, "closed", e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5"
                  style={{ accentColor }}
                />
                <span className="text-sm text-white/60">Closed</span>
              </label>
              {!hours[day]?.closed && (
                <input
                  type="text"
                  value={hours[day]?.hours || ""}
                  onChange={(e) => updateDay(day, "hours", e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all"
                  placeholder="9am-5pm"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Staff Step Component
function StaffStep({
  staff,
  setStaff,
  accentColor,
}: {
  staff: StaffMember[];
  setStaff: (staff: StaffMember[]) => void;
  accentColor: string;
}) {
  const addStaff = () => {
    setStaff([
      ...staff,
      {
        name: "",
        role: "",
        email: "",
        phone: "",
        hours: "",
        can_take_bookings: true,
      },
    ]);
  };

  const removeStaff = (index: number) => {
    setStaff(staff.filter((_, i) => i !== index));
  };

  const updateStaff = (index: number, field: keyof StaffMember, value: any) => {
    const updated = [...staff];
    updated[index] = { ...updated[index], [field]: value };
    setStaff(updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" style={{ color: accentColor }} />
          <h2 className="text-2xl font-bold text-white">Who Answers Calls?</h2>
        </div>
        <motion.button
          onClick={addStaff}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
          style={{
            backgroundColor: `${accentColor}33`,
            borderColor: `${accentColor}4D`,
            color: accentColor,
          }}
        >
          <Plus className="h-4 w-4" />
          Add Staff
        </motion.button>
      </div>

      {staff.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          <p className="mb-4">No staff members added yet.</p>
          <button
            onClick={addStaff}
            className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors text-white"
          >
            Add Your First Staff Member
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {staff.map((member, index) => (
            <div
              key={index}
              className="p-4 rounded-xl glass border border-white/10 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateStaff(index, "name", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all text-sm"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      Role *
                    </label>
                    <input
                      type="text"
                      value={member.role}
                      onChange={(e) => updateStaff(index, "role", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all text-sm"
                      placeholder="Receptionist"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={member.email}
                      onChange={(e) => updateStaff(index, "email", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all text-sm"
                      placeholder="john@clinic.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={member.phone}
                      onChange={(e) => updateStaff(index, "phone", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all text-sm"
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      Hours Available
                    </label>
                    <input
                      type="text"
                      value={member.hours}
                      onChange={(e) => updateStaff(index, "hours", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all text-sm"
                      placeholder="Mon-Fri 9am-5pm"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer pt-6">
                      <input
                        type="checkbox"
                        checked={member.can_take_bookings}
                        onChange={(e) => updateStaff(index, "can_take_bookings", e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-white/5"
                        style={{ accentColor }}
                      />
                      <span className="text-sm text-white/60">Can take bookings</span>
                    </label>
                  </div>
                </div>
                <button
                  onClick={() => removeStaff(index)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors ml-3"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Services Step Component
function ServicesStep({
  services,
  setServices,
  accentColor,
}: {
  services: string[];
  setServices: (services: string[]) => void;
  accentColor: string;
}) {
  const addService = () => {
    setServices([...services, ""]);
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const updateService = (index: number, value: string) => {
    const updated = [...services];
    updated[index] = value;
    setServices(updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Tag className="h-6 w-6" style={{ color: accentColor }} />
          <h2 className="text-2xl font-bold text-white">Add All Services Your Clinic Offers</h2>
        </div>
        <motion.button
          onClick={addService}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
          style={{
            backgroundColor: `${accentColor}33`,
            borderColor: `${accentColor}4D`,
            color: accentColor,
          }}
        >
          <Plus className="h-4 w-4" />
          Add Service
        </motion.button>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          <p className="mb-4">No services added yet.</p>
          <button
            onClick={addService}
            className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors text-white"
          >
            Add Your First Service
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service, index) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="text"
                value={service}
                onChange={(e) => updateService(index, e.target.value)}
                className="flex-1 px-4 py-3 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all"
                placeholder="e.g., Individual Therapy, Couples Counseling"
              />
              <button
                onClick={() => removeService(index)}
                className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// FAQs Step Component
function FAQsStep({
  faqs,
  setFaqs,
  accentColor,
}: {
  faqs: FAQ[];
  setFaqs: (faqs: FAQ[]) => void;
  accentColor: string;
}) {
  const addFAQ = () => {
    setFaqs([...faqs, { question: "", answer: "" }]);
  };

  const removeFAQ = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  const updateFAQ = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    setFaqs(updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-6 w-6" style={{ color: accentColor }} />
          <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
        </div>
        <motion.button
          onClick={addFAQ}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
          style={{
            backgroundColor: `${accentColor}33`,
            borderColor: `${accentColor}4D`,
            color: accentColor,
          }}
        >
          <Plus className="h-4 w-4" />
          Add FAQ
        </motion.button>
      </div>

      <p className="text-white/60 text-sm mb-6">
        We've pre-filled some common FAQs based on your business type. You can edit or add more.
      </p>

      {faqs.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          <p className="mb-4">No FAQs added yet.</p>
          <button
            onClick={addFAQ}
            className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors text-white"
          >
            Add Your First FAQ
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
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
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all text-sm"
                      placeholder="What are your hours?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      Answer
                    </label>
                    <textarea
                      value={faq.answer}
                      onChange={(e) => updateFAQ(index, "answer", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all text-sm min-h-[80px]"
                      placeholder="We're open Monday through Friday, 9am to 5pm."
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeFAQ(index)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

