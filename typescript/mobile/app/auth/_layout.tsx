/**
 * Auth routes layout — simple stack with no header.
 */

import { Stack } from 'expo-router'
import React from 'react'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="create" />
      <Stack.Screen name="import" />
      <Stack.Screen name="unlock" options={{ gestureEnabled: false }} />
    </Stack>
  )
}
