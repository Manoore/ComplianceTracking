import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithEmailAndPassword,
  sendPasswordResetEmail, createUserWithEmailAndPassword,
  type UserCredential,
} from 'firebase/auth'

const env = (import.meta as any).env ?? {}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAxpE5lYioOk1yTp3nkB-Tt07fY_vp68ig',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'complinow.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'complinow',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'complinow.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '518109429586',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:518109429586:web:1f2fce420100ad6555448b',
  measurementId: 'G-F0P8DR66P3',
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export const firebaseEnabled = true

export async function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider)
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function createFirebaseUser(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password)
}

export async function sendFirebasePasswordReset(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email)
}

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}
