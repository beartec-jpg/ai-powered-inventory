import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info } from '@phosphor-icons/react'

interface MissingInfoPromptProps {
  action: string
  missingFields: string[]
  partialParams: Record<string, unknown>
  prompt: string
}

export function MissingInfoPrompt({
  action,
  missingFields,
  partialParams,
  prompt
}: MissingInfoPromptProps) {
  return (
    <Card className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info size={20} className="text-blue-500" weight="fill" />
          <CardTitle className="text-lg">More Information Needed</CardTitle>
        </div>
        <CardDescription>
          Action: <Badge variant="outline">{action}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm whitespace-pre-wrap">{prompt}</div>
        
        {missingFields.length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Missing: </span>
            {missingFields.map((field, i) => (
              <Badge key={field} variant="secondary" className="mr-1">
                {field}
              </Badge>
            ))}
          </div>
        )}
        
        {Object.keys(partialParams).length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Already have: </span>
            <div className="mt-1 space-y-1">
              {Object.entries(partialParams).map(([key, value]) => (
                value !== null && value !== undefined && value !== '' && (
                  <div key={key} className="text-xs text-muted-foreground">
                    <span className="font-mono">{key}:</span> {String(value)}
                  </div>
                )
              ))}
            </div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground mt-3">
          💡 Tip: Just reply with the missing information in your next message
        </div>
      </CardContent>
    </Card>
  )
}
