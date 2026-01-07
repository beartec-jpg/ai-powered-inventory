import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Job } from '@/lib/types'
import { FileText } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface JobCardProps {
  job: Job
}

export function JobCard({ job }: JobCardProps) {
  const statusColors = {
    active: 'bg-accent/20 text-accent border-accent/50',
    completed: 'bg-green-500/20 text-green-400 border-green-500/50',
    cancelled: 'bg-destructive/20 text-destructive border-destructive/50'
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
              <FileText size={20} weight="duotone" />
            </div>
            <div>
              <h3 className="font-mono font-semibold text-foreground">
                Job #{job.jobNumber}
              </h3>
              <p className="text-sm text-muted-foreground">{job.customerName}</p>
            </div>
          </div>
          <Badge className={statusColors[job.status]}>
            {job.status}
          </Badge>
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
            Parts List ({job.partsList.length} items)
          </div>
          <div className="space-y-1">
            {job.partsList.slice(0, 3).map((part, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="font-mono">{part.partNumber}</span>
                <span className="text-muted-foreground">×{part.quantity}</span>
              </div>
            ))}
            {job.partsList.length > 3 && (
              <div className="text-xs text-muted-foreground italic">
                +{job.partsList.length - 3} more items
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            Created {new Date(job.createdAt).toLocaleDateString()}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

interface JobsViewProps {
  jobs: Job[]
}

export function JobsView({ jobs }: JobsViewProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText size={48} className="mx-auto mb-4 opacity-50" />
        <p>No jobs created yet</p>
        <p className="text-sm mt-2">Try: "create parts list for job 1234 with 10x bolt-m8, 5x washer for customer Acme Corp"</p>
      </div>
    )
  }

  const sortedJobs = [...jobs].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedJobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}
