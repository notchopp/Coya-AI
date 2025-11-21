# Fix High-Pitched Voice Issue

## Problem
The AI assistant randomly gets a high-pitched voice during calls.

## Common Causes & Solutions

### 1. TTS (Text-to-Speech) Provider Settings

The voice pitch is controlled by your TTS provider settings in Vapi. Check your Vapi assistant configuration:

#### For ElevenLabs:
- **Stability**: Should be between 0.5-0.75 (higher = more consistent)
- **Similarity Boost**: Should be between 0.5-0.75
- **Style**: Set to 0.0 for neutral voice
- **Use Speaker Boost**: Enable this for better quality

**Fix Steps:**
1. Go to Vapi Dashboard → Your Assistant
2. Navigate to "Voice" settings
3. If using ElevenLabs:
   - Set Stability to `0.65`
   - Set Similarity Boost to `0.65`
   - Set Style to `0.0`
   - Enable "Speaker Boost"
4. Save and test

#### For OpenAI TTS:
- **Voice**: Use `alloy`, `echo`, `fable`, `onyx`, `nova`, or `shimmer`
- **Speed**: Should be `1.0` (normal speed)
- Avoid `nova` if experiencing pitch issues (it can be inconsistent)

**Fix Steps:**
1. Go to Vapi Dashboard → Your Assistant
2. Navigate to "Voice" settings
3. If using OpenAI:
   - Try switching to `alloy` or `onyx` (most stable)
   - Set speed to `1.0`
   - Avoid `nova` if issues persist
4. Save and test

### 2. Voice Model Selection

Some voice models are more prone to pitch variations. Try these stable options:

**Recommended Voices:**
- **ElevenLabs**: `21m00Tcm4TlvDq8ikWAM` (Rachel - most stable)
- **OpenAI**: `alloy` or `onyx` (most consistent)
- **PlayHT**: `Michael` or `Sarah` (stable options)

### 3. Temperature/Model Settings

High temperature in the LLM can cause voice variations:

**Fix Steps:**
1. Go to Vapi Dashboard → Your Assistant
2. Navigate to "Model" settings
3. Set Temperature to `0.7` or lower (default is often 0.8-1.0)
4. Lower temperature = more consistent responses = more consistent voice

### 4. Real-time Audio Processing

Sometimes network latency causes audio artifacts:

**Fix Steps:**
1. Check your Vapi account's audio settings
2. Enable "High Quality Audio" if available
3. Check network connection during calls
4. Consider using a different TTS provider if issues persist

### 5. Voice Cloning Issues

If using a custom cloned voice:
- Ensure the source audio was high quality
- Re-clone the voice with better source material
- Increase stability settings

## Quick Fix Checklist

1. ✅ Check TTS provider settings (Stability, Similarity, Style)
2. ✅ Try a different voice model
3. ✅ Lower LLM temperature
4. ✅ Enable high-quality audio settings
5. ✅ Test with different TTS providers (ElevenLabs vs OpenAI)

## Recommended Configuration

**For Stable Voice (ElevenLabs):**
```
Voice ID: 21m00Tcm4TlvDq8ikWAM (Rachel)
Stability: 0.65
Similarity Boost: 0.65
Style: 0.0
Speaker Boost: Enabled
```

**For Stable Voice (OpenAI):**
```
Voice: alloy
Speed: 1.0
Model: gpt-4o or gpt-4o-mini
Temperature: 0.7
```

## Testing

After making changes:
1. Make a test call
2. Listen for pitch consistency
3. If still high-pitched, try a different voice model
4. Document which voice works best for your use case

## Contact Support

If the issue persists:
- Contact Vapi support with your assistant ID
- Provide examples of when the pitch changes
- Share your current TTS configuration

