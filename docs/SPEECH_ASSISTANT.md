# Speech Assistant Feature

## Overview

The Speech Assistant is a voice-activated interface for the AI-powered inventory system, allowing users to execute inventory commands using natural voice input. It leverages the Web Speech API to provide speech recognition and text-to-speech capabilities.

## Features

### Voice Command Recognition
- **Continuous Listening**: The assistant continuously listens while the microphone is active
- **Real-time Transcription**: Speech is transcribed in real-time with visual feedback
- **Interim Results**: Shows partial transcriptions as you speak

### Intelligent Command Processing
- **AI Integration**: Voice commands are parsed by the same `/api/ai/parse-command` endpoint used for text commands
- **Missing Parameter Handling**: Automatically detects missing parameters and asks follow-up questions
- **Voice Prompts**: Uses text-to-speech to guide users through multi-step flows
- **Confirmation Flow**: Asks for verbal confirmation before executing commands

### User Experience
- **Visual Feedback**: Animated microphone icon, transcript display, and status indicators
- **Error Handling**: Graceful fallback for unsupported browsers
- **Browser Compatibility**: Works with Chrome, Edge, and Safari

## Usage

### Enabling the Feature

1. Set the feature flag in your `.env` file:
   ```env
   VITE_FEATURE_SPEECH=true
   ```

2. Restart the development server

3. The Speech Assistant will appear on the Dashboard below the text command input

### Using Voice Commands

1. **Start Listening**: Click the microphone button
2. **Grant Permissions**: Allow microphone access when prompted by your browser
3. **Speak Your Command**: Clearly state your inventory command, for example:
   - "Add 50 units of bearing-202 to warehouse A"
   - "Search for cables"
   - "Show low stock items"
   - "Receive 100 bolts into Van 1"

4. **Provide Missing Information**: If parameters are missing, the assistant will ask follow-up questions via voice
5. **Confirm Execution**: Say "yes" to execute the command or "no" to cancel
6. **Stop Listening**: Click the microphone button again to stop (or it stops automatically after processing)

## Technical Implementation

### Architecture

```
User Voice Input
       ↓
Web Speech API (Recognition)
       ↓
Real-time Transcript
       ↓
/api/ai/parse-command
       ↓
Missing Parameters Check
       ↓ (if missing)
Voice Prompt → User Response → Collect Parameter
       ↓ (repeat until complete)
Confirmation Prompt
       ↓
Voice Confirmation
       ↓
Command Execution
       ↓
Voice Feedback
```

### Core Components

#### `src/lib/speech.ts`
Wrapper library for Web Speech API:

- **`speak(text, options)`**: Text-to-speech function
  - Parameters: text string, optional voice settings (rate, pitch, volume, language)
  - Returns: Promise that resolves when speech completes
  
- **`startRecognition(callbacks)`**: Start speech recognition
  - Parameters: callbacks object with `onResult`, `onStart`, `onEnd`, `onError`
  - Returns: Object with `stop()` method
  
- **`stopSpeaking()`**: Cancel any ongoing speech
  
- **`isSpeechSynthesisSupported()`**: Check if text-to-speech is available
  
- **`isSpeechRecognitionSupported()`**: Check if speech recognition is available

#### `src/components/SpeechAssistant.tsx`
React component for the voice interface:

**Props:**
- `onCommandSubmit: (command: string) => void` - Callback when command is ready
- `isProcessing: boolean` - Whether a command is currently being processed

**State Management:**
- Transcript accumulation
- Missing parameter tracking
- Collected parameter storage
- Confirmation state
- Speaking/listening indicators

**UI Elements:**
- Animated microphone button
- Real-time transcript display
- Current prompt/question display
- Parsed command visualization
- Missing parameters list
- Confirmation status

### Data Flow

1. **Voice Input Capture**:
   ```typescript
   startRecognition({
     onResult: (result) => {
       if (result.isFinal) {
         setTranscript(prev => prev + ' ' + result.transcript)
       }
     }
   })
   ```

