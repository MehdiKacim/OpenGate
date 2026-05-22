import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiGet } from "../api/client.js"

export interface RouteProfileSummary {
  id: string
  slug: string
  name: string
  description: string | null
  is_default: number
}

interface StudioContextValue {
  profiles: RouteProfileSummary[]
  profileSlug: string
  setProfileSlug: (slug: string) => void
  isLoading: boolean
}

const StudioContext = createContext<StudioContextValue | null>(null)
const profileStorageKey = "opengate.studio.profile"

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [profileSlug, setProfileSlug] = useState(() => localStorage.getItem(profileStorageKey) || "default")
  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => apiGet("/_opengate/route-profiles"),
  })
  const profiles: RouteProfileSummary[] = profilesQuery.data?.data ?? []

  useEffect(() => {
    if (!profiles.length) return
    if (!profiles.some((profile) => profile.slug === profileSlug)) {
      setProfileSlug(profiles.find((profile) => profile.is_default === 1)?.slug ?? profiles[0].slug)
    }
  }, [profileSlug, profiles])

  useEffect(() => {
    localStorage.setItem(profileStorageKey, profileSlug)
  }, [profileSlug])

  const value = useMemo(
    () => ({
      profiles,
      profileSlug,
      setProfileSlug,
      isLoading: profilesQuery.isLoading,
    }),
    [profiles, profileSlug, profilesQuery.isLoading],
  )

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio() {
  const value = useContext(StudioContext)
  if (!value) throw new Error("useStudio must be used inside StudioProvider")
  return value
}
