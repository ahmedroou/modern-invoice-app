import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import fs from 'fs';

// Read .env
const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [k, ...v] = trimmed.split('=');
    if (k) env[k.trim()] = v.join('=').trim();
  }
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

console.log('Testing Cloud Firestore Connection for Project:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testConnection() {
  const testDocRef = doc(db, 'invoices', 'connection_probe');
  const now = new Date().toISOString();

  console.log('1. Writing probe document to Cloud Firestore...');
  await setDoc(testDocRef, {
    probeId: 'connection_probe',
    verifiedAt: now,
    status: 'ONLINE',
    message: 'Modern Invoice Desktop successfully connected to Cloud Firestore'
  });
  console.log('✓ Write to Cloud Firestore succeeded!');

  console.log('2. Reading back probe document from Cloud Firestore...');
  const snapshot = await getDoc(testDocRef);
  if (snapshot.exists()) {
    console.log('✓ Read verified! Document data:', snapshot.data());
  } else {
    throw new Error('Document not found after write!');
  }

  console.log('3. Cleaning up probe document...');
  await deleteDoc(testDocRef);
  console.log('✓ Cleanup completed! Cloud Firestore is active, responsive, and working 100%.');
}

testConnection()
  .then(() => {
    console.log('ALL CLOUD FIRESTORE TESTS PASSED!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Connection test failed:', err);
    process.exit(1);
  });
