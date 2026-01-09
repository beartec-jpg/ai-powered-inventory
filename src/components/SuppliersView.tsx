import { Card } from '@/components/ui/card'
import type { Supplier } from '@/lib/types'
import { User } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface SupplierCardProps {
  supplier: Supplier
}

function SupplierCard({ supplier }: SupplierCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-4 hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/10">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <User size={20} weight="duotone" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {supplier.name}
            </h3>
            {supplier.accountNumber && (
              <p className="text-xs text-muted-foreground font-mono">
                Acc: {supplier.accountNumber}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {supplier.contactName && (
            <div>
              <span className="text-muted-foreground">Contact:</span>{' '}
              <span>{supplier.contactName}</span>
            </div>
          )}
          {supplier.email && (
            <div>
              <span className="text-muted-foreground">Email:</span>{' '}
              <a 
                href={`mailto:${supplier.email}`}
                className="text-accent hover:underline"
              >
                {supplier.email}
              </a>
            </div>
          )}
          {supplier.phone && (
            <div>
              <span className="text-muted-foreground">Phone:</span>{' '}
              <a 
                href={`tel:${supplier.phone}`}
                className="text-accent hover:underline"
              >
                {supplier.phone}
              </a>
            </div>
          )}
          {supplier.website && (
            <div>
              <span className="text-muted-foreground">Website:</span>{' '}
              <a 
                href={supplier.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Visit
              </a>
            </div>
          )}
          {supplier.paymentTerms && (
            <div>
              <span className="text-muted-foreground">Terms:</span>{' '}
              <span>{supplier.paymentTerms}</span>
            </div>
          )}
        </div>

        {supplier.notes && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">{supplier.notes}</p>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

interface SuppliersViewProps {
  suppliers: Supplier[]
}

export function SuppliersView({ suppliers }: SuppliersViewProps) {
  if (suppliers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User size={48} className="mx-auto mb-4 opacity-50" />
        <p>No suppliers added yet</p>
        <p className="text-sm mt-2">
          Try: "create supplier Comtherm Limited"
        </p>
      </div>
    )
  }

  const sortedSuppliers = [...suppliers].sort((a, b) => 
    a.name.localeCompare(b.name)
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedSuppliers.map((supplier) => (
        <SupplierCard key={supplier.id} supplier={supplier} />
      ))}
    </div>
  )
}
