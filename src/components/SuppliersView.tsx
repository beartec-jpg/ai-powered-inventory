import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Supplier } from '@/lib/types'
import { User, PencilSimple, X, Check, Envelope, Phone, Globe, MapPin, CreditCard } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigation } from '@/contexts/NavigationContext'

interface SupplierCardProps {
  supplier: Supplier
  isExpanded?: boolean
  onExpand?: () => void
  onCollapse?: () => void
  onUpdate?: (id: string, updates: Partial<Supplier>) => void
}

function SupplierCard({ supplier, isExpanded = false, onExpand, onCollapse, onUpdate }: SupplierCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)

  // Edit state
  const [editedName, setEditedName] = useState(supplier.name)
  const [editedAccountNumber, setEditedAccountNumber] = useState(supplier.accountNumber || '')
  const [editedContactName, setEditedContactName] = useState(supplier.contactName || '')
  const [editedEmail, setEditedEmail] = useState(supplier.email || '')
  const [editedPhone, setEditedPhone] = useState(supplier.phone || '')
  const [editedWebsite, setEditedWebsite] = useState(supplier.website || '')
  const [editedAddress, setEditedAddress] = useState(supplier.address || '')
  const [editedPaymentTerms, setEditedPaymentTerms] = useState(supplier.paymentTerms || '')
  const [editedNotes, setEditedNotes] = useState(supplier.notes || '')

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(supplier.id, {
        name: editedName,
        accountNumber: editedAccountNumber || undefined,
        contactName: editedContactName || undefined,
        email: editedEmail || undefined,
        phone: editedPhone || undefined,
        website: editedWebsite || undefined,
        address: editedAddress || undefined,
        paymentTerms: editedPaymentTerms || undefined,
        notes: editedNotes || undefined,
      })
    }
    setIsEditing(false)
    setShowMobileModal(false)
  }

  const handleCancel = () => {
    setEditedName(supplier.name)
    setEditedAccountNumber(supplier.accountNumber || '')
    setEditedContactName(supplier.contactName || '')
    setEditedEmail(supplier.email || '')
    setEditedPhone(supplier.phone || '')
    setEditedWebsite(supplier.website || '')
    setEditedAddress(supplier.address || '')
    setEditedPaymentTerms(supplier.paymentTerms || '')
    setEditedNotes(supplier.notes || '')
    setIsEditing(false)
  }

  const handleCardClick = () => {
    if (!isExpanded && !isEditing && onExpand) {
      onExpand()
    }
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
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <User size={20} weight="duotone" />
        </div>
        <div className="flex-1">
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
              onClick={(e) => e.stopPropagation()}
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
              onClick={(e) => e.stopPropagation()}
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
              onClick={(e) => e.stopPropagation()}
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
            <User size={28} weight="duotone" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg">
              {supplier.name}
            </h3>
            {supplier.accountNumber && (
              <p className="text-sm text-muted-foreground font-mono">
                Account: {supplier.accountNumber}
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
              <Label>Website</Label>
              <Input value={editedWebsite} onChange={(e) => setEditedWebsite(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input value={editedAddress} onChange={(e) => setEditedAddress(e.target.value)} />
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
          {supplier.contactName && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Contact Person</div>
              <div className="flex items-center gap-2">
                <User size={18} className="text-accent" />
                <span>{supplier.contactName}</span>
              </div>
            </div>
          )}
          {supplier.email && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Email</div>
              <a 
                href={`mailto:${supplier.email}`}
                className="flex items-center gap-2 text-accent hover:underline"
              >
                <Envelope size={18} />
                <span>{supplier.email}</span>
              </a>
            </div>
          )}
          {supplier.phone && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Phone</div>
              <a 
                href={`tel:${supplier.phone}`}
                className="flex items-center gap-2 text-accent hover:underline"
              >
                <Phone size={18} />
                <span>{supplier.phone}</span>
              </a>
            </div>
          )}
          {supplier.website && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Website</div>
              <a 
                href={supplier.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-accent hover:underline"
              >
                <Globe size={18} />
                <span className="truncate">{supplier.website}</span>
              </a>
            </div>
          )}
          {supplier.address && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Address</div>
              <div className="flex items-start gap-2">
                <MapPin size={18} className="text-accent mt-0.5" />
                <span>{supplier.address}</span>
              </div>
            </div>
          )}
          {supplier.paymentTerms && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Payment Terms</div>
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-accent" />
                <span>{supplier.paymentTerms}</span>
              </div>
            </div>
          )}
          {supplier.notes && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-2">Notes</div>
              <div className="text-sm border-l-2 border-accent pl-3">
                {supplier.notes}
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
            <User size={24} weight="duotone" className="text-primary" />
            <div>
              <div>{supplier.name}</div>
              {supplier.accountNumber && (
                <div className="text-sm font-normal text-muted-foreground">
                  Acc: {supplier.accountNumber}
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
              <Label>Website</Label>
              <Input value={editedWebsite} onChange={(e) => setEditedWebsite(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={editedAddress} onChange={(e) => setEditedAddress(e.target.value)} />
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
            {supplier.contactName && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Contact Person</div>
                <div>{supplier.contactName}</div>
              </div>
            )}
            {supplier.email && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Email</div>
                <a href={`mailto:${supplier.email}`} className="text-accent hover:underline">
                  {supplier.email}
                </a>
              </div>
            )}
            {supplier.phone && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Phone</div>
                <a href={`tel:${supplier.phone}`} className="text-accent hover:underline">
                  {supplier.phone}
                </a>
              </div>
            )}
            {supplier.website && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Website</div>
                <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  {supplier.website}
                </a>
              </div>
            )}
            {supplier.address && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Address</div>
                <div>{supplier.address}</div>
              </div>
            )}
            {supplier.paymentTerms && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Payment Terms</div>
                <div>{supplier.paymentTerms}</div>
              </div>
            )}
            {supplier.notes && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Notes</div>
                <div className="text-sm">{supplier.notes}</div>
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

interface SuppliersViewProps {
  suppliers: Supplier[]
  onUpdate?: (id: string, updates: Partial<Supplier>) => void
}

export function SuppliersView({ suppliers, onUpdate }: SuppliersViewProps) {
  const { expandedEntityId, expandedEntityType } = useNavigation()
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null)
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

  const sortedSuppliers = [...suppliers].sort((a, b) => {
    // If one supplier is expanded, it should be first
    const expandedId = expandedEntityType === 'supplier' ? expandedEntityId : localExpandedId
    if (a.id === expandedId) return -1
    if (b.id === expandedId) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {sortedSuppliers.map((supplier) => {
          const expandedId = expandedEntityType === 'supplier' ? expandedEntityId : localExpandedId
          const isExpanded = supplier.id === expandedId
          return (
            <motion.div
              key={supplier.id}
              layout
              className={isExpanded ? 'md:col-span-2 lg:col-span-3' : ''}
            >
              <SupplierCard 
                supplier={supplier} 
                isExpanded={isExpanded}
                onExpand={() => setLocalExpandedId(supplier.id)}
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
