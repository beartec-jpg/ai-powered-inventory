import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PaperPlaneRight, Sparkle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface CommandInputProps {
  onSubmit: (command: string) => void
  isProcessing: boolean
}

export function CommandInput({ onSubmit, isProcessing }: CommandInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = () => {
    if (input.trim() && !isProcessing) {
      onSubmit(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-start gap-3">
        <div className="flex-1 relative">
          <div className="absolute left-4 top-4 text-accent pointer-events-none">
            <Sparkle weight="fill" size={20} />
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me what you want to do... (e.g., 'add 50 units of bearing-202 to warehouse A')"
            className="min-h-[72px] pl-12 pr-4 font-mono text-lg bg-card border-input focus:border-accent transition-all resize-none"
            disabled={isProcessing}
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!input.trim() || isProcessing}
          size="lg"
          className="h-[72px] px-6 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {isProcessing ? (
            <motion.div
              className="flex gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
              >
                •
              </motion.span>
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              >
                •
              </motion.span>
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
              >
                •
              </motion.span>
            </motion.div>
          ) : (
            <PaperPlaneRight size={20} weight="fill" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 ml-1">
        Press Enter to submit, Shift+Enter for new line
      </p>
    </div>
  )
}
