import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Equipment } from '@/lib/types'
import { Gear } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface EquipmentCardProps {
  equipment: Equipment
}

function EquipmentCard({ equipment }: EquipmentCardProps) {
  const contractTypeColors: Record<string, string> = {
    none: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
    breakdown: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    maintenance: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    full_cover: 'bg-green-500/20 text-green-400 border-green-500/50',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-4 hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Gear size={20} weight="duotone" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {equipment.name}
              </h3>
              <p className="text-sm text-muted-foreground">{equipment.customerName}</p>
              <p className="text-xs text-muted-foreground">{equipment.type}</p>
            </div>
          </div>
          {equipment.contractType && equipment.contractType !== 'none' && (
            <Badge className={contractTypeColors[equipment.contractType]}>
              {equipment.contractType.replace('_', ' ')}
            </Badge>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {equipment.manufacturer && (
            <div>
              <span className="text-muted-foreground">Manufacturer:</span>{' '}
              <span className="font-medium">{equipment.manufacturer}</span>
            </div>
          )}
          {equipment.model && (
            <div>
              <span className="text-muted-foreground">Model:</span>{' '}
              <span className="font-medium">{equipment.model}</span>
            </div>
          )}
          {equipment.serialNumber && (
            <div>
              <span className="text-muted-foreground">Serial:</span>{' '}
              <span className="font-mono text-xs">{equipment.serialNumber}</span>
            </div>
          )}
          {equipment.location && (
            <div>
              <span className="text-muted-foreground">Location:</span>{' '}
              <span>{equipment.location}</span>
            </div>
          )}
        </div>

        {equipment.nextServiceDue && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Next Service Due: {new Date(equipment.nextServiceDue).toLocaleDateString()}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

interface EquipmentViewProps {
  equipment: Equipment[]
}

export function EquipmentView({ equipment }: EquipmentViewProps) {
  if (equipment.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Gear size={48} className="mx-auto mb-4 opacity-50" />
        <p>No equipment tracked yet</p>
        <p className="text-sm mt-2">
          Try: "create equipment main boiler at ABC Manufacturing"
        </p>
      </div>
    )
  }

  const sortedEquipment = [...equipment].sort((a, b) => 
    a.customerName.localeCompare(b.customerName)
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedEquipment.map((equip) => (
        <EquipmentCard key={equip.id} equipment={equip} />
      ))}
    </div>
  )
}
