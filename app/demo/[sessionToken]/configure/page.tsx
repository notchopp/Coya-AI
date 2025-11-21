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

  const updateService = (categoryIndex: number, serviceIndex: number, field: "name" | "price", value: string | number | null) => {
    const updated = [...formData.categories];
    updated[categoryIndex].services[serviceIndex] = {
      ...updated[categoryIndex].services[serviceIndex],
      [field]: value,
    };
    setFormData({ ...formData, categories: updated });
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

                  <div className="space-y-2">
                    {category.services.map((service, svcIndex) => (
                      <div key={service.id} className="flex items-center gap-2 p-2 rounded bg-black/50">
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => updateService(catIndex, svcIndex, "name", e.target.value)}
                          className="flex-1 px-2 py-1 rounded bg-black border border-white/10 text-white text-sm focus:outline-none"
                          placeholder="Service Name"
                        />
                        <input
                          type="number"
                          value={service.price || ""}
                          onChange={(e) => updateService(catIndex, svcIndex, "price", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-24 px-2 py-1 rounded bg-black border border-white/10 text-white text-sm focus:outline-none"
                          placeholder="Price"
                        />
                        <button
                          onClick={() => removeService(catIndex, svcIndex)}
                          className="p-1 rounded bg-red-500/20 border border-red-500/30 hover:bg-red-500/30"
                        >
                          <X className="h-3 w-3" />
                        </button>
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
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !formData.name.trim()}
          className="mt-8 w-full px-6 py-4 rounded-lg bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Save & Continue
        </button>
      </div>
    </div>
  );
}

