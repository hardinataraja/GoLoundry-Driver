import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAzzCc3z1g8-Zh-0WSS2ttOTrExXJuqnFE",
    authDomain: "laundry-webapp-d3e0c.firebaseapp.com",
    projectId: "laundry-webapp-d3e0c",
    storageBucket: "laundry-webapp-d3e0c.firebasestorage.app",
    messagingSenderId: "740474113356",
    appId: "1:740474113356:web:018c7a108da4ebceae13e9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const COLLECTION = "drivers";
const TARGET_PAGE = "index.html";


// ===== LOGIN DRIVER =====
window.driverLogin = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password)
        return Swal.fire("Info", "Email & password wajib diisi", "info");

    Swal.fire({ title: "Memverifikasi...", didOpen: () => Swal.showLoading() });

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const snap = await getDoc(doc(db, COLLECTION, uid));

        if (!snap.exists()) {
            await signOut(auth);
            return Swal.fire("Akses Ditolak", "Akun bukan DRIVER", "error");
        }

        Swal.fire("Berhasil", "Selamat datang Driver!", "success")
            .then(() => window.location.replace(TARGET_PAGE));

    } catch (err) {
        Swal.fire("Gagal", "Email atau password salah", "error");
    }
};


// ===== REGISTER DRIVER =====
window.driverSignup = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const driverName = document.getElementById("driverName").value;

    if (!email || !password || !driverName)
        return Swal.fire("Info", "Semua field wajib diisi", "info");

    Swal.fire({ title: "Mendaftarkan...", didOpen: () => Swal.showLoading() });

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const data = {
            uid,
            email,
            role: "driver",
            driverName,
            balance: 0,
            createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, COLLECTION, uid), data);

        Swal.fire("Berhasil", "Akun driver dibuat!", "success")
            .then(() => location.reload());

    } catch (err) {
        Swal.fire("Gagal Daftar", err.message, "error");
    }
};
