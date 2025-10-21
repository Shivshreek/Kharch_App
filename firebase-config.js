import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIG & INITIALIZATION ---
const firebaseConfig = {
    "apiKey": "AIzaSyBGdWYuD4oeKczwsjDfYckMm_sJu0uWP38",
    "authDomain": "kharch-tracker-79680.firebaseapp.com",
    "projectId": "kharch-tracker-79680",
    "storageBucket": "kharch-tracker-79680.appspot.com",
    "messagingSenderId": "599284399757",
    "appId": "1:599284399757:web:4918fec447c1f408b9ecc4",
    "measurementId": "G-JQM8G7X0YY"
};

let app, db, auth;

try {  
    app = initializeApp(firebaseConfig);  
    db = getFirestore(app);  
    auth = getAuth(app);  
} catch(e) {  
    console.error("Firebase initialization failed:", e);  
}

// Doosri files mein istemal karne ke liye export karein
export { app, db, auth };
