// Firebase Cloud Firestore adapter for SmartRoute AI.
// This adapter only activates after a valid Firebase config and Firebase Authentication
// are configured. The existing localStorage prototype remains available as a fallback.
(function () {
  const config = window.SMARTROUTE_FIREBASE_CONFIG || {};
  const configured = Boolean(
    config.apiKey && !config.apiKey.startsWith("PASTE_") &&
    config.projectId && !config.projectId.startsWith("PASTE_") &&
    config.appId && !config.appId.startsWith("PASTE_")
  );

  let db = null;
  let auth = null;
  let initError = "";

  if (configured && window.firebase) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      db = firebase.firestore();
      auth = firebase.auth();
    } catch (error) {
      initError = error.message || "Firebase initialization failed.";
    }
  }

  function status() {
    if (!configured) return { ready: false, message: "Cloud database not configured. Using this browser's local demo storage." };
    if (!db || !auth) return { ready: false, message: initError || "Firebase SDK could not initialize." };
    if (!auth.currentUser) return { ready: false, message: "Firebase is configured, but a signed-in Firebase user is required before cloud data can be accessed." };
    return { ready: true, message: "Cloud database connected." };
  }

  function requireReady() {
    const state = status();
    if (!state.ready) throw new Error(state.message);
    return { db, user: auth.currentUser };
  }

  async function addRecord(collectionName, data) {
    const state = requireReady();
    const ref = await state.db.collection(collectionName).add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: state.user.uid
    });
    return ref.id;
  }

  async function listRecords(collectionName) {
    const state = requireReady();
    const snapshot = await state.db.collection(collectionName).orderBy("createdAt", "desc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  function subscribe(collectionName, callback, onError) {
    const state = requireReady();
    return state.db.collection(collectionName).orderBy("createdAt", "desc").onSnapshot(
      snapshot => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      error => { if (onError) onError(error); }
    );
  }

  async function updateRecord(collectionName, documentId, changes) {
    const state = requireReady();
    await state.db.collection(collectionName).doc(documentId).update({
      ...changes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  window.SmartRouteCloud = {
    configured,
    status,
    addRecord,
    listRecords,
    subscribe,
    updateRecord
  };
})();
