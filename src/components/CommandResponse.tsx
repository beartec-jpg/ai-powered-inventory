import { motion } from 'framer-motion'
import { CheckCircle, WarningCircle, Info } from '@phosphor-icons/react'
import type { CommandLog } from '@/lib/types'

interface CommandResponseProps {
  log: CommandLog
}

export function CommandResponse({ log }: CommandResponseProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full"
    >
      <div className="flex gap-4 p-4 rounded-lg bg-card border border-border">
        <div className={`flex-shrink-0 mt-1 ${log.success ? 'text-accent' : 'text-destructive'}`}>
          {log.success ? (
            <CheckCircle size={24} weight="fill" />
          ) : (
            <WarningCircle size={24} weight="fill" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider font-medium">
              {log.action.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-2 font-mono">
            {log.command}
          </p>
          <p className={`text-base ${log.success ? 'text-foreground' : 'text-destructive'}`}>
            {log.result}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

interface AIClarificationProps {
  message: string
  interpretation: string
}

export function AIClarification({ message, interpretation }: AIClarificationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full"
    >
      <div className="flex gap-4 p-4 rounded-lg bg-card border border-accent/50">
        <div className="flex-shrink-0 mt-1 text-accent">
          <Info size={24} weight="fill" />
        </div>
        <div className="flex-1">
          <div className="mb-2">
            <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent uppercase tracking-wider font-medium">
              Clarification Needed
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            I understood: <span className="italic">{interpretation}</span>
          </p>
          <p className="text-base text-foreground">
            {message}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
