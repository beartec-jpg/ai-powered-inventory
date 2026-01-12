import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Info } from '@phosphor-icons/react'

interface MissingInfoPromptProps {
  action: string
  missingFields: string[]
  partialParams: Record<string, unknown>
  prompt: string
  options?: string[]
  pendingAction?: string
  onOptionSelect?: (option: string) => void
  currentStep?: number
  totalSteps?: number
  collectedData?: Record<string, unknown>
}

export function MissingInfoPrompt({
  action,
  missingFields,
  partialParams,
  prompt,
  options,
  pendingAction,
  onOptionSelect,
  currentStep,
  totalSteps,
  collectedData
}: MissingInfoPromptProps) {
  const isMultiStep = currentStep !== undefined && totalSteps !== undefined
  
  return (
    <Card className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info size={20} className="text-blue-500" weight="fill" />
          <CardTitle className="text-lg">
            {isMultiStep ? `Collecting Information` : 'More Information Needed'}
          </CardTitle>
          {isMultiStep && (
            <Badge variant="secondary" className="ml-auto">
              Step {currentStep}/{totalSteps}
            </Badge>
          )}
        </div>
        {!isMultiStep && (
          <CardDescription>
            Action: <Badge variant="outline">{action}</Badge>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm whitespace-pre-wrap">{prompt}</div>
        
        {missingFields.length > 0 && !isMultiStep && (
          <div className="text-sm">
            <span className="font-medium">Missing: </span>
            {missingFields.map((field) => (
              <Badge key={field} variant="secondary" className="mr-1">
                {field}
              </Badge>
            ))}
          </div>
        )}
        
        {collectedData && Object.keys(collectedData).length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Collected so far: </span>
            <div className="mt-1 space-y-1">
              {Object.entries(collectedData)
                .filter(([_, value]) => value !== null && value !== undefined && value !== '')
                .map(([key, value]) => (
                  <div key={key} className="text-xs text-muted-foreground">
                    <span className="font-mono">{key}:</span> {String(value)}
                  </div>
                ))}
            </div>
          </div>
        )}
        
        {!isMultiStep && Object.keys(partialParams).length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Already have: </span>
            <div className="mt-1 space-y-1">
              {Object.entries(partialParams)
                .filter(([_, value]) => value !== null && value !== undefined && value !== '')
                .map(([key, value]) => (
                  <div key={key} className="text-xs text-muted-foreground">
                    <span className="font-mono">{key}:</span> {String(value)}
                  </div>
                ))}
            </div>
          </div>
        )}
        
        {options && options.length > 0 && (
          <div className="flex gap-2 mt-3">
            {options.map(option => (
              <Button 
                key={option} 
                variant={option.toLowerCase() === 'skip' ? 'outline' : 'default'}
                size="sm" 
                onClick={() => onOptionSelect?.(option)}
              >
                {option}
              </Button>
            ))}
            {isMultiStep && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onOptionSelect?.('cancel')}
                className="ml-auto text-muted-foreground"
              >
                Cancel
              </Button>
            )}
          </div>
        )}
        
        {(!options || options.length === 0) && !isMultiStep && (
          <div className="text-xs text-muted-foreground mt-3">
            💡 Tip: Just reply with the missing information in your next message
          </div>
        )}
        
        {isMultiStep && (!options || options.length === 0) && (
          <div className="text-xs text-muted-foreground mt-3">
            💡 Type your answer or "skip" to leave blank • Type "cancel" to stop
          </div>
        )}
      </CardContent>
    </Card>
  )
}
