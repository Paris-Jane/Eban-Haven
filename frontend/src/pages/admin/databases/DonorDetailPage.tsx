import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { alertError } from '../shared/adminStyles'
import {
  createDonation,
  getDonations,
  getDonorChurnRisk,
  getSupporters,
  getUpgradeCandidates,
  patchSupporterFields,
  type AtRiskDonorInfo,
  type Donation,
  type DonorUpgradeInfo,
  type Supporter,
} from '../../../api/admin'
import { DonationPanel } from './donorDetail/DonationPanel'
import { DonorProfileCard } from './donorDetail/DonorProfileCard'
import { DonorMetricsRow } from './donorDetail/DonorMetricsRow'
import { DonorStatusCard } from './donorDetail/DonorStatusCard'
import { EditDonorModal } from './donorDetail/EditDonorModal'

export function DonorDetailPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const id = Number(idParam)

  const [supporter, setSupporter] = useState<Supporter | null>(null)
  const [donations, setDonations] = useState<Donation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<Supporter | null>(null)
  const [churn, setChurn] = useState<AtRiskDonorInfo | null>(null)
  const [churnError, setChurnError] = useState<string | null>(null)
  const [churnLoading, setChurnLoading] = useState(false)
  const [upgradeInfo, setUpgradeInfo] = useState<DonorUpgradeInfo | null>(null)

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

  const supporterId = supporter?.id
  useEffect(() => {
    if (supporterId == null) {
      setChurn(null)
      setChurnError(null)
      setUpgradeInfo(null)
      setChurnLoading(false)
      return
    }
    let cancelled = false
    setChurn(null)
    setChurnError(null)
    setUpgradeInfo(null)
    setChurnLoading(true)
    void (async () => {
      const churnRes = await getDonorChurnRisk(supporterId)
      let upgrade: DonorUpgradeInfo | null = null
      try {
        const upgrades = await getUpgradeCandidates(0.4, 400)
        upgrade = upgrades.find((u) => u.supporter_id === supporterId) ?? null
      } catch {
        /* upgrade batch is optional */
      }
      if (!cancelled) {
        setChurn(churnRes.prediction)
        setChurnError(churnRes.errorMessage)
        setUpgradeInfo(upgrade)
        setChurnLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supporterId])

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

  async function onAddContribution(): Promise<boolean> {
    if (!Number.isFinite(id)) return false
    const amt = parseFloat(dAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than zero.')
      return false
    }
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
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      return false
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
        organization_name: edit.organizationName ?? '',
        first_name: edit.firstName ?? '',
        last_name: edit.lastName ?? '',
        phone: edit.phone ?? '',
        acquisition_channel: edit.acquisitionChannel ?? '',
        relationship_type: edit.relationshipType ?? '',
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:items-stretch">
            <div className="flex min-h-0 min-w-0 flex-col lg:h-full">
              <DonorProfileCard
                supporter={supporter}
                detailsOpen={detailsOpen}
                onToggleDetails={() => setDetailsOpen((o) => !o)}
                onEditClick={openEdit}
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col lg:h-full">
              <DonorStatusCard
                supporter={supporter}
                donationCount={metrics.donationCount}
                churn={churn}
                churnLoading={churnLoading}
                churnError={churnError}
                upgrade={upgradeInfo}
              />
            </div>
          </div>

          <DonorMetricsRow
            lifetimeTotal={metrics.totalMonetary}
            donationCount={metrics.donationCount}
            averageGift={metrics.averageGift}
            lastDonationLabel={metrics.last ? new Date(metrics.last.donationDate).toLocaleDateString() : '—'}
            lastDonationType={metrics.last?.donationType ?? ''}
          />

          <DonationPanel
            donations={donations}
            supporterId={supporter.id}
            saving={savingDonation}
            onAddDonation={onAddContribution}
            onDonationsUpdated={() => void load()}
            onError={setError}
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
