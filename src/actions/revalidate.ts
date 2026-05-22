'use server'

import { revalidatePath } from 'next/cache'

/**
 * Server action to revalidate a path without causing a full page reload.
 * Use this instead of router.refresh() in client components.
 * 
 * router.refresh() → Full RSC payload refetch + client re-render (page flash)
 * revalidatePath()  → Only marks cached data as stale. Next navigation gets fresh data.
 * 
 * Combined with local state updates, this gives instant UI feedback
 * while ensuring the server data will be fresh on next visit.
 */
export async function revalidateRoute(path: string) {
  revalidatePath(path, 'layout')
}
