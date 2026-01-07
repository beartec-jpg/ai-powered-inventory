import { ScrollArea } from '@/components/ui/scroll-area'
import type { CommandLog } from '@/lib/types'
import { ClockCounterClockwise, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface CommandHistoryProps {
  logs: CommandLog[]
}

export function CommandHistory({ logs }: CommandHistoryProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ClockCounterClockwise size={48} className="mx-auto mb-4 opacity-50" />
        <p>No command history yet</p>
        <p className="text-sm mt-2">Your executed commands will appear here</p>
      </div>
    )
  }

  const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-2">
        {sortedLogs.map((log, idx) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.05 }}
            className="p-3 rounded-lg bg-card border border-border hover:border-accent/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 mt-0.5 ${log.success ? 'text-accent' : 'text-destructive'}`}>
                {log.success ? (
                  <CheckCircle size={18} weight="fill" />
                ) : (
                  <WarningCircle size={18} weight="fill" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider font-medium">
                    {log.action.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm font-mono text-foreground truncate">
                  {log.command}
                </p>
                {log.result && (
                  <p className={`text-xs mt-1 ${log.success ? 'text-muted-foreground' : 'text-destructive'}`}>
                    {log.result}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  )
}
