import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  createInterventionPlan,
  deleteInterventionPlan,
  patchInterventionPlan,
  type InterventionPlan,
} from '../../../../api/admin'
import { alertError, btnPrimary, input, label } from '../adminStyles'
import { AdminDeleteModal } from '../adminDataTable/AdminDeleteModal'
import { CategoryBadge, StatusBadge } from '../adminDataTable/AdminBadges'
import { formatAdminDate, inDateRange } from '../adminDataTable/adminFormatters'
import { PLAN_CATEGORIES, PLAN_STATUSES } from './caseConstants'
import { CaseDrawer, EmptyState, QuickActionButton, RecordCardRow, SearchField, SectionHeader } from './caseUi'

function planIsOverdue(p: InterventionPlan): boolean {
  if (!p.targetDate) return false
  const st = p.status.toLowerCase()
  if (st.includes('achieved') || st.includes('closed') || st.includes('completed')) return false
  const t = new Date(p.targetDate).setHours(0, 0, 0, 0)
  return t < new Date().setHours(0, 0, 0, 0)
}

export function PlansTabContent({
  residentId,
  plans,
  onReload,
  openCreateSignal,
  layout = 'list',
  focusPlanId,
  onFocusPlanConsumed,
  categoryFilter,
  titleOverride,
  descriptionOverride,
  addLabel = 'Add plan',
  summaryContent,
}: {
  residentId: number
  plans: InterventionPlan[]
  onReload: () => void
  openCreateSignal: number
  /** `workspace`: header, optional summaryContent, drawers only (no plan list UI). */
  layout?: 'list' | 'workspace'
  /** When set, opens the plan drawer for this id (e.g. from timeline). */
  focusPlanId?: number | null
  onFocusPlanConsumed?: () => void
  categoryFilter?: string
  titleOverride?: string
  descriptionOverride?: string
  addLabel?: string
  summaryContent?: ReactNode
}) {
  const [q, setQ] = useState('')
  const [df, setDf] = useState('')
  const [dt, setDt] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [sel, setSel] = useState<InterventionPlan | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (openCreateSignal > 0) {
      setCreateOpen(true)
      setSel(null)
      setEditing(false)
    }
  }, [openCreateSignal])

  useEffect(() => {
    if (focusPlanId == null) return
    const p = plans.find((x) => x.id === focusPlanId)
    if (p) {
      setSel(p)
      setEditing(false)
      setCreateOpen(false)
    }
    onFocusPlanConsumed?.()
  }, [focusPlanId, plans, onFocusPlanConsumed])

  const filtered = useMemo(() => {
    let list = [...plans].sort((a, b) => {
      const ta = a.targetDate ? new Date(a.targetDate).getTime() : 0
      const tb = b.targetDate ? new Date(b.targetDate).getTime() : 0
      return tb - ta
    })
    if (categoryFilter?.trim()) {
      const category = categoryFilter.trim().toLowerCase()
      list = list.filter((p) => p.planCategory.trim().toLowerCase() === category)
    }
    if (df || dt) list = list.filter((p) => p.targetDate && inDateRange(p.targetDate, df, dt))
    if (overdueOnly) list = list.filter(planIsOverdue)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.planCategory.toLowerCase().includes(s) ||
          p.planDescription.toLowerCase().includes(s) ||
          (p.servicesProvided ?? '').toLowerCase().includes(s) ||
          p.status.toLowerCase().includes(s),
      )
    }
    return list
  }, [plans, q, df, dt, overdueOnly, categoryFilter])

  const closeDrawer = () => {
    setSel(null)
    setCreateOpen(false)
    setEditing(false)
    setErr(null)
  }

  return (
    <div className="space-y-6">
      {err && <div className={alertError}>{err}</div>}
      <SectionHeader
        title={titleOverride ?? (layout === 'workspace' ? 'Goals' : 'Intervention plans')}
        description={
          descriptionOverride ??
          (layout === 'workspace'
            ? 'Review user goals and current progress.'
            : 'Review user goals and current progress.')
        }
        actions={<QuickActionButton onClick={() => setCreateOpen(true)}>{addLabel}</QuickActionButton>}
      />
      {summaryContent ? <div>{summaryContent}</div> : null}
      {layout === 'list' ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <SearchField value={q} onChange={setQ} placeholder="Category, description, status…" />
            </div>
            <label className={label}>
              Target from
              <input type="date" className={input} value={df} onChange={(e) => setDf(e.target.value)} />
            </label>
            <label className={label}>
              Target to
              <input type="date" className={input} value={dt} onChange={(e) => setDt(e.target.value)} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
              Overdue only
            </label>
          </div>
          <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState title="No intervention plans" action={<QuickActionButton onClick={() => setCreateOpen(true)}>Add plan</QuickActionButton>} />
          ) : (
            filtered.map((p) => (
              <RecordCardRow key={p.id} highlight={planIsOverdue(p)} onClick={() => { setSel(p); setEditing(false); setCreateOpen(false) }}>
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge>{p.planCategory}</CategoryBadge>
                  <StatusBadge status={p.status} />
                  {planIsOverdue(p) ? (
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-200">Overdue</span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.planDescription}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {p.targetDate ? <span>Target {formatAdminDate(p.targetDate)}</span> : null}
                  {p.caseConferenceDate ? <span>Conference {formatAdminDate(p.caseConferenceDate)}</span> : null}
                  {p.servicesProvided ? <span className="truncate">{p.servicesProvided}</span> : null}
                </div>
              </RecordCardRow>
            ))
          )}
          </div>
        </>
      ) : null}

      {(sel || createOpen) && (
        <PlanDrawer
          key={createOpen ? 'new' : String(sel?.id)}
          mode={createOpen ? 'create' : editing ? 'edit' : 'view'}
          residentId={residentId}
          initial={sel}
          error={err}
          onError={setErr}
          onClose={closeDrawer}
          onEdit={() => setEditing(true)}
          onSaved={async () => {
            closeDrawer()
            await onReload()
          }}
          onDeleteRequest={(id) => setDeleteId(id)}
        />
      )}

      <AdminDeleteModal
        open={deleteId != null}
        title="Delete intervention plan?"
        body="This plan will be permanently removed."
        loading={saving}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId == null) return
          setSaving(true)
          try {
            await deleteInterventionPlan(deleteId)
            setDeleteId(null)
            closeDrawer()
            await onReload()
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Delete failed')
          } finally {
            setSaving(false)
          }
        }}
      />
    </div>
  )
}

