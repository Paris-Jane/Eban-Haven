import { useParams } from 'react-router-dom'
import { ResidentCaseWorkspace } from '../shared/residentCase/ResidentCaseWorkspace'

export function ResidentDetailPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  return <ResidentCaseWorkspace residentId={id} />
}
