import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc as fsSetDoc, getDoc, getDocs, collection } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBfEOcLjk_E7fYCzvfqDFkJImfNdTNYA5w',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'valquiz-8.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'valquiz-8',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'valquiz-8.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1019333715252',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1019333715252:web:e592a19ece697cb03e3161',
};

const app = getApps().length === 0 ? initializeApp(config) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const firestore = getFirestore(app);
const db = firestore; // Alias to prevent any import breakage
const isMock = false;

isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});

// ─── Safe DB Wrapper Functions pointing to Firestore ───

export const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
};

export const setDoc = (ref: any, data: any, options?: any) => {
  return fsSetDoc(ref, cleanUndefined(data), options);
};

export const safeSignInAnonymously = () => {
  return signInAnonymously(auth);
};

export const safeRef = (path: string) => {
  return path;
};

export const safeSet = async (path: string, value: any) => {
  const parts = path.split('/');
  if (parts[0] === 'quizzes') {
    const quizId = parts[1];
    return setDoc(doc(firestore, 'quizzes', quizId), value);
  }
  if (parts[0] === 'game_sessions') {
    const pin = parts[1];
    return setDoc(doc(firestore, 'game_sessions', pin), value, { merge: true });
  }
  return Promise.resolve();
};

export const safePush = (reference: any) => {
  const key = `quiz_${Date.now()}`;
  return {
    path: `${reference}/${key}`,
    key,
  };
};

export const safeGet = async (path: string) => {
  const parts = path.split('/');
  
  if (path === 'quizzes') {
    const querySnapshot = await getDocs(collection(firestore, 'quizzes'));
    const valObj: any = {};
    querySnapshot.forEach((doc) => {
      valObj[doc.id] = doc.data();
    });
    return {
      exists: () => querySnapshot.size > 0,
      val: () => valObj,
    };
  }
  
  if (parts[0] === 'quizzes') {
    const quizId = parts[1];
    const docSnap = await getDoc(doc(firestore, 'quizzes', quizId));
    return {
      exists: () => docSnap.exists(),
      val: () => docSnap.data(),
    };
  }
  
  if (parts[0] === 'game_sessions') {
    const pin = parts[1];
    const docSnap = await getDoc(doc(firestore, 'game_sessions', pin));
    return {
      exists: () => docSnap.exists(),
      val: () => docSnap.data(),
    };
  }
  
  return {
    exists: () => false,
    val: () => null,
  };
};

export const safeSignOut = async () => {
  return firebaseSignOut(auth);
};

export { app, auth, googleProvider, firestore, db, isMock };
