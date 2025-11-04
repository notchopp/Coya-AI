# Receptionist Dashboard

A sleek, real-time dashboard for monitoring live receptionist calls, viewing call logs, managing bookings, and tracking ROI. Built for your 30 beta clients transitioning to the main UI.

## Features

- **Real-time Call Monitoring** - Live updates via Supabase Realtime subscriptions
- **Call Logs** - Searchable history with filtering
- **Calendar View** - Visual booking calendar with upcoming appointments
- **Live Waveform** - Animated visualization showing agent status
- **Settings** - Branding and customization options
- **Responsive Design** - Mobile-friendly with smooth animations

## Tech Stack

- **Next.js 16** - App Router with TypeScript
- **Supabase** - Real-time database and subscriptions
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Lucide React** - Icon library
- **Recharts** - Data visualization (ready for charts)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Supabase Setup

### Required Tables

The UI expects a `call_logs` table with the following structure:

```sql
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  vapi_call_id TEXT,
  from_number TEXT,
  to_number TEXT,
  status TEXT, -- 'in_progress', 'completed', etc.
  summary TEXT,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for multi-tenant access
CREATE POLICY "Users can access their business calls"
ON call_logs FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM user_businesses 
    WHERE user_id = auth.uid()
  )
);
```

### Enable Realtime

In Supabase Dashboard:
1. Go to Database → Replication
2. Enable replication for the `call_logs` table
3. This allows real-time updates in the UI

## Project Structure

```
receptionist-dashboard/
├── app/
│   ├── page.tsx          # Dashboard home
│   ├── calls/
│   │   └── page.tsx      # Live calls view
│   ├── logs/
│   │   └── page.tsx      # Call logs with search
│   ├── calendar/
│   │   └── page.tsx      # Booking calendar
│   └── settings/
│       └── page.tsx      # Settings page
├── components/
│   ├── DashboardLayout.tsx  # Main layout with sidebar
│   ├── RealtimeCalls.tsx    # Real-time call monitoring
│   └── LiveWaveform.tsx     # Animated waveform
└── lib/
    └── supabase.ts          # Supabase client setup
```

## Multi-Tenant Support

The dashboard is built with multi-tenant architecture:
- Calls are filtered by `business_id`
- Uses phone number (`to_number`) to identify businesses
- Row Level Security (RLS) policies ensure data isolation

## Customization

### Branding
- Update colors in `tailwind.config.ts`
- Modify branding in Settings page
- Add logo upload functionality

### Adding Real Data
- Replace mock stats in `app/page.tsx` with Supabase queries
- Connect calendar to your bookings table
- Add real-time subscriptions for bookings

## Next Steps

1. **Connect to your Supabase tables** - Update table names/queries if needed
2. **Add authentication** - Integrate Supabase Auth for user login
3. **Connect bookings** - Link calendar to your actual bookings table
4. **Add analytics** - Use Recharts for call volume charts, ROI metrics
5. **Customize branding** - Update colors, logos, company name

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

Private - Beta version for 30 clients
