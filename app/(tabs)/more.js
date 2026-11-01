/**
 * app/(tabs)/more.js
 * Legacy "More" tab — redirects to Profile tab so old deep links never 404.
 */
import { Redirect } from 'expo-router';

export default function MoreRedirect() {
  return <Redirect href="/(tabs)/profile" />;
}
