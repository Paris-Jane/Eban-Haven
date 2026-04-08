export type * from './adminTypes'

import { useSupabaseForLighthouseData } from '../lib/useSupabaseLighthouse'
import * as rest from './adminRest'
import * as sb from './lighthouseSupabase'

export async function getDashboard() {
  return useSupabaseForLighthouseData() ? sb.getDashboard() : rest.getDashboard()
}

export async function getSafehouses() {
  return useSupabaseForLighthouseData() ? sb.getSafehouses() : rest.getSafehouses()
}

export async function getSupporters() {
  return useSupabaseForLighthouseData() ? sb.getSupporters() : rest.getSupporters()
}

export async function createSupporter(body: Parameters<typeof rest.createSupporter>[0]) {
  return useSupabaseForLighthouseData() ? sb.createSupporter(body) : rest.createSupporter(body)
}

export async function patchSupporter(id: number, body: Parameters<typeof rest.patchSupporter>[1]) {
  return useSupabaseForLighthouseData() ? sb.patchSupporter(id, body) : rest.patchSupporter(id, body)
}

export async function getDonations(supporterId?: number) {
  return useSupabaseForLighthouseData() ? sb.getDonations(supporterId) : rest.getDonations(supporterId)
}

export async function createDonation(body: Parameters<typeof rest.createDonation>[0]) {
  return useSupabaseForLighthouseData() ? sb.createDonation(body) : rest.createDonation(body)
}

export async function getAllocations(params?: Parameters<typeof rest.getAllocations>[0]) {
  return useSupabaseForLighthouseData() ? sb.getAllocations(params) : rest.getAllocations(params)
}

export async function getResidents(params: Parameters<typeof rest.getResidents>[0]) {
  return useSupabaseForLighthouseData() ? sb.getResidents(params) : rest.getResidents(params)
}

export async function getResident(id: number) {
  return useSupabaseForLighthouseData() ? sb.getResident(id) : rest.getResident(id)
}

export async function patchResident(id: number, fields: Record<string, string | null>) {
  return useSupabaseForLighthouseData() ? sb.patchResident(id, fields) : rest.patchResident(id, fields)
}

export async function createResident(body: Parameters<typeof rest.createResident>[0]) {
  return useSupabaseForLighthouseData() ? sb.createResident(body) : rest.createResident(body)
}

export async function getCases() {
  return useSupabaseForLighthouseData() ? sb.getCases() : rest.getCases()
}

export async function updateCaseStatus(caseId: string, status: string) {
  return useSupabaseForLighthouseData()
    ? sb.updateCaseStatus(caseId, status)
    : rest.updateCaseStatus(caseId, status)
}

export async function getProcessRecordings(residentId?: number) {
  return useSupabaseForLighthouseData()
    ? sb.getProcessRecordings(residentId)
    : rest.getProcessRecordings(residentId)
}

export async function createProcessRecording(body: Parameters<typeof rest.createProcessRecording>[0]) {
  return useSupabaseForLighthouseData()
    ? sb.createProcessRecording(body)
    : rest.createProcessRecording(body)
}

export async function getHomeVisitations(residentId?: number) {
  return useSupabaseForLighthouseData()
    ? sb.getHomeVisitations(residentId)
    : rest.getHomeVisitations(residentId)
}

export async function createHomeVisitation(body: Parameters<typeof rest.createHomeVisitation>[0]) {
  return useSupabaseForLighthouseData()
    ? sb.createHomeVisitation(body)
    : rest.createHomeVisitation(body)
}

export async function getInterventionPlans(residentId?: number) {
  return useSupabaseForLighthouseData()
    ? sb.getInterventionPlans(residentId)
    : rest.getInterventionPlans(residentId)
}

export async function createInterventionPlan(body: Parameters<typeof sb.createInterventionPlan>[0]) {
  return useSupabaseForLighthouseData() ? sb.createInterventionPlan(body) : sbDataOnly()
}

