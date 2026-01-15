/**
 * Speech helpers using Web Speech API
 * Provides text-to-speech and speech recognition functionality
 */

// Check if Web Speech API is available
export const isSpeechSynthesisSupported = (): boolean => {
  return 'speechSynthesis' in window
}

export const isSpeechRecognitionSupported = (): boolean => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

/**
 * Speak text using Web Speech API
 * @param text - The text to speak
 * @param options - Speech synthesis options
 * @returns Promise that resolves when speech is complete
 */
export const speak = (
  text: string,
  options?: {
    rate?: number // 0.1 to 10, default 1
    pitch?: number // 0 to 2, default 1
    volume?: number // 0 to 1, default 1
    lang?: string // default 'en-US'
  }
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!isSpeechSynthesisSupported()) {
      reject(new Error('Speech synthesis not supported'))
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    
    // Apply options
    if (options?.rate) utterance.rate = options.rate
    if (options?.pitch) utterance.pitch = options.pitch
    if (options?.volume) utterance.volume = options.volume
    if (options?.lang) utterance.lang = options.lang

    utterance.onend = () => resolve()
    utterance.onerror = (event) => reject(new Error(`Speech error: ${event.error}`))

    window.speechSynthesis.speak(utterance)
  })
}

/**
 * Stop any ongoing speech
 */
export const stopSpeaking = (): void => {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel()
  }
}

export interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

export interface SpeechRecognitionCallbacks {
  onResult?: (result: SpeechRecognitionResult) => void
  onEnd?: () => void
  onError?: (error: string) => void
  onStart?: () => void
}

// Type definitions for Web Speech API
interface SpeechRecognitionResultItem {
  transcript: string
  confidence: number
}

interface SpeechRecognitionAlternative {
  isFinal: boolean
  [index: number]: SpeechRecognitionResultItem
}

interface SpeechRecognitionEvent {
  results: {
    length: number
    [index: number]: SpeechRecognitionAlternative
  }
}

interface SpeechRecognitionErrorEvent {
  error: string
}

/**
 * Start speech recognition
 * @param callbacks - Callbacks for recognition events
 * @returns Object with stop method to stop recognition
 */
export const startRecognition = (
  callbacks: SpeechRecognitionCallbacks = {}
): { stop: () => void } => {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError?.('Speech recognition not supported')
    return { stop: () => {} }
  }

  // Get SpeechRecognition constructor (with vendor prefix support)
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  const recognition = new SpeechRecognition()

  // Configuration
  recognition.continuous = true // Keep listening
  recognition.interimResults = true // Get interim results
  recognition.lang = 'en-US'
  recognition.maxAlternatives = 1

  recognition.onstart = () => {
    callbacks.onStart?.()
  }

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const last = event.results.length - 1
    const result = event.results[last]
    const transcript = result[0].transcript
    const confidence = result[0].confidence
    const isFinal = result.isFinal

    callbacks.onResult?.({
      transcript,
      confidence,
      isFinal,
    })
  }

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    let errorMessage = 'Speech recognition error'
    
    switch (event.error) {
      case 'no-speech':
        errorMessage = 'No speech detected'
        break
      case 'audio-capture':
        errorMessage = 'No microphone available'
        break
      case 'not-allowed':
        errorMessage = 'Microphone permission denied'
        break
      case 'network':
        errorMessage = 'Network error occurred'
        break
      default:
        errorMessage = `Speech recognition error: ${event.error}`
    }

    callbacks.onError?.(errorMessage)
  }

  recognition.onend = () => {
    callbacks.onEnd?.()
  }

  // Start recognition
  try {
    recognition.start()
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error.message : 'Failed to start recognition')
  }

  return {
    stop: () => {
      try {
        recognition.stop()
      } catch (error) {
        // Ignore errors when stopping
        console.warn('Error stopping recognition:', error)
      }
    },
  }
}
