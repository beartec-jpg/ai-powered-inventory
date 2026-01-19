import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Customer } from '@/lib/types'
import { User, Buildings, House, Factory } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface CustomerCardProps {
  customer: Customer
}

function CustomerCard({ customer }: CustomerCardProps) {
  const getTypeIcon = () => {
    switch (customer.type) {
      case 'commercial':
        return <Buildings size={20} weight="duotone" />
      case 'residential':
        return <House size={20} weight="duotone" />
      case 'industrial':
        return <Factory size={20} weight="duotone" />
      default:
        return <User size={20} weight="duotone" />
    }
  }

  const getTypeBadge = () => {
    const typeLabels = {
      commercial: 'Commercial',
      residential: 'Residential',
      industrial: 'Industrial'
    }
    return typeLabels[customer.type] || customer.type
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
              {getTypeIcon()}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {customer.name}
              </h3>
              {customer.accountNumber && (
                <p className="text-xs text-muted-foreground font-mono">
                  Acc: {customer.accountNumber}
                </p>
              )}
            </div>
          </div>
          <Badge variant="secondary">
            {getTypeBadge()}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          {customer.contactName && (
            <div>
              <span className="text-muted-foreground">Contact:</span>{' '}
              <span>{customer.contactName}</span>
            </div>
          )}
          {customer.email && (
            <div>
              <span className="text-muted-foreground">Email:</span>{' '}
              <a 
                href={`mailto:${customer.email}`}
                className="text-accent hover:underline"
              >
                {customer.email}
              </a>
            </div>
          )}
          {customer.phone && (
            <div>
              <span className="text-muted-foreground">Phone:</span>{' '}
              <a 
                href={`tel:${customer.phone}`}
                className="text-accent hover:underline"
              >
                {customer.phone}
              </a>
            </div>
          )}
          {customer.mobile && (
            <div>
              <span className="text-muted-foreground">Mobile:</span>{' '}
              <a 
                href={`tel:${customer.mobile}`}
                className="text-accent hover:underline"
              >
                {customer.mobile}
              </a>
            </div>
          )}
          {customer.siteAddresses && customer.siteAddresses.length > 0 && (
            <div>
              <span className="text-muted-foreground">Sites:</span>{' '}
              <span>{customer.siteAddresses.length} location{customer.siteAddresses.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {customer.notes && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">{customer.notes}</p>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

interface CustomersViewProps {
  customers: Customer[]
}

export function CustomersView({ customers }: CustomersViewProps) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User size={48} className="mx-auto mb-4 opacity-50" />
        <p>No customers added yet</p>
        <p className="text-sm mt-2">
          Try: "create customer Acme Corporation"
        </p>
      </div>
    )
  }

  const sortedCustomers = [...customers].sort((a, b) => 
    a.name.localeCompare(b.name)
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedCustomers.map((customer) => (
        <CustomerCard key={customer.id} customer={customer} />
      ))}
    </div>
  )
}