export async function getReportsSummary() {
  return useSupabaseForLighthouseData() ? sb.getReportsSummary() : rest.getReportsSummary()
}

function sbDataOnly(): never {
  throw new Error(
    'This action needs Supabase program data. Set VITE_USE_SUPABASE_DATA=true and apply lighthouse migrations.',
  )
}

export async function patchSupporterFields(id: number, fields: Record<string, string | null | undefined>) {
  return useSupabaseForLighthouseData() ? sb.patchSupporterFields(id, fields) : sbDataOnly()
}

export async function deleteSupporter(id: number) {
  return useSupabaseForLighthouseData() ? sb.deleteSupporter(id) : sbDataOnly()
}

export async function patchDonationFields(id: number, fields: Record<string, string | null | undefined>) {
  return useSupabaseForLighthouseData() ? sb.patchDonationFields(id, fields) : sbDataOnly()
}

export async function deleteDonation(id: number) {
  return useSupabaseForLighthouseData() ? sb.deleteDonation(id) : sbDataOnly()
}

export async function createAllocation(body: Parameters<typeof sb.createAllocation>[0]) {
  return useSupabaseForLighthouseData() ? sb.createAllocation(body) : sbDataOnly()
}

export async function patchAllocationFields(id: number, fields: Record<string, string | null | undefined>) {
  return useSupabaseForLighthouseData() ? sb.patchAllocationFields(id, fields) : sbDataOnly()
}

export async function deleteAllocation(id: number) {
  return useSupabaseForLighthouseData() ? sb.deleteAllocation(id) : sbDataOnly()
}

export async function deleteResident(id: number) {
  return useSupabaseForLighthouseData() ? sb.deleteResident(id) : sbDataOnly()
}

export async function deleteProcessRecording(id: number) {
  return useSupabaseForLighthouseData() ? sb.deleteProcessRecording(id) : sbDataOnly()
}

export async function deleteHomeVisitation(id: number) {
  return useSupabaseForLighthouseData() ? sb.deleteHomeVisitation(id) : sbDataOnly()
}

export async function deleteInterventionPlan(id: number) {
  return useSupabaseForLighthouseData() ? sb.deleteInterventionPlan(id) : sbDataOnly()
}

export async function listEducationRecords(residentId?: number) {
  return useSupabaseForLighthouseData() ? sb.listEducationRecords(residentId) : []
}

export async function listHealthRecords(residentId?: number) {
  return useSupabaseForLighthouseData() ? sb.listHealthRecords(residentId) : []
}

export async function listIncidentReports(residentId?: number) {
  return useSupabaseForLighthouseData() ? sb.listIncidentReports(residentId) : []
}

export async function createEducationRecord(residentId: number, fields: Record<string, string>) {
  return useSupabaseForLighthouseData() ? sb.createEducationRecord(residentId, fields) : sbDataOnly()
}

export async function patchEducationRecord(id: number, fields: Record<string, string | null | undefined>) {
  return useSupabaseForLighthouseData() ? sb.patchEducationRecord(id, fields) : sbDataOnly()
}

export async function createHealthRecord(residentId: number, fields: Record<string, string>) {
  return useSupabaseForLighthouseData() ? sb.createHealthRecord(residentId, fields) : sbDataOnly()
}

export async function patchHealthRecord(id: number, fields: Record<string, string | null | undefined>) {
  return useSupabaseForLighthouseData() ? sb.patchHealthRecord(id, fields) : sbDataOnly()
}

export async function createIncidentReport(residentId: number, fields: Record<string, string>) {
  return useSupabaseForLighthouseData() ? sb.createIncidentReport(residentId, fields) : sbDataOnly()
}

export async function patchIncidentReport(id: number, fields: Record<string, string | null | undefined>) {
  return useSupabaseForLighthouseData() ? sb.patchIncidentReport(id, fields) : sbDataOnly()
}