2. **Command Parsing**:
   ```typescript
   const response = await fetch('/api/ai/parse-command', {
     method: 'POST',
     body: JSON.stringify({ command: transcript })
   })
   const parsed = await response.json()
   ```

3. **Missing Parameter Collection**:
   ```typescript
   if (parsed.debug?.stage2?.missingRequired.length > 0) {
     const prompt = `What is the ${missingParam}?`
     await speak(prompt)
     // Wait for user to speak the answer
     // Collect and repeat until all parameters present
   }
   ```

4. **Confirmation and Execution**:
   ```typescript
   await speak('Say yes to confirm or no to cancel')
   // Wait for user response
   if (answer === 'yes') {
     onCommandSubmit(transcript)
   }
   ```

## Browser Compatibility

| Browser | Recognition | Synthesis | Status |
|---------|-------------|-----------|--------|
| Chrome 25+ | ✅ | ✅ | Fully Supported |
| Edge 79+ | ✅ | ✅ | Fully Supported |
| Safari 14.1+ | ✅ | ✅ | Fully Supported |
| Firefox | ❌ | ❌ | Not Supported |
| Opera 27+ | ✅ | ✅ | Fully Supported |

**Note**: The component displays a user-friendly message on unsupported browsers.

## Security & Privacy

### Microphone Permissions
- Browser handles permission requests automatically
- Users must explicitly grant microphone access
- Permission can be revoked at any time through browser settings

### Data Privacy
- **No Recording**: Audio is processed in real-time, not recorded
- **No Storage**: Voice data is not stored on servers
- **No Transmission**: Only text transcripts are sent to the API
- **Local Processing**: Speech recognition happens in the browser

### Feature Flag Control
- Feature is disabled by default (`VITE_FEATURE_SPEECH=false`)
- Allows gradual rollout and testing
- Can be disabled instantly if issues arise

## Troubleshooting

### Microphone Not Working
1. Check browser permissions (click lock icon in address bar)
2. Ensure microphone is not in use by another application
3. Try refreshing the page
4. Check browser console for errors

### Recognition Not Accurate
1. Speak clearly and at a moderate pace
2. Reduce background noise
3. Use a better quality microphone
4. Try using Chrome or Edge for best results

### Commands Not Executing
1. Check the transcript display to verify what was recognized
2. Ensure you say "yes" clearly during confirmation
3. Check that the command format is correct
4. Review the parsed parameters shown in the UI

### Component Not Visible
1. Verify `VITE_FEATURE_SPEECH=true` in your `.env` file
2. Restart the development server
3. Clear browser cache and reload
4. Check browser console for errors

## Development

### Adding New Voice Prompts

Modify the prompt messages in `SpeechAssistant.tsx`:

```typescript
const confirmMsg = `I will ${action} with these parameters. Say yes to confirm.`
await speakPrompt(confirmMsg)
```

### Customizing Voice Settings

Modify the `speak()` function call:

```typescript
await speak(text, {
  rate: 1.0,   // Speed: 0.1 to 10
  pitch: 1.0,  // Pitch: 0 to 2
  volume: 1.0, // Volume: 0 to 1
  lang: 'en-US' // Language code
})
```

### Testing Without Microphone

For development without a microphone, you can:
1. Use browser DevTools to simulate voice input
2. Add a text fallback input for testing
3. Mock the Web Speech API in tests

### Adding Language Support

To support multiple languages:

1. Modify `startRecognition()` in `speech.ts`:
   ```typescript
   recognition.lang = 'es-ES' // Spanish
   ```

2. Update voice prompts to support multiple languages
3. Add language selection UI

## Future Enhancements

- [ ] Multi-language support
- [ ] Custom wake word ("Hey Assistant...")
- [ ] Voice shortcuts for common commands
- [ ] Voice command history
- [ ] Accent/dialect adaptation
- [ ] Offline recognition support
- [ ] Voice training for better accuracy
- [ ] Command templates for complex operations
- [ ] Integration with mobile devices
- [ ] Voice-based navigation

## References

- [Web Speech API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [SpeechRecognition Interface](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [SpeechSynthesis Interface](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
- [Browser Compatibility Table](https://caniuse.com/speech-recognition)
