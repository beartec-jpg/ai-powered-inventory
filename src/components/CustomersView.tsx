import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Customer } from '@/lib/types'
import { User, Buildings, House, Factory, PencilSimple, X, Check, Envelope, Phone, MapPin } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigation } from '@/contexts/NavigationContext'

interface CustomerCardProps {
  customer: Customer
  isExpanded?: boolean
  onExpand?: () => void
  onCollapse?: () => void
  onUpdate?: (id: string, updates: Partial<Customer>) => void
}

function CustomerCard({ customer, isExpanded = false, onExpand, onCollapse, onUpdate }: CustomerCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)

  // Edit state
  const [editedName, setEditedName] = useState(customer.name)
  const [editedAccountNumber, setEditedAccountNumber] = useState(customer.accountNumber || '')
  const [editedContactName, setEditedContactName] = useState(customer.contactName || '')
  const [editedEmail, setEditedEmail] = useState(customer.email || '')
  const [editedPhone, setEditedPhone] = useState(customer.phone || '')
  const [editedMobile, setEditedMobile] = useState(customer.mobile || '')
  const [editedBillingAddress, setEditedBillingAddress] = useState(customer.billingAddress || '')
  const [editedPaymentTerms, setEditedPaymentTerms] = useState(customer.paymentTerms || '')
  const [editedNotes, setEditedNotes] = useState(customer.notes || '')

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(customer.id, {
        name: editedName,
        accountNumber: editedAccountNumber || undefined,
        contactName: editedContactName || undefined,
        email: editedEmail || undefined,
        phone: editedPhone || undefined,
        mobile: editedMobile || undefined,
        billingAddress: editedBillingAddress || undefined,
        paymentTerms: editedPaymentTerms || undefined,
        notes: editedNotes || undefined,
      })
    }
    setIsEditing(false)
    setShowMobileModal(false)
  }

  const handleCancel = () => {
    setEditedName(customer.name)
    setEditedAccountNumber(customer.accountNumber || '')
    setEditedContactName(customer.contactName || '')
    setEditedEmail(customer.email || '')
    setEditedPhone(customer.phone || '')
    setEditedMobile(customer.mobile || '')
    setEditedBillingAddress(customer.billingAddress || '')
    setEditedPaymentTerms(customer.paymentTerms || '')
    setEditedNotes(customer.notes || '')
    setIsEditing(false)
  }

  const handleCardClick = () => {
    if (!isExpanded && !isEditing && onExpand) {
      onExpand()
    }
  }
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

  // Condensed view
  const condensedView = (
    <Card 
      className={`p-4 transition-all ${
        isExpanded 
          ? 'border-accent shadow-xl shadow-accent/20' 
          : 'hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 cursor-pointer'
      }`}
      onClick={handleCardClick}
    >
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
              onClick={(e) => e.stopPropagation()}
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
              onClick={(e) => e.stopPropagation()}
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
              onClick={(e) => e.stopPropagation()}
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
  )

  // Expanded view
  const expandedView = (
    <Card 
      className="p-6 border-accent shadow-2xl shadow-accent/20 bg-card"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            {getTypeIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg">
              {customer.name}
            </h3>
            <Badge variant="secondary" className="mt-1">{getTypeBadge()}</Badge>
            {customer.accountNumber && (
              <p className="text-sm text-muted-foreground font-mono mt-1">
                Account: {customer.accountNumber}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing && onUpdate && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="gap-2"
            >
              <PencilSimple size={16} />
              Edit
            </Button>
          )}
          {onCollapse && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onCollapse}
            >
              <X size={20} />
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input value={editedAccountNumber} onChange={(e) => setEditedAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={editedContactName} onChange={(e) => setEditedContactName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editedPhone} onChange={(e) => setEditedPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input value={editedMobile} onChange={(e) => setEditedMobile(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Billing Address</Label>
              <Input value={editedBillingAddress} onChange={(e) => setEditedBillingAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Input value={editedPaymentTerms} onChange={(e) => setEditedPaymentTerms(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Input value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="gap-2">
              <Check size={16} />
              Save
            </Button>
            <Button onClick={handleCancel} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {customer.contactName && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Contact Person</div>
              <div className="flex items-center gap-2">
                <User size={18} className="text-accent" />
                <span>{customer.contactName}</span>
              </div>
            </div>
          )}
          {customer.email && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Email</div>
              <a 
                href={`mailto:${customer.email}`}
                className="flex items-center gap-2 text-accent hover:underline"
              >
                <Envelope size={18} />
                <span>{customer.email}</span>
              </a>
            </div>
          )}
          {customer.phone && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Phone</div>
              <a 
                href={`tel:${customer.phone}`}
                className="flex items-center gap-2 text-accent hover:underline"
              >
                <Phone size={18} />
                <span>{customer.phone}</span>
              </a>
            </div>
          )}
          {customer.mobile && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Mobile</div>
              <a 
                href={`tel:${customer.mobile}`}
                className="flex items-center gap-2 text-accent hover:underline"
              >
                <Phone size={18} />
                <span>{customer.mobile}</span>
              </a>
            </div>
          )}
          {customer.billingAddress && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Billing Address</div>
              <div className="flex items-start gap-2">
                <MapPin size={18} className="text-accent mt-0.5" />
                <span>{customer.billingAddress}</span>
              </div>
            </div>
          )}
          {customer.paymentTerms && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Payment Terms</div>
              <span>{customer.paymentTerms}</span>
            </div>
          )}
          {customer.siteAddresses && customer.siteAddresses.length > 0 && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-2">Site Locations</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {customer.siteAddresses.map((site) => (
                  <div key={site.id} className="flex items-start gap-2 text-sm border border-border rounded p-2">
                    <MapPin size={14} className="text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">{site.name}</div>
                      <div className="text-xs text-muted-foreground">{site.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {customer.notes && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-2">Notes</div>
              <div className="text-sm border-l-2 border-accent pl-3">
                {customer.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )

  // Mobile modal
  const mobileModal = (
    <Dialog open={showMobileModal} onOpenChange={setShowMobileModal}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getTypeIcon()}
            <div>
              <div>{customer.name}</div>
              {customer.accountNumber && (
                <div className="text-sm font-normal text-muted-foreground">
                  Acc: {customer.accountNumber}
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {isEditing ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input value={editedAccountNumber} onChange={(e) => setEditedAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={editedContactName} onChange={(e) => setEditedContactName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editedPhone} onChange={(e) => setEditedPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input value={editedMobile} onChange={(e) => setEditedMobile(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Billing Address</Label>
              <Input value={editedBillingAddress} onChange={(e) => setEditedBillingAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Input value={editedPaymentTerms} onChange={(e) => setEditedPaymentTerms(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Badge variant="secondary">{getTypeBadge()}</Badge>
            {customer.contactName && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Contact Person</div>
                <div>{customer.contactName}</div>
              </div>
            )}
            {customer.email && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Email</div>
                <a href={`mailto:${customer.email}`} className="text-accent hover:underline">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Phone</div>
                <a href={`tel:${customer.phone}`} className="text-accent hover:underline">
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.mobile && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Mobile</div>
                <a href={`tel:${customer.mobile}`} className="text-accent hover:underline">
                  {customer.mobile}
                </a>
              </div>
            )}
            {customer.billingAddress && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Billing Address</div>
                <div>{customer.billingAddress}</div>
              </div>
            )}
            {customer.paymentTerms && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Payment Terms</div>
                <div>{customer.paymentTerms}</div>
              </div>
            )}
            {customer.siteAddresses && customer.siteAddresses.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">Site Locations ({customer.siteAddresses.length})</div>
                <div className="space-y-2">
                  {customer.siteAddresses.map((site) => (
                    <div key={site.id} className="text-sm border border-border rounded p-2">
                      <div className="font-semibold">{site.name}</div>
                      <div className="text-xs text-muted-foreground">{site.address}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {customer.notes && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Notes</div>
                <div className="text-sm">{customer.notes}</div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {isEditing ? (
            <>
              <Button onClick={handleSave} className="gap-2">
                <Check size={16} />
                Save
              </Button>
              <Button onClick={handleCancel} variant="outline">
                Cancel
              </Button>
            </>
          ) : (
            <>
              {onUpdate && (
                <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2">
                  <PencilSimple size={16} />
                  Edit
                </Button>
              )}
              <Button onClick={() => setShowMobileModal(false)} variant="ghost">
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <>
      {/* Desktop: inline expansion */}
      <motion.div
        className="hidden md:block"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        layout
      >
        {isExpanded ? expandedView : condensedView}
      </motion.div>

      {/* Mobile: condensed card that opens modal */}
      <motion.div
        className="md:hidden"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={() => !isExpanded && setShowMobileModal(true)}
      >
        {condensedView}
      </motion.div>

      {/* Mobile modal */}
      {mobileModal}
    </>
  )
}

interface CustomersViewProps {
  customers: Customer[]
  onUpdate?: (id: string, updates: Partial<Customer>) => void
}

export function CustomersView({ customers, onUpdate }: CustomersViewProps) {
  const { expandedEntityId, expandedEntityType } = useNavigation()
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null)

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

  const sortedCustomers = [...customers].sort((a, b) => {
    // If one customer is expanded, it should be first
    const expandedId = expandedEntityType === 'customer' ? expandedEntityId : localExpandedId
    if (a.id === expandedId) return -1
    if (b.id === expandedId) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {sortedCustomers.map((customer) => {
          const expandedId = expandedEntityType === 'customer' ? expandedEntityId : localExpandedId
          const isExpanded = customer.id === expandedId
          return (
            <motion.div
              key={customer.id}
              layout
              className={isExpanded ? 'md:col-span-2 lg:col-span-3' : ''}
            >
              <CustomerCard 
                customer={customer} 
                isExpanded={isExpanded}
                onExpand={() => setLocalExpandedId(customer.id)}
                onCollapse={() => setLocalExpandedId(null)}
                onUpdate={onUpdate}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
