import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase, ref as dbRef, set as dbSet, get as dbGet, push as dbPush } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'placeholder-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'placeholder-auth-domain',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'placeholder-database-url',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'placeholder-project-id',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'placeholder-storage-bucket',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'placeholder-messaging-sender-id',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'placeholder-app-id',
};

let app: any;
let auth: any;
let db: any;
let googleProvider: any;
let isMock = false;

try {
  // If API key is a placeholder or not provided, trigger mock/sandbox fallback
  if (
    !config.apiKey ||
    config.apiKey.includes('placeholder') ||
    config.apiKey === 'your_firebase_api_key_here'
  ) {
    throw new Error('Firebase key is a placeholder or unconfigured.');
  }
  app = getApps().length === 0 ? initializeApp(config) : getApp();
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  db = getDatabase(app);
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  });
} catch (e) {
  console.warn("Firebase client initialized in Sandbox Mode (using LocalStorage fallback):", e);
  isMock = true;
  auth = {
    currentUser: null,
    onAuthStateChanged: (callback: (user: any) => void) => {
      // Check if simulated user is logged in
      const stored = localStorage.getItem('valquiz_mock_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        auth.currentUser = parsed;
        callback(parsed);
      } else {
        auth.currentUser = null;
        callback(null);
      }
      // Return a mock unsubscriber function
      return () => {};
    },
    signOut: async () => {
      localStorage.removeItem('valquiz_mock_user');
      auth.currentUser = null;
      return Promise.resolve();
    },
  };
  googleProvider = {};
  db = {};
}

// ─── Safe DB Wrapper Functions to support transparent Fallbacks ───

export const safeRef = (path: string) => {
  if (isMock) {
    return { path, isMockRef: true };
  }
  return dbRef(db, path);
};

export const safeSet = async (reference: any, value: any) => {
  if (isMock || reference?.isMockRef) {
    console.log(`[Firebase DB Mock Set] Path: ${reference.path}`, value);
    
    // Save Custom Quizzes
    if (reference.path.startsWith('quizzes/')) {
      const quizId = reference.path.split('/')[1];
      const existing = localStorage.getItem('valquiz_custom_quizzes');
      const list = existing ? JSON.parse(existing) : [];
      const item = { ...value, id: quizId };
      const idx = list.findIndex((q: any) => q.id === quizId);
      if (idx > -1) {
        list[idx] = item;
      } else {
        list.push(item);
      }
      localStorage.setItem('valquiz_custom_quizzes', JSON.stringify(list));
    }
    // Save Game Sessions
    else if (reference.path.startsWith('game_sessions/')) {
      const pin = reference.path.split('/')[1];
      localStorage.setItem(`valquiz_game_session_${pin}`, JSON.stringify(value));
    }
    return Promise.resolve();
  }
  return dbSet(reference, value);
};

export const safePush = (reference: any) => {
  if (isMock || reference?.isMockRef) {
    const key = `quiz_${Date.now()}`;
    return {
      path: `${reference.path}/${key}`,
      key,
      isMockRef: true,
    };
  }
  return dbPush(reference);
};

export const safeGet = async (reference: any) => {
  if (isMock || reference?.isMockRef) {
    console.log(`[Firebase DB Mock Get] Path: ${reference.path}`);
    
    if (reference.path === 'quizzes') {
      const existing = localStorage.getItem('valquiz_custom_quizzes');
      const data = existing ? JSON.parse(existing) : [];
      // Format as snapshot
      return {
        exists: () => data.length > 0,
        val: () => {
          const obj: any = {};
          data.forEach((q: any) => {
            obj[q.id] = q;
          });
          return obj;
        },
      };
    } else if (reference.path.startsWith('quizzes/')) {
      const quizId = reference.path.split('/')[1];
      const existing = localStorage.getItem('valquiz_custom_quizzes');
      const list = existing ? JSON.parse(existing) : [];
      const found = list.find((q: any) => q.id === quizId);
      return {
        exists: () => !!found,
        val: () => found,
      };
    } else if (reference.path.startsWith('game_sessions/')) {
      const pin = reference.path.split('/')[1];
      const stored = localStorage.getItem(`valquiz_game_session_${pin}`);
      const found = stored ? JSON.parse(stored) : null;
      return {
        exists: () => !!found,
        val: () => found,
      };
    }
    
    return {
      exists: () => false,
      val: () => null,
    };
  }
  return dbGet(reference);
};

export { auth, googleProvider, db, isMock };
