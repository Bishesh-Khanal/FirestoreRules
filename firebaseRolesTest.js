import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, collection, setDoc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

initializeAdminApp({
  projectId: "firestorerules-70291"
});

const app = initializeApp({
  apiKey: "fake-api-key",
  authDomain: "localhost",
  projectId: "firestorerules-70291",
});

const auth = getAuth(app);
const db = getFirestore(app);
const adminAuth = getAdminAuth();

connectAuthEmulator(auth, "http://127.0.0.1:9099");
connectFirestoreEmulator(db, "127.0.0.1", 8080);

const users = [
  { email: "admin@example.com", password: "admin123", role: "admin" },
  { email: "editor@example.com", password: "editor123", role: "editor" },
  { email: "viewer@example.com", password: "viewer123", role: "viewer" },
];

async function setupUsers() {
  for (const u of users) {
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({ email: u.email, password: u.password });
      console.log(`Created: ${u.email}`);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        userRecord = await adminAuth.getUserByEmail(u.email);
        console.log(`Exists: ${u.email}`);
      }
    }
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: u.role });
    console.log(`Role: ${u.role} for ${u.email}`);
  }
}

async function testUser(user) {
  await signInWithEmailAndPassword(auth, user.email, user.password);
  console.log(`\n${user.role}: ${user.email}`);

  const testRef = doc(collection(db, "testCollection"));
  let docExists = false;

  try {
    await setDoc(testRef, { content: "Test data", role: user.role });
    console.log("CREATE: OK");
    docExists = true;
  } catch {
    console.log("CREATE: DENIED");
  }

  if (!docExists && user.role !== "admin") {
    await auth.signOut();
    await signInWithEmailAndPassword(auth, "admin@example.com", "admin123");
    await setDoc(testRef, { content: "Admin doc" });
    await auth.signOut();
    await signInWithEmailAndPassword(auth, user.email, user.password);
    docExists = true;
  }

  try {
    await getDoc(testRef);
    console.log("READ: OK");
  } catch {
    console.log("READ: DENIED");
  }

  if (docExists) {
    try {
      await updateDoc(testRef, { content: "Updated" });
      console.log("UPDATE: OK");
    } catch {
      console.log("UPDATE: DENIED");
    }
  }

  try {
    await deleteDoc(testRef);
    console.log("DELETE: OK");
  } catch {
    console.log("DELETE: DENIED");
  }

  await auth.signOut();
}

async function main() {
  await setupUsers();
  console.log("\n" + "=".repeat(30));
  
  for (const user of users) {
    await testUser(user);
  }
  
  console.log("\nDone.");
}

main();