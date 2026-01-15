import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Microphone, MicrophoneSlash, SpeakerHigh, CheckCircle, XCircle } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  startRecognition,
  speak,
  stopSpeaking,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  type SpeechRecognitionResult,
} from '@/lib/speech'

interface SpeechAssistantProps {
  onCommandSubmit: (command: string) => void
  isProcessing: boolean
}

interface ParsedCommand {
  action: string
  parameters: Record<string, unknown>
  confidence: number
  reasoning: string
  clarificationNeeded?: string
  debug?: {
    stage2: {
      missingRequired: string[]
    }
  }
}

export function SpeechAssistant({ onCommandSubmit, isProcessing }: SpeechAssistantProps) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null)
  const [missingParams, setMissingParams] = useState<string[]>([])
  const [collectedParams, setCollectedParams] = useState<Record<string, unknown>>({})
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  // Check browser support
  const isSupported = isSpeechRecognitionSupported() && isSpeechSynthesisSupported()

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      stopSpeaking()
    }
  }, [])

  const handleStartListening = () => {
    if (!isSupported) {
      toast.error('Speech recognition not supported in this browser')
      return
    }

    if (isListening) {
      handleStopListening()
      return
    }

    setTranscript('')
    setInterimTranscript('')
    setParsedCommand(null)
    setMissingParams([])
    setCollectedParams({})
    setCurrentPrompt(null)
    setIsConfirming(false)

    recognitionRef.current = startRecognition({
      onStart: () => {
        setIsListening(true)
        toast.info('Listening... Speak your command')
      },
      onResult: (result: SpeechRecognitionResult) => {
        if (result.isFinal) {
          setTranscript((prev) => (prev ? prev + ' ' + result.transcript : result.transcript).trim())
          setInterimTranscript('')
        } else {
          setInterimTranscript(result.transcript)
        }
      },
      onEnd: () => {
        setIsListening(false)
        setInterimTranscript('')
        
        // If we have a transcript, process it
        const finalTranscript = transcript.trim()
        if (finalTranscript) {
          handleProcessTranscript(finalTranscript)
        }
      },
      onError: (error: string) => {
        setIsListening(false)
        toast.error(error)
      },
    })
  }

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }

  const handleProcessTranscript = async (text: string) => {
    try {
      // If we're collecting missing parameters
      if (currentPrompt && missingParams.length > 0) {
        const nextParam = missingParams[0]
        const updatedCollected = { ...collectedParams, [nextParam]: text }
        setCollectedParams(updatedCollected)

        const remainingParams = missingParams.slice(1)
        setMissingParams(remainingParams)

        if (remainingParams.length > 0) {
          // Ask for next parameter
          const nextPrompt = `What is the ${remainingParams[0]}?`
          setCurrentPrompt(nextPrompt)
          await speakPrompt(nextPrompt)
        } else {
          // All parameters collected, execute command
          setCurrentPrompt(null)
          const fullParams = { ...parsedCommand?.parameters, ...updatedCollected }
          await confirmAndExecute(parsedCommand?.action || '', fullParams)
        }
        return
      }

      // If we're confirming execution
      if (isConfirming) {
        const answer = text.toLowerCase().trim()
        if (answer.includes('yes') || answer === 'confirm' || answer === 'execute') {
          await speakPrompt('Executing command')
          onCommandSubmit(transcript)
          resetState()
        } else if (answer.includes('no') || answer === 'cancel') {
          await speakPrompt('Command cancelled')
          resetState()
        } else {
          await speakPrompt('Please say yes to confirm or no to cancel')
        }
        return
      }

      // Parse the command
      const response = await fetch('/api/ai/parse-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: text }),
      })

      if (!response.ok) {
        throw new Error('Failed to parse command')
      }

      const result = await response.json()
      const parsed: ParsedCommand = result.data || result

      setParsedCommand(parsed)

      // Check for missing required parameters
      const missing = parsed.debug?.stage2?.missingRequired || []
      
      if (missing.length > 0) {
        setMissingParams(missing)
        const firstPrompt = `I need more information. What is the ${missing[0]}?`
        setCurrentPrompt(firstPrompt)
        await speakPrompt(firstPrompt)
      } else {
        // Command is complete, ask for confirmation
        await confirmAndExecute(parsed.action, parsed.parameters)
      }
    } catch (error) {
      console.error('Error processing transcript:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to process command'
      toast.error(errorMsg)
      await speakPrompt('Sorry, I could not process that command')
    }
  }

  const confirmAndExecute = async (action: string, parameters: Record<string, unknown>) => {
    setIsConfirming(true)
    const confirmMsg = `I will ${action.toLowerCase().replace(/_/g, ' ')} with the provided parameters. Say yes to confirm or no to cancel.`
    setCurrentPrompt(confirmMsg)
    await speakPrompt(confirmMsg)
  }

  const speakPrompt = async (text: string) => {
    try {
      setIsSpeaking(true)
      await speak(text)
    } catch (error) {
      console.error('Error speaking:', error)
    } finally {
      setIsSpeaking(false)
    }
  }

  const resetState = () => {
    setTranscript('')
    setInterimTranscript('')
    setParsedCommand(null)
    setMissingParams([])
    setCollectedParams({})
    setCurrentPrompt(null)
    setIsConfirming(false)
  }

  const handleCancel = async () => {
    handleStopListening()
    stopSpeaking()
    await speakPrompt('Cancelled')
    resetState()
  }

  if (!isSupported) {
    return (
      <Card className="w-full bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MicrophoneSlash size={24} />
            Speech Assistant Unavailable
          </CardTitle>
          <CardDescription>
            Your browser does not support speech recognition or synthesis. Please use Chrome, Edge, or Safari.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Microphone size={24} weight={isListening ? 'fill' : 'regular'} />
          Voice Assistant
        </CardTitle>
        <CardDescription>
          Click the microphone to start speaking your command
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Control Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleStartListening}
            disabled={isProcessing || isSpeaking}
            size="lg"
            className={`flex-1 ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-accent hover:bg-accent/90'
            }`}
          >
            <AnimatePresence mode="wait">
              {isListening ? (
                <motion.div
                  key="listening"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    <Microphone size={20} weight="fill" />
                  </motion.div>
                  Stop Listening
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Microphone size={20} />
                  Start Voice Command
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
          
          {(transcript || currentPrompt) && (
            <Button
              onClick={handleCancel}
              variant="outline"
              size="lg"
              disabled={isProcessing}
            >
              <XCircle size={20} />
            </Button>
          )}
        </div>

        {/* Status Indicators */}
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            >
              <SpeakerHigh size={16} />
            </motion.div>
            Speaking...
          </motion.div>
        )}

        {/* Transcript Display */}
        {(transcript || interimTranscript) && (
          <div className="space-y-2">
            <Separator />
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Transcript:</div>
              <div className="text-sm font-mono bg-muted p-3 rounded-md">
                {transcript}
                {interimTranscript && (
                  <span className="text-muted-foreground italic"> {interimTranscript}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Current Prompt */}
        {currentPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <Separator />
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Assistant:</div>
              <div className="text-sm bg-accent/10 p-3 rounded-md border border-accent/20">
                {currentPrompt}
              </div>
            </div>
          </motion.div>
        )}

        {/* Parsed Command Display */}
        {parsedCommand && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">Parsed Action:</div>
                <Badge variant="secondary">{parsedCommand.action}</Badge>
              </div>
              
              {Object.keys(parsedCommand.parameters).length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Parameters:</div>
                  <div className="text-xs font-mono bg-muted p-2 rounded-md">
                    {Object.entries(parsedCommand.parameters).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-muted-foreground">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(collectedParams).length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-green-600">Collected via voice:</div>
                  <div className="text-xs font-mono bg-green-50 dark:bg-green-950 p-2 rounded-md">
                    {Object.entries(collectedParams).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-muted-foreground">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Confirmation State */}
        {isConfirming && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 p-4 bg-accent/10 rounded-md border border-accent/20"
          >
            <CheckCircle size={20} className="text-accent" />
            <span className="text-sm font-medium">Awaiting confirmation...</span>
          </motion.div>
        )}

        {/* Missing Parameters */}
        {missingParams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <Separator />
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Missing Information ({missingParams.length} remaining):
              </div>
              <div className="flex flex-wrap gap-2">
                {missingParams.map((param) => (
                  <Badge key={param} variant="outline">
                    {param}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
