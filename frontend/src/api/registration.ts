import { apiFetch, parseJson, setStaffToken } from './client'

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
 * Registers a new donor account against the Azure .NET API.
 * Creates a profile (role=donor) + supporter record, then stores the JWT.
 */
export async function registerDonorAccount(input: DonorRegistrationInput): Promise<void> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      displayName: input.displayName.trim(),
      supporterType: input.supporterType.trim() || 'MonetaryDonor',
      region: input.region.trim() || undefined,
      country: input.country.trim() || 'Philippines',
    }),
  })
  const data = await parseJson<{ token: string }>(res)
  // Store JWT so the donor is immediately signed in after registration
  setStaffToken(data.token)
}