function PlanDrawer({
  mode,
  residentId,
  initial,
  error,
  onError,
  onClose,
  onEdit,
  onSaved,
  onDeleteRequest,
}: {
  mode: 'view' | 'edit' | 'create'
  residentId: number
  initial: InterventionPlan | null
  error: string | null
  onError: (e: string | null) => void
  onClose: () => void
  onEdit: () => void
  onSaved: () => Promise<void>
  onDeleteRequest: (id: number) => void
}) {
  const [savingLocal, setSavingLocal] = useState(false)
  const [category, setCategory] = useState(initial?.planCategory ?? 'Education')
  const [description, setDescription] = useState(initial?.planDescription ?? '')
  const [services, setServices] = useState(initial?.servicesProvided ?? '')
  const [targetVal, setTargetVal] = useState(initial?.targetValue != null ? String(initial.targetValue) : '')
  const [targetDate, setTargetDate] = useState(
    initial?.targetDate ? new Date(initial.targetDate).toISOString().slice(0, 10) : '',
  )
  const [status, setStatus] = useState(initial?.status ?? 'In Progress')
  const [confDate, setConfDate] = useState(
    initial?.caseConferenceDate ? new Date(initial.caseConferenceDate).toISOString().slice(0, 10) : '',
  )

  const readOnly = mode === 'view'

  async function submit(e: FormEvent) {
    e.preventDefault()
    onError(null)
    if (!description.trim()) {
      onError('Plan description is required.')
      return
    }
    const tv = targetVal.trim() ? parseFloat(targetVal) : undefined
    if (targetVal.trim() && !Number.isFinite(tv)) {
      onError('Target value must be a number.')
      return
    }
    setSavingLocal(true)
    try {
      if (mode === 'create') {
        await createInterventionPlan({
          residentId,
          planCategory: category,
          planDescription: description.trim(),
          status,
          targetDate: targetDate.trim() || null,
          targetValue: tv ?? null,
          caseConferenceDate: confDate.trim() || null,
          servicesProvided: services.trim() || null,
        })
      } else if (initial && mode === 'edit') {
        await patchInterventionPlan(initial.id, {
          planCategory: category,
          planDescription: description.trim(),
          servicesProvided: services.trim() || undefined,
          targetValue: tv,
          targetDate: targetDate.trim() || '',
          status,
          caseConferenceDate: confDate.trim() || '',
        })
      }
      await onSaved()
    } catch (x) {
      onError(x instanceof Error ? x.message : 'Save failed')
    } finally {
      setSavingLocal(false)
    }
  }

  return (
    <CaseDrawer
      title={mode === 'create' ? 'New intervention plan' : 'Intervention plan'}
      onClose={onClose}
      footer={
        readOnly && initial ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              onClick={() => initial && onDeleteRequest(initial.id)}
            >
              Delete…
            </button>
          </div>
        ) : null
      }
    >
      {error && <div className={alertError}>{error}</div>}
      {readOnly && initial ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <CategoryBadge>{initial.planCategory}</CategoryBadge>
            <StatusBadge status={initial.status} />
          </div>
          <p className="whitespace-pre-wrap text-foreground">{initial.planDescription}</p>
          {initial.servicesProvided ? <p className="text-muted-foreground">{initial.servicesProvided}</p> : null}
          {initial.targetValue != null ? <p>Target value: {initial.targetValue}</p> : null}
          {initial.targetDate ? <p>Target date: {formatAdminDate(initial.targetDate)}</p> : null}
          {initial.caseConferenceDate ? <p>Conference: {formatAdminDate(initial.caseConferenceDate)}</p> : null}
          <p className="text-xs text-muted-foreground">
            Updated {formatAdminDate(initial.updatedAt)} · Created {formatAdminDate(initial.createdAt)}
          </p>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <label className={label}>
            Plan category
            <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
              {PLAN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Plan description
            <textarea className={input} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
          </label>
          <label className={label}>
            Services provided
            <input className={input} value={services} onChange={(e) => setServices(e.target.value)} />
          </label>
          <label className={label}>
            Target value (numeric)
            <input className={input} inputMode="decimal" value={targetVal} onChange={(e) => setTargetVal(e.target.value)} />
          </label>
          <label className={label}>
            Target date
            <input type="date" className={input} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </label>
          <label className={label}>
            Status
            <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
              {PLAN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Case conference date
            <input type="date" className={input} value={confDate} onChange={(e) => setConfDate(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button type="submit" disabled={savingLocal} className={btnPrimary}>
              {savingLocal ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
            </button>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </CaseDrawer>
  )
}
