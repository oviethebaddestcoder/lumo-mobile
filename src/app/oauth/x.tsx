import { Redirect } from 'expo-router';

// Android delivers the X OAuth redirect (lumo://oauth/x?code=…) as a deep
// link; expo-auth-session has already captured it, so just leave.
export default function XRedirect() {
  return <Redirect href="/" />;
}
