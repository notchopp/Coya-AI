# Vapi Integration Setup - Vercel Serverless

This replaces your n8n webhook and tool with fast Vercel serverless endpoints that can handle high concurrency without queueing issues.

## 📦 Two Endpoints

1. **`/api/vapi-webhook`** - Receives call updates from Vapi (replaces n8n webhook)
2. **`/api/vapi-context`** - Returns business context for Vapi calls (replaces n8n tool)

## 🚀 Why This is Better

- **No Queue Delays**: Processes in ~100-200ms vs n8n's queue system
- **Handles High Concurrency**: Can process 10+ concurrent calls without exploding
- **Cost Effective**: No per-execution credits (12-20 turns = 1 webhook call, not 20)
- **Instant Updates**: Supabase Realtime updates your UI immediately
- **Context Injection**: Business context returned in webhook response (no separate tool calls needed)

## 📋 Setup Steps

### 1. Deploy to Vercel

The endpoint is already created at `/api/vapi-webhook`. After you push to main, it will be available at:

```
https://your-app.vercel.app/api/vapi-webhook
```

### 2. Configure Vapi

#### Webhook Configuration

1. Go to your Vapi Dashboard
2. Navigate to **Phone Numbers** → Select your phone number
3. Find the **"Server URL"** or **"Webhook URL"** field
4. Paste your Vercel webhook endpoint URL:
   ```
   https://your-app.vercel.app/api/vapi-webhook
   ```
5. Save the configuration

#### Context Tool Configuration (Required for Context Injection)

**Important**: Vapi cannot use webhook responses for context injection. You need to add the context endpoint as a tool.

1. Go to **Tools** in Vapi Dashboard
2. Add a new **Server URL** tool
3. **URL**: `https://coya-ai.vercel.app/api/vapi-context` (or your Vercel URL)
4. **Method**: `POST`
5. **Request Body**: `{ "to_number": "{{phoneNumber.number}}" }`
   - Alternative formats also supported:
     - `{ "phoneNumber": { "number": "{{phoneNumber.number}}" } }`
     - `{ "to_number": "{{call.phoneNumber.number}}" }`
6. **Description**: "Get business context for the current call (name, hours, services, FAQs, etc.)"
7. **Function Name**: `get_business_context` (or any name you prefer)

**How it works**: Vapi will call this tool during calls to get business context. The endpoint returns all business data (name, hours, services, FAQs, insurances, staff, promos, etc.) that your AI can use to answer questions.

### 3. Test the Endpoints

Both endpoints include GET handlers for health checks:

```bash
# Test webhook
curl https://your-app.vercel.app/api/vapi-webhook
# Should return: {"status":"ok","service":"vapi-webhook"}

# Test context endpoint
curl https://your-app.vercel.app/api/vapi-context
# Should return: {"status":"ok","service":"vapi-context","description":"Returns business context for Vapi calls"}
```

Test the context endpoint with a POST request:

```bash
curl -X POST https://your-app.vercel.app/api/vapi-context \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1234567890"}'
# Should return full business context JSON
```

## 🔄 How It Works

### Webhook Flow

1. **Vapi sends webhook** → Your Vercel endpoint receives it
2. **Extract data** from Vapi payload:
   - `call.id` → `call_id`
   - `call.phoneNumber.number` or `variables.phoneNumber.number` → `to_number`
   - `call.workflowId` or `variables.id` → `workflowId`
   - `message.status` → `status`
   - `message.artifact.transcript` → `transcript`
   - `message.analysis.summary` → `summary`
   - `message.turns[]` → `call_turns` table

3. **Lookup business** by `to_number` or `workflowId`
4. **Upsert call record** in `calls` table
5. **Upsert call turns** in `call_turns` table (if present)
6. **Update total_turns** count
7. **Return success + full business context** to Vapi (includes name, hours, services, FAQs, etc.)

### Data Mapping

| Vapi Field | Database Field | Notes |
|------------|----------------|-------|
| `call.id` | `call_id` | Primary identifier |
| `call.phoneNumber.number` | `to_number` | Used to lookup business |
| `call.workflowId` | `business_id` | Alternative lookup method |
| `message.status` | `status` | Call status |
| `message.artifact.transcript` | `transcript` | Full transcript |
| `message.analysis.summary` | `last_summary` | AI summary |
| `message.analysis.intent` | `last_intent` | Call intent |
| `message.turns[]` | `call_turns` | Individual conversation turns |

## 🛡️ Error Handling

- **Missing call_id**: Returns 400 error
- **Business not found**: Logs warning but returns 200 (so Vapi doesn't retry)
- **Database errors**: Logs error but returns 200 (prevents infinite retries)
- **All errors logged**: Check Vercel logs for debugging

## 📊 Performance

- **Response Time**: ~100-200ms per webhook
- **Concurrency**: Handles 10+ concurrent calls easily
- **No Queue**: Direct processing, no delays
- **Auto-scaling**: Vercel handles traffic spikes automatically

## 🔍 Monitoring

Check your Vercel dashboard for:
- Function logs
- Response times
- Error rates
- Invocation counts

## 🧪 Testing

You can test the webhook locally:

```bash
# Start dev server
npm run dev

# Test with curl (replace with actual Vapi payload)
curl -X POST http://localhost:3000/api/vapi-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "call": {
        "id": "test-call-123",
        "workflowId": "your-business-id",
        "phoneNumber": { "number": "+1234567890" }
      },
      "status": "in-progress"
    }
  }'
```

## ⚙️ Environment Variables Required

Make sure these are set in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` ✅ (already set)
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (already set)

## 📝 Webhook Response Format

The webhook now returns full business context in the response:

```json
{
  "success": true,
  "call_id": "call-123",
  "business_id": "business-456",
  "message_type": "conversation-update",
  "status": "in-progress",
  "business": {
    "id": "business-456",
    "name": "Your Business Name",
    "vertical": "healthcare",
    "address": "123 Main St",
    "hours": { "monday": "9am-5pm", ... },
    "services": ["Service 1", "Service 2"],
    "insurances": ["Insurance 1", "Insurance 2"],
    "staff": [...],
    "faqs": [...],
    "promos": [...],
    "to_number": "+1234567890"
  }
}
```

Vapi can use this business context data directly from the webhook response, eliminating the need for separate tool calls.

## 🎯 Next Steps

1. ✅ Deploy to Vercel (already done when you push)
2. ✅ Update Vapi webhook URL to point to Vercel
3. ✅ (Optional) Add context endpoint as a tool if you want explicit tool calls
4. ✅ Test with a real call - check webhook response for business context
5. ✅ Monitor Vercel logs for any issues
6. ✅ Keep n8n disabled or use it for secondary workflows (daily summaries, follow-ups, etc.)

## 🔄 Migration from n8n

Once this is working:
- ✅ **Disable n8n webhook** - Vercel webhook handles all call updates
- ✅ **Disable n8n tool** - Business context is returned in webhook response (or use `/api/vapi-context` as a tool)
- ✅ **Use n8n for batch jobs** - Daily summaries, reports, follow-ups, etc.
- ✅ **All real-time call processing** happens in Vercel

## 💡 How Context Injection Works

**Option 1: Webhook Response (Recommended)**
- The webhook automatically returns full business context in every response
- Vapi can access this data from the webhook response
- No additional tool calls needed
- More efficient (1 call instead of 15-20)

**Option 2: Separate Tool Call**
- Add `/api/vapi-context` as a Server URL tool in Vapi
- Vapi calls it when needed: `{ "to_number": "{{phoneNumber.number}}" }`
- Returns same business context data
- Use this if you need explicit tool calls in your workflow

