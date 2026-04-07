import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { createSupporter } from './admin'
import type { AppRole } from './profile'

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
  if (!isSupabaseConfigured()) {
    throw new Error('Registration requires Supabase (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).')
  }
  const sb = getSupabase()
  const { data: signUpData, error: signErr } = await sb.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })
  if (signErr) throw new Error(signErr.message)
  const user = signUpData.user
  if (!user?.id) {
    throw new Error(
      'If email confirmation is enabled, check your inbox to verify your account, then sign in to finish setup. Otherwise try signing in now.',
    )
  }

  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim() || input.displayName.trim()

  const { error: profErr } = await sb.from('profiles').insert({
    id: user.id,
    email: input.email.trim().toLowerCase(),
    full_name: fullName,
    role: 'donor' satisfies AppRole,
  })
  if (profErr) throw new Error(profErr.message)

  await createSupporter({
    supporterType: input.supporterType.trim() || 'MonetaryDonor',
    displayName: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    region: input.region.trim() || undefined,
    status: 'Active',
    organizationName: input.organizationName.trim() || undefined,
    firstName: input.firstName.trim() || undefined,
    lastName: input.lastName.trim() || undefined,
    relationshipType: input.relationshipType.trim() || undefined,
    country: input.country.trim() || undefined,
    phone: input.phone.trim() || undefined,
    acquisitionChannel: input.acquisitionChannel.trim() || 'Website',
  })
}
