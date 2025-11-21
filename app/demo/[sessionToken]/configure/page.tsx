"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Save, Loader2, Plus, X, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
  services: Service[];
};

type Service = {
  id: string;
  name: string;
  price: number | null;
  preCareInstructions: string;
  afterCareInstructions: string;
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

export default function DemoConfigure() {
  const params = useParams();
  const router = useRouter();
  const sessionToken = params?.sessionToken as string;
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    categories: [] as Category[],
    hours: DAYS_OF_WEEK.map(day => ({ day, hours: "9:00 AM - 5:00 PM", closed: false })),
    faqs: [] as { id: string; question: string; answer: string }[],
  });

  const addCategory = () => {
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name: "",
      services: [],
    };
    setFormData({
      ...formData,
      categories: [...formData.categories, newCategory],
    });
  };

  const removeCategory = (index: number) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter((_, i) => i !== index),
    });
  };

  const updateCategory = (index: number, value: string) => {
    const updated = [...formData.categories];
    updated[index] = { ...updated[index], name: value };
    setFormData({ ...formData, categories: updated });
  };

  const addService = (categoryIndex: number) => {
    const newService: Service = {
      id: `svc_${Date.now()}`,
      name: "",
      price: null,
      preCareInstructions: "",
      afterCareInstructions: "",
    };
    const updated = [...formData.categories];
    updated[categoryIndex].services = [...updated[categoryIndex].services, newService];
    setFormData({ ...formData, categories: updated });
  };

  const removeService = (categoryIndex: number, serviceIndex: number) => {
    const updated = [...formData.categories];
    updated[categoryIndex].services = updated[categoryIndex].services.filter((_, i) => i !== serviceIndex);
    setFormData({ ...formData, categories: updated });
  };

  const updateService = (categoryIndex: number, serviceIndex: number, field: "name" | "price" | "preCareInstructions" | "afterCareInstructions", value: string | number | null) => {
    const updated = [...formData.categories];
    updated[categoryIndex].services[serviceIndex] = {
      ...updated[categoryIndex].services[serviceIndex],
      [field]: value,
    };
    setFormData({ ...formData, categories: updated });
  };

  const addFAQ = () => {
    const newFAQ = {
      id: `faq_${Date.now()}`,
      question: "",
      answer: "",
    };
    setFormData({
      ...formData,
      faqs: [...formData.faqs, newFAQ],
    });
  };

  const removeFAQ = (index: number) => {
    setFormData({
      ...formData,
      faqs: formData.faqs.filter((_, i) => i !== index),
    });
  };

  const updateFAQ = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...formData.faqs];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, faqs: updated });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Please enter a business name");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/demo/${sessionToken}/business`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          vertical: "medspa",
          categories: { categories: formData.categories },
          hours: formData.hours.reduce((acc, day) => {
            acc[day.day] = day.closed ? "Closed" : day.hours;
            return acc;
          }, {} as Record<string, string>),
          faqs: formData.faqs,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        router.push(`/demo/${sessionToken}/live`);
      } else {
        alert("Error saving: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error saving demo business:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/demo/${sessionToken}`}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="text-3xl font-bold mb-8">Configure Your Business</h1>
        
        <div className="space-y-6">
          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Business Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-black border border-white/10 text-white focus:outline-none focus:border-yellow-500/50"
              placeholder="Your Business Name"
            />
          </div>

          {/* Categories & Services */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium">Services</label>
              <button
                onClick={addCategory}
                className="px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors flex items-center gap-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </button>
            </div>

            <div className="space-y-4">
              {formData.categories.map((category, catIndex) => (
                <div key={category.id} className="p-4 rounded-lg bg-black border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) => updateCategory(catIndex, e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-black border border-white/10 text-white focus:outline-none focus:border-yellow-500/50"
                      placeholder="Category Name (e.g., Injectables)"
                    />
                    <button
                      onClick={() => removeCategory(catIndex)}
                      className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {category.services.map((service, svcIndex) => (
                      <div key={service.id} className="p-3 rounded-lg bg-black/50 border border-white/10">
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="text"
                            value={service.name}
                            onChange={(e) => updateService(catIndex, svcIndex, "name", e.target.value)}
                            className="flex-1 px-3 py-2 rounded bg-black border border-white/10 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                            placeholder="Service Name"
                          />
                          <input
                            type="number"
                            value={service.price || ""}
                            onChange={(e) => updateService(catIndex, svcIndex, "price", e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-24 px-3 py-2 rounded bg-black border border-white/10 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                            placeholder="Price"
                          />
                          <button
                            onClick={() => removeService(catIndex, svcIndex)}
                            className="p-2 rounded bg-red-500/20 border border-red-500/30 hover:bg-red-500/30"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-white/60 mb-1">Pre-Care Instructions</label>
                            <textarea
                              value={service.preCareInstructions}
                              onChange={(e) => updateService(catIndex, svcIndex, "preCareInstructions", e.target.value)}
                              rows={2}
                              className="w-full px-2 py-1 rounded bg-black border border-white/10 text-white text-xs focus:outline-none focus:border-yellow-500/50 resize-none"
                              placeholder="Instructions before appointment..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/60 mb-1">After-Care Instructions</label>
                            <textarea
                              value={service.afterCareInstructions}
                              onChange={(e) => updateService(catIndex, svcIndex, "afterCareInstructions", e.target.value)}
                              rows={2}
                              className="w-full px-2 py-1 rounded bg-black border border-white/10 text-white text-xs focus:outline-none focus:border-yellow-500/50 resize-none"
                              placeholder="Instructions after appointment..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => addService(catIndex)}
                      className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Service
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className="block text-sm font-medium mb-4">Business Hours</label>
            <div className="space-y-2">
              {formData.hours.map((day, index) => (
                <div key={day.day} className="flex items-center gap-3">
                  <span className="w-24 text-sm capitalize">{day.day}</span>
                  <input
                    type="text"
                    value={day.hours}
                    onChange={(e) => {
                      const updated = [...formData.hours];
                      updated[index].hours = e.target.value;
                      setFormData({ ...formData, hours: updated });
                    }}
                    disabled={day.closed}
                    className="flex-1 px-3 py-2 rounded-lg bg-black border border-white/10 text-white text-sm focus:outline-none disabled:opacity-50"
                    placeholder="9:00 AM - 5:00 PM"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={day.closed}
                      onChange={(e) => {
                        const updated = [...formData.hours];
                        updated[index].closed = e.target.checked;
                        setFormData({ ...formData, hours: updated });
                      }}
                      className="rounded"
                    />
                    Closed
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* FAQs */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="block text-sm font-medium">Frequently Asked Questions</label>
                <p className="text-xs text-white/60 mt-1">Common questions your AI receptionist can answer</p>
              </div>
              <button
                onClick={addFAQ}
                className="px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors flex items-center gap-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                Add FAQ
              </button>
            </div>

            <div className="space-y-4">
              {formData.faqs.map((faq, index) => (
                <div key={faq.id} className="p-4 rounded-lg bg-black border border-white/10">
                  <div className="flex items-start gap-2 mb-3">
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => updateFAQ(index, "question", e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-black border border-white/10 text-white focus:outline-none focus:border-yellow-500/50"
                      placeholder="Question"
                    />
                    <button
                      onClick={() => removeFAQ(index)}
                      className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    value={faq.answer}
                    onChange={(e) => updateFAQ(index, "answer", e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-black border border-white/10 text-white text-sm focus:outline-none focus:border-yellow-500/50 resize-none"
                    placeholder="Answer"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => router.push("/signup?founder=true")}
            className="px-6 py-4 rounded-lg bg-black border border-white/10 hover:border-white/20 transition-colors flex items-center justify-center gap-2 text-lg font-semibold"
          >
            Leave Demo
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !formData.name.trim()}
            className="flex-1 px-6 py-4 rounded-lg bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}




