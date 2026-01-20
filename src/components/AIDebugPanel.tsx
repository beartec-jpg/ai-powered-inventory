import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Bug, CheckCircle, XCircle, ArrowRight, Clock } from '@phosphor-icons/react'
import type { DebugInfo } from '@/lib/types'

interface AIDebugPanelProps {
  debugInfo: DebugInfo
}

export function AIDebugPanel({ debugInfo }: AIDebugPanelProps) {
  const { stage1, stage2, usedFallback, fallbackReason, rawCommand } = debugInfo

  const getConfidenceBadge = (confidence: number) => {
    if (confidence !== undefined && confidence !== null) {
      if (confidence >= 0.9) {
        return <Badge variant="default" className="bg-green-500">High ({confidence.toFixed(2)})</Badge>
      } else if (confidence >= 0.7) {
        return <Badge variant="default" className="bg-yellow-500">Medium ({confidence.toFixed(2)})</Badge>
      } else {
        return <Badge variant="destructive">Low ({confidence.toFixed(2)})</Badge>
      }
    }
    return <Badge variant="outline">N/A</Badge>
  }

  return (
    <Card className="p-6 border-2 border-primary/20 bg-muted/30">
      <div className="flex items-center gap-2 mb-4">
        <Bug size={24} className="text-primary" weight="fill" />
        <h3 className="text-lg font-semibold">AI Processing Debug</h3>
        {usedFallback && (
          <Badge variant="outline" className="ml-auto">
            Used Fallback
          </Badge>
        )}
      </div>

      <Separator className="mb-4" />

      {/* Raw Command */}
      <div className="mb-4">
        <div className="text-sm font-medium text-muted-foreground mb-1">Input Command</div>
        <div className="p-3 bg-background rounded-md border font-mono text-sm">
          "{rawCommand}"
        </div>
      </div>

      <Separator className="mb-4" />

      {/* Stage 1: Intent Classification */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            1
          </div>
          <h4 className="font-semibold">Stage 1: Intent Classification</h4>
        </div>
        <div className="ml-8 space-y-2">
          <div className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-1 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Action:</span>
              <div className="font-mono text-sm bg-background p-2 rounded border mt-1">
                {stage1.action}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-1 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Confidence:</span>
              <div className="mt-1">
                {getConfidenceBadge(stage1.confidence)}
              </div>
            </div>
          </div>
          {stage1.reasoning && (
            <div className="flex items-start gap-2">
              <ArrowRight size={16} className="mt-1 text-muted-foreground" />
              <div className="flex-1">
                <span className="text-sm text-muted-foreground">Reasoning:</span>
                <div className="text-sm bg-background p-2 rounded border mt-1">
                  {stage1.reasoning}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator className="mb-4" />

      {/* Stage 2: Parameter Extraction */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            2
          </div>
          <h4 className="font-semibold">Stage 2: Parameter Extraction</h4>
        </div>
        <div className="ml-8 space-y-2">
          <div className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-1 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Parameters:</span>
              <div className="mt-1 space-y-1">
                {Object.keys(stage2.parameters).length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">No parameters extracted</div>
                ) : (
                  Object.entries(stage2.parameters).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{key}:</span>
                      <code className="px-2 py-1 bg-background rounded border">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </code>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-1 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Confidence:</span>
              <div className="mt-1">
                {getConfidenceBadge(stage2.confidence)}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-1 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Missing Required:</span>
              <div className="mt-1">
                {stage2.missingRequired.length === 0 ? (
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle size={16} weight="fill" />
                    <span>None</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm text-red-600">
                    <XCircle size={16} weight="fill" />
                    <span>{stage2.missingRequired.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator className="mb-4" />

      {/* Final Result */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={20} className="text-primary" weight="fill" />
          <h4 className="font-semibold">Final Result</h4>
        </div>
        <div className="ml-7 space-y-2">
          <div className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-1 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Action:</span>
              <div className="font-mono text-sm font-semibold mt-1">
                {stage1.action}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-1 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Overall Confidence:</span>
              <div className="mt-1">
                {getConfidenceBadge(Math.min(stage1.confidence, stage2.confidence))}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-1 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Used Fallback:</span>
              <div className="text-sm font-medium mt-1">
                {usedFallback ? (
                  <span className="text-yellow-600">Yes</span>
                ) : (
                  <span className="text-green-600">No</span>
                )}
              </div>
            </div>
          </div>
          {usedFallback && fallbackReason && (
            <div className="flex items-start gap-2">
              <ArrowRight size={16} className="mt-1 text-muted-foreground" />
              <div className="flex-1">
                <span className="text-sm text-muted-foreground">Fallback Reason:</span>
                <div className="text-sm bg-yellow-100 dark:bg-yellow-950 p-2 rounded border border-yellow-300 dark:border-yellow-700 mt-1">
                  {fallbackReason}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
