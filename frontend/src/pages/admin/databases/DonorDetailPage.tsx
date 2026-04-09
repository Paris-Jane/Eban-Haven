import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { alertError } from '../shared/adminStyles'
import {
  createDonation,
  getAtRiskDonors,
  getDonations,
  getSupporters,
  patchSupporterFields,
  type AtRiskDonorInfo,
  type Donation,
  type Supporter,
} from '../../../api/admin'
import { DonationPanel } from './donorDetail/DonationPanel'
import { DonorAlerts } from './donorDetail/DonorAlerts'
import { DonorHeader } from './donorDetail/DonorHeader'
import { DonorMetricsRow } from './donorDetail/DonorMetricsRow'
import { EditDonorModal } from './donorDetail/EditDonorModal'

export function DonorDetailPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const addAnchorRef = useRef<HTMLDivElement | null>(null)

  const [supporter, setSupporter] = useState<Supporter | null>(null)
  const [donations, setDonations] = useState<Donation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<Supporter | null>(null)
  const [atRiskById, setAtRiskById] = useState<Map<number, AtRiskDonorInfo>>(new Map())

  const [dType, setDType] = useState('Monetary')
  const [dAmount, setDAmount] = useState('')
  const [dDate, setDDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dNotes, setDNotes] = useState('')
  const [dCampaign, setDCampaign] = useState('')
  const [savingDonation, setSavingDonation] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return
    setLoading(true)
    try {
      const sup = await getSupporters()
      const s = sup.find((x) => x.id === id) ?? null
      setSupporter(s)
      if (s) {
        const d = await getDonations(id)
        setDonations(d)
      } else setDonations([])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    getAtRiskDonors(0.55, 200)
      .then((rows) => {
        setAtRiskById(
          new Map(rows.filter((r) => r.supporter_id != null).map((r) => [r.supporter_id!, r])),
        )
      })
      .catch(() => setAtRiskById(new Map()))
  }, [])

  const atRiskForDonor = id > 0 ? atRiskById.get(id) : undefined

  const metrics = useMemo(() => {
    const totalMonetary = donations.reduce((sum, donation) => sum + (donation.amount ?? 0), 0)
    const donationCount = donations.length
    const averageGift = donationCount > 0 ? totalMonetary / donationCount : 0
    let last: Donation | null = null
    let lastTs = -Infinity
    for (const d of donations) {
      const t = new Date(d.donationDate).getTime()
      if (t >= lastTs) {
        lastTs = t
        last = d
      }
    }
    return {
      totalMonetary,
      donationCount,
      averageGift,
      last,
    }
  }, [donations])

  async function onAddContribution(e: FormEvent) {
    e.preventDefault()
    if (!Number.isFinite(id)) return
    const amt = parseFloat(dAmount)
    if (!Number.isFinite(amt) || amt <= 0) return
    setSavingDonation(true)
    setError(null)
    try {
      await createDonation({
        supporterId: id,
        donationType: dType,
        amount: amt,
        currencyCode: 'PHP',
        donationDate: `${dDate}T12:00:00`,
        notes: dNotes.trim() || undefined,
        campaignName: dCampaign.trim() || undefined,
      })
      setDAmount('')
      setDNotes('')
      setDCampaign('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSavingDonation(false)
    }
  }

  async function saveEdit() {
    if (!edit) return
    setSavingEdit(true)
    setError(null)
    try {
      const updated = await patchSupporterFields(edit.id, {
        supporter_type: edit.supporterType,
        display_name: edit.displayName,
        region: edit.region ?? '',
        country: edit.country ?? '',
        email: edit.email ?? '',
        status: edit.status,
      })
      setSupporter(updated)
      setEditOpen(false)
      setEdit(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSavingEdit(false)
    }
  }

  function openEdit() {
    if (!supporter) return
    setEdit({ ...supporter })
    setEditOpen(true)
  }

  function scrollToAddDonation() {
    addAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!Number.isFinite(id) || id <= 0) return <p className="text-destructive">Invalid donor.</p>

  return (
    <div className="space-y-6">
      <button
        type="button"
        className="text-sm text-primary hover:underline"
        onClick={() => {
          if (window.history.length > 1) navigate(-1)
          else navigate('/admin/donors')
        }}
      >
        ← Back
      </button>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !supporter ? (
        <p className="text-destructive">Supporter not found.</p>
      ) : (
        <>
          {error ? <div className={alertError}>{error}</div> : null}

          <DonorHeader
            supporter={supporter}
            detailsOpen={detailsOpen}
            onToggleDetails={() => setDetailsOpen((o) => !o)}
            onEditClick={openEdit}
            onAddDonationClick={scrollToAddDonation}
          />

          <DonorAlerts supporterId={supporter.id} atRisk={atRiskForDonor} upgradeInsight={null} />

          <DonorMetricsRow
            lifetimeTotal={metrics.totalMonetary}
            donationCount={metrics.donationCount}
            averageGift={metrics.averageGift}
            lastDonationLabel={metrics.last ? new Date(metrics.last.donationDate).toLocaleDateString() : '—'}
            lastDonationType={metrics.last?.donationType ?? ''}
          />

          <div ref={addAnchorRef}>
            <DonationPanel
              donations={donations}
              supporterId={supporter.id}
              saving={savingDonation}
              onAddDonation={onAddContribution}
              dType={dType}
              setDType={setDType}
              dAmount={dAmount}
              setDAmount={setDAmount}
              dDate={dDate}
              setDDate={setDDate}
              dNotes={dNotes}
              setDNotes={setDNotes}
              dCampaign={dCampaign}
              setDCampaign={setDCampaign}
            />
          </div>

          {editOpen && edit ? (
            <EditDonorModal
              edit={edit}
              setEdit={setEdit}
              saving={savingEdit}
              onSave={() => void saveEdit()}
              onClose={() => {
                setEditOpen(false)
                setEdit(null)
              }}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
