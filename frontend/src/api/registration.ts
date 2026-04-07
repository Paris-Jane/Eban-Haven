import { apiFetch, parseJson } from './client'

export type DonorRegistrationInput = {
  email: string
  password: string
  supporterType: string
  displayName: string
  organizationName: string
  firstName: string
  lastName: string
  relationshipType: string
  region: string
  country: string
  phone: string
  acquisitionChannel: string
}

/**
 * Creates Supabase Auth user, profile row (role donor), and supporter record when data mode is Supabase.
 * Requires RLS policy profiles_insert_self and lighthouse insert permissions.
 */
export async function registerDonorAccount(input: DonorRegistrationInput): Promise<void> {
  const res = await apiFetch('/api/public/supporters', {
    method: 'POST',
    body: JSON.stringify({
      supporterType: input.supporterType.trim() || 'MonetaryDonor',
      displayName: input.displayName.trim(),
      email: input.email.trim().toLowerCase(),
      region: input.region.trim() || undefined,
    }),
  })
  await parseJson(res)
}
