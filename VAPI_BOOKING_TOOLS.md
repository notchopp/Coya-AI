# VAPI Booking Tools - API Endpoints

This document contains all the booking-related API endpoints for VAPI tool configuration.

## 🎯 Multi-Provider Support

**All endpoints now support multiple calendar providers:**
- ✅ **Google Calendar** (OAuth)
- ✅ **Microsoft Outlook** (OAuth via Microsoft Graph API)
- ✅ **Calendly** (API Key)

The system automatically detects which provider is connected and uses the appropriate API. No changes needed in your VAPI tool configuration - the same endpoints work for all providers!

## Base URL

**Production:**
```
https://coya-ai.vercel.app
```

**Local Development:**
```
http://localhost:3000
```

Replace the base URL in the examples below with your actual deployment URL.

---

## 1. Create Booking

**Endpoint:** `POST /api/calendar/create-booking`

**URL:**
```
https://coya-ai.vercel.app/api/calendar/create-booking
```

**Request Body:**
```json
{
  "business_id": "uuid",
  "program_id": "uuid (optional)",
  "date": "2024-01-15",
  "time": "14:00",
  "duration_minutes": 30,
  "patient_name": "John Doe",
  "service": "Botox",
  "phone": "+1234567890",
  "email": "patient@example.com",
  "notes": "First time patient"
}
```

**Response:**
```json
{
  "success": true,
  "event_id": "google_calendar_event_id",
  "event_link": "https://calendar.google.com/...",
  "start_time": "2024-01-15T14:00:00.000Z",
  "end_time": "2024-01-15T14:30:00.000Z"
}
```

---

## 2. Check Availability

**Endpoint:** `POST /api/calendar/check-availability`

**URL:**
```
https://coya-ai.vercel.app/api/calendar/check-availability
```

**Request Body:**
```json
{
  "business_id": "uuid",
  "program_id": "uuid (optional)",
  "date": "2024-01-15",
  "time": "14:00",
  "duration_minutes": 30
}
```

**Response:**
```json
{
  "available": true,
  "requested_slot": {
    "date": "2024-01-15",
    "time": "14:00",
    "duration_minutes": 30
  },
  "next_available_slots": [
    {
      "date": "2024-01-16",
      "time": "09:00"
    },
    {
      "date": "2024-01-16",
      "time": "10:00"
    }
  ]
}
```

---

## 3. Reschedule Booking

**Endpoint:** `POST /api/calendar/reschedule-booking`

**URL:**
```
https://coya-ai.vercel.app/api/calendar/reschedule-booking
```

**Request Body:**
```json
{
  "business_id": "uuid",
  "program_id": "uuid (optional)",
  "event_id": "google_calendar_event_id",
  "new_date": "2024-01-20",
  "new_time": "15:00",
  "duration_minutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "event_id": "google_calendar_event_id",
  "event_link": "https://calendar.google.com/...",
  "new_start_time": "2024-01-20T15:00:00.000Z",
  "new_end_time": "2024-01-20T15:30:00.000Z"
}
```

---

## 4. Cancel Booking

**Endpoint:** `POST /api/calendar/cancel-booking`

**URL:**
```
https://coya-ai.vercel.app/api/calendar/cancel-booking
```

**Request Body:**
```json
{
  "business_id": "uuid",
  "program_id": "uuid (optional)",
  "event_id": "google_calendar_event_id",
  "reason": "Patient requested cancellation (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "event_id": "google_calendar_event_id",
  "cancelled": true,
  "method": "marked_cancelled"
}
```

---

## VAPI Tool Configuration

Add these as **Server URL** tools in your VAPI dashboard:

### Tool 1: Create Booking
- **Name:** `create_booking`
- **Type:** Server URL
- **URL:** `https://coya-ai.vercel.app/api/calendar/create-booking`
- **Method:** POST
- **Description:** Creates a new appointment in the connected Google Calendar

### Tool 2: Check Availability
- **Name:** `check_availability`
- **Type:** Server URL
- **URL:** `https://coya-ai.vercel.app/api/calendar/check-availability`
- **Method:** POST
- **Description:** Checks if a time slot is available in the calendar

### Tool 3: Reschedule Booking
- **Name:** `reschedule_booking`
- **Type:** Server URL
- **URL:** `https://coya-ai.vercel.app/api/calendar/reschedule-booking`
- **Method:** POST
- **Description:** Reschedules an existing appointment to a new date/time

### Tool 4: Cancel Booking
- **Name:** `cancel_booking`
- **Type:** Server URL
- **URL:** `https://coya-ai.vercel.app/api/calendar/cancel-booking`
- **Method:** POST
- **Description:** Cancels an existing appointment

---

## Notes

- All endpoints require `business_id` in the request body
- `program_id` is optional - only include if the business has programs
- `event_id` is the calendar provider's event ID (returned when creating a booking)
- All dates should be in `YYYY-MM-DD` format
- All times should be in `HH:MM` format (24-hour)
- **Multi-Provider**: The endpoints automatically detect and use the connected calendar provider (Google, Outlook, or Calendly)
- The endpoints automatically handle OAuth token refresh (for Google and Outlook)
- Timezone defaults to `America/New_York` (can be made configurable per business)

## Provider-Specific Notes

### Google Calendar
- Uses OAuth 2.0
- Full CRUD support (create, read, update, delete)
- Automatic token refresh

### Microsoft Outlook
- Uses Microsoft Graph API
- Full CRUD support (create, read, update, delete)
- Automatic token refresh
- Requires `OUTLOOK_CLIENT_ID` and `OUTLOOK_CLIENT_SECRET` environment variables

### Calendly
- Uses API Key authentication
- Limited support (read, cancel only - no direct create/update)
- For Calendly, consider using scheduling links instead of direct event creation
- Requires `api_key` stored in `calendar_connections` table

---

## Testing

You can test these endpoints using curl:

```bash
# Create Booking
curl -X POST https://coya-ai.vercel.app/api/calendar/create-booking \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "your-business-id",
    "date": "2024-01-15",
    "time": "14:00",
    "duration_minutes": 30,
    "patient_name": "John Doe"
  }'

# Check Availability
curl -X POST https://coya-ai.vercel.app/api/calendar/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "your-business-id",
    "date": "2024-01-15",
    "time": "14:00",
    "duration_minutes": 30
  }'

# Reschedule Booking
curl -X POST https://coya-ai.vercel.app/api/calendar/reschedule-booking \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "your-business-id",
    "event_id": "google-event-id",
    "new_date": "2024-01-20",
    "new_time": "15:00"
  }'

# Cancel Booking
curl -X POST https://coya-ai.vercel.app/api/calendar/cancel-booking \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "your-business-id",
    "event_id": "google-event-id",
    "reason": "Patient requested"
  }'
```

