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

// --- LOGIN ---
window.handleAuthLogin = async (role) => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const collectionName = role === 'owner' ? "laundries" : "drivers";
    const targetPage = role === 'owner' ? "../owner/index.html" : "../driver/driver.html";

    if(!email || !password) return Swal.fire("Info", "Email dan password wajib diisi", "info");

    Swal.fire({ title: 'Memverifikasi...', didOpen: () => Swal.showLoading() });

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        // Validasi Role di Firestore
        const userSnap = await getDoc(doc(db, collectionName, uid));
        
        if (userSnap.exists()) {
            Swal.fire("Berhasil", "Selamat Datang!", "success").then(() => {
                window.location.replace(targetPage);
            });
        } else {
            await signOut(auth);
            Swal.fire("Akses Ditolak", `Akun Anda tidak terdaftar sebagai ${role.toUpperCase()}`, "error");
        }
    } catch (err) {
        Swal.fire("Gagal", "Email atau Password salah", "error");
    }
};

// --- REGISTER ---
window.handleAuthSignup = async (role) => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const laundryName = document.getElementById("laundryName") ? document.getElementById("laundryName").value : "";
    const driverName = document.getElementById("driverName") ? document.getElementById("driverName").value : "";
    const collectionName = role === 'owner' ? "laundries" : "drivers";

    if(!email || !password) return Swal.fire("Info", "Email & Password wajib diisi", "info");

    Swal.fire({ title: 'Mendaftarkan...', didOpen: () => Swal.showLoading() });

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const userData = {
            uid: uid,
            email: email,
            role: role,
            balance: 0,
            createdAt: new Date().toISOString()
        };

        if (role === 'owner') userData.laundryName = laundryName;
        if (role === 'driver') userData.driverName = driverName;

        await setDoc(doc(db, collectionName, uid), userData);

        Swal.fire("Berhasil", "Akun dibuat, silakan login", "success").then(() => {
            location.reload();
        });
    } catch (err) {
        Swal.fire("Gagal Daftar", err.message, "error");
    }
};
