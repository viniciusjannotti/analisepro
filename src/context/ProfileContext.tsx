'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase-client'
import { Profile, PROFILE_COLORS } from '@/lib/types'

interface ProfileContextValue {
  profiles: Profile[]
  activeProfile: Profile | null
  setActiveProfile: (profile: Profile) => void
  createProfile: (name: string, color: string) => Promise<Profile>
  suggestedColor: string
  loading: boolean
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Subscribe to profiles collection
  useEffect(() => {
    const q = query(collection(db, 'profiles'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      const data: Profile[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Profile, 'id'>),
        createdAt: doc.data().createdAt?.toDate?.() ?? new Date(),
      }))
      setProfiles(data)
      setLoading(false)

      // Restore active profile from localStorage
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('activeProfileId') : null
      if (savedId) {
        const found = data.find((p) => p.id === savedId)
        if (found) setActiveProfileState(found)
      }
    })
    return () => unsub()
  }, [])

  const setActiveProfile = useCallback((profile: Profile) => {
    setActiveProfileState(profile)
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeProfileId', profile.id)
    }
  }, [])

  const createProfile = useCallback(async (name: string, color: string): Promise<Profile> => {
    const docRef = await addDoc(collection(db, 'profiles'), {
      name,
      color,
      createdAt: serverTimestamp(),
    })
    const newProfile: Profile = { id: docRef.id, name, color, createdAt: new Date() }
    setActiveProfile(newProfile)
    return newProfile
  }, [setActiveProfile])

  // Suggest the first color not already in use
  const usedColors = profiles.map((p) => p.color)
  const suggestedColor =
    PROFILE_COLORS.find((c) => !usedColors.includes(c)) ?? PROFILE_COLORS[0]

  return (
    <ProfileContext.Provider
      value={{ profiles, activeProfile, setActiveProfile, createProfile, suggestedColor, loading }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfiles() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfiles must be used inside ProfileProvider')
  return ctx
}
