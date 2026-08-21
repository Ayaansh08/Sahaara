import React from 'react';
import { Redirect } from 'expo-router';

export default function HomeRedirect() {
  return <Redirect href="/(tabs)/home" />;
}
