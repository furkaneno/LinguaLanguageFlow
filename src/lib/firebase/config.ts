const keys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

// Static references are required so Next.js can inline NEXT_PUBLIC_ vars.
const values: Record<(typeof keys)[number], string | undefined> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getMissingFirebaseKeys(): string[] {
  return keys.filter((k) => !values[k]);
}

export function getFirebaseOptions() {
  const missing = getMissingFirebaseKeys();
  if (missing.length) {
    throw new Error(
      `Firebase is not configured. Missing: ${missing.join(", ")}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return {
    apiKey: values.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: values.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: values.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: values.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: values.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: values.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
}
