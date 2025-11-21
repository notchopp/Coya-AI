"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { format } from "date-fns";
import { Search, Phone, Mail, Calendar, MessageSquare, FileText, User, X } from "lucide-react";

type Patient = {
  patient_id: string;
  patient_name: string | null;
  phone: string | null;
  email: string | null;
  last_visit: string | null;
  last_treatment: string | null;
  last_intent: string | null;
  last_call_date: string | null;
  notes: string | null;
  created_at: string;
  transcript: string | null;
};

export default function PatientsPage() {
  return <div>Patients Page</div>;
}
