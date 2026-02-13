import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, query, where, doc, updateDoc, getDoc, runTransaction, serverTimestamp, addDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAzzCc3z1g8-Zh-0WSS2ttOTrExXJuqnFE",
    authDomain: "laundry-webapp-d3e0c.firebaseapp.com",
    projectId: "laundry-webapp-d3e0c",
    storageBucket: "laundry-webapp-d3e0c.firebasestorage.app",
    messagingSenderId: "740474113356",
    appId: "1:740474113356:web:018c7a108da4ebceae13e9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// State Global
let currentDriverId = null;
let currentBalance = 0;
let driverNameGlobal = "";
const MIN_BALANCE_LIMIT = -100000; // Batas saldo minus

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.replace("login-driver.html"); return; }
    currentDriverId = user.uid;
    syncDriverData();
    syncExploreJobs();
    syncMyJobs();
});

// 1. Ambil Data Profil & Saldo Driver
function syncDriverData() {
    onSnapshot(doc(db, "drivers", currentDriverId), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            currentBalance = data.balance || 0;
            driverNameGlobal = data.accName || data.name || "Mitra Driver";
            
            document.getElementById("headerDriverName").innerText = driverNameGlobal;
            document.getElementById("driverNameDisplay").innerText = driverNameGlobal;
            document.getElementById("driverInitial").innerText = driverNameGlobal.charAt(0).toUpperCase();
            
            const balStr = `Rp ${currentBalance.toLocaleString()}`;
            document.getElementById("driverBalanceHeader").innerText = balStr;
            document.getElementById("profileBalanceDisplay").innerText = balStr;
            
            const color = currentBalance < 0 ? "#ef4444" : "#0ea5e9";
            document.getElementById("driverBalanceHeader").style.color = color;
            document.getElementById("profileBalanceDisplay").style.color = color;
        }
    });
}

// 2. Pantau Orderan Global (Fase Jemput & Fase Antar)
function syncExploreJobs() {
    // Menampilkan order 'searching' (butuh jemput) atau 'ready_to_deliver' (butuh antar)
    const q = query(collection(db, "orders"), where("status", "in", ["searching", "ready_to_deliver"]));
    onSnapshot(q, (snap) => {
        const list = document.getElementById("availableJobs");
        if(!list) return;
        list.innerHTML = "";
        
        if (snap.empty) {
            list.innerHTML = '<p style="text-align:center; padding:50px; color:#94a3b8;">Belum ada tugas tersedia.</p>';
            return;
        }
        
        snap.forEach(dDoc => {
            const d = dDoc.data();
            const isAntar = d.status === "ready_to_deliver";
            list.innerHTML += `
                <div class="card-order">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span class="badge" style="background:${isAntar ? '#f0fdf4' : '#fff7ed'}; color:${isAntar ? '#16a34a' : '#c2410c'}; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700;">
                            ${isAntar ? '📦 ANTAR KE CUST' : '🛵 JEMPUT KE TOKO'}
                        </span>
                        <strong style="color:#0ea5e9;">+Rp 5.000</strong>
                    </div>
                    <h4 style="margin:5px 0; font-size: 15px;">${d.laundryName}</h4>
                    <p style="font-size:12px; color:#64748b; margin-bottom:15px;">Customer: ${d.customerName}</p>
                    <button onclick="takeJob('${dDoc.id}', '${d.status}')" class="btn-driver" style="width:100%; background:#0ea5e9; color:white; border:none; padding:10px; border-radius:12px; font-weight:700;">Ambil Tugas</button>
                </div>`;
        });
        if (window.lucide) lucide.createIcons();
    });
}

window.takeJob = async (id, status) => {
    if (currentBalance <= MIN_BALANCE_LIMIT) return Swal.fire("Saldo Limit", "Silakan topup saldo untuk mengambil order.", "error");
    
    const nextStatus = status === "searching" ? "taken" : "delivering";
    await updateDoc(doc(db, "orders", id), { 
        driverId: currentDriverId, 
        status: nextStatus 
    });
    Swal.fire("Berhasil", "Tugas telah diambil, cek tab Tugas.", "success");
};

// 3. Kelola Tugas Aktif Driver
function syncMyJobs() {
    const q = query(collection(db, "orders"), where("driverId", "==", currentDriverId));
    onSnapshot(q, (snap) => {
        const listMy = document.getElementById("myOrders");
        const listHist = document.getElementById("historyOrders");
        if(!listMy) return;
        
        listMy.innerHTML = ""; listHist.innerHTML = "";

        snap.forEach(dDoc => {
            const d = dDoc.data();
            const id = dDoc.id;

            if (d.status === "completed") {
                listHist.innerHTML += `<div class="card-order" style="padding:15px; margin-bottom:10px;"><strong>${d.laundryName}</strong><br><small>Selesai pada: ${d.createdAt?.toDate().toLocaleDateString()}</small></div>`;
                return;
            }

            if (["taken", "collected", "delivering"].includes(d.status)) {
                const waLink = `https://wa.me/${d.customerWA}`;
                let nextBtn = "";
                let statusLabel = "";

                if (d.status === "taken") {
                    statusLabel = "🛵 Menuju Lokasi Jemput";
                    nextBtn = `<button onclick="updateStatusSaja('${id}', 'collected')" class="btn-driver" style="background:#f59e0b; color:white; width:100%; border:none; padding:12px; border-radius:12px; font-weight:700;">Konfirmasi Barang Diambil</button>`;
                } 
                else if (d.status === "collected") {
                    statusLabel = "🧺 Menuju Toko Laundry";
                    // TAHAP FINISH JEMPUT (Driver A Selesai & Cair Komisi)
                    nextBtn = `<button onclick="finishJemput('${id}', '${d.tenantId}')" class="btn-driver" style="background:#10b981; color:white; width:100%; border:none; padding:12px; border-radius:12px; font-weight:700;">Sudah Sampai di Toko (Cairkan Komisi)</button>`;
                } 
                else if (d.status === "delivering") {
                    statusLabel = "📦 Mengantar ke Customer";
                    // TAHAP FINISH ANTAR (Driver B Selesai & Transaksi Tunai)
                    nextBtn = `<button onclick="finishAntar('${id}', ${d.finalPrice || d.estPrice || 0}, '${d.tenantId}')" class="btn-driver" style="background:#0ea5e9; color:white; width:100%; border:none; padding:12px; border-radius:12px; font-weight:700;">Selesai & Terima Tunai</button>`;
                }

                listMy.innerHTML += `
                    <div class="card-order" style="border-left: 5px solid #0ea5e9; margin-bottom:15px; padding:15px; background:white; border-radius:15px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                        <p style="font-size:10px; font-weight:800; color:#0ea5e9; margin-bottom:5px;">${statusLabel}</p>
                        <h4 style="margin:0 0 5px 0;">${d.laundryName}</h4>
                        <p style="font-size:12px; color:#64748b;">Cust: <b>${d.customerName}</b></p>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin:15px 0;">
                            <a href="${waLink}" target="_blank" style="text-decoration:none; background:#25d366; color:white; padding:10px; border-radius:10px; text-align:center; font-size:12px; font-weight:700;">WhatsApp</a>
                            <button onclick="Swal.fire('Lokasi', 'Navigasi ke titik GPS aktif', 'info')" style="background:#ef4444; color:white; border:none; padding:10px; border-radius:10px; font-size:12px; font-weight:700;">Buka Maps</button>
                        </div>
                        ${nextBtn}
                    </div>`;
            }
        });
        if (window.lucide) lucide.createIcons();
    });
}

// FUNGSI 1: Update Status Tanpa Transaksi Saldo (Saat Jemput dari Cust)
window.updateStatusSaja = async (orderId, status) => {
    await updateDoc(doc(db, "orders", orderId), { status: status });
    Swal.fire("Tugas Diperbarui", "Barang sudah di tangan Anda, silakan menuju toko.", "info");
};

// FUNGSI 2: Selesaikan Tahap Jemput (Driver A - Cair Saldo 5rb)
window.finishJemput = async (orderId, tenantId) => {
    try {
        await runTransaction(db, async (transaction) => {
            const driverRef = doc(db, "drivers", currentDriverId);
            const ownerRef = doc(db, "laundries", tenantId); 
            const orderRef = doc(db, "orders", orderId);

            const dSnap = await transaction.get(driverRef);
            const oSnap = await transaction.get(ownerRef);

            if (!oSnap.exists()) throw "Data Toko tidak ditemukan!";

            // Update Order: Status ke at_laundry dan KOSONGKAN driverId agar bisa diambil driver lain nanti
            transaction.update(orderRef, { 
                status: "at_laundry",
                driverId: null 
            });

            // Update Saldo: Driver +5rb, Owner -5rb
            transaction.update(driverRef, { balance: (dSnap.data().balance || 0) + 5000 });
            transaction.update(ownerRef, { balance: (oSnap.data().balance || 0) - 5000 });
        });

        Swal.fire("Sukses!", "Barang diserahkan ke toko. Komisi Rp 5.000 masuk saldo!", "success");
    } catch (e) {
        Swal.fire("Error", "Gagal konfirmasi: " + e.message, "error");
    }
};

// FUNGSI 3: Selesaikan Tahap Antar (Driver B - Terima Tunai & Potong Setoran)
window.finishAntar = async (orderId, totalBill, tenantId) => {
    const netSetoran = totalBill - 5000; // Total dikurangi jatah driver 5rb
    
    const res = await Swal.fire({
        title: 'Konfirmasi Selesai',
        html: `Pastikan Anda sudah menerima tunai:<br><b style="font-size:20px; color:#10b981;">Rp ${totalBill.toLocaleString()}</b>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Sudah Terima'
    });

    if (res.isConfirmed) {
        try {
            await runTransaction(db, async (transaction) => {
                const driverRef = doc(db, "drivers", currentDriverId);
                const ownerRef = doc(db, "laundries", tenantId);
                const orderRef = doc(db, "orders", orderId);

                const dSnap = await transaction.get(driverRef);
                const oSnap = await transaction.get(ownerRef);

                transaction.update(orderRef, { status: "completed" });
                
                // Potong saldo driver (setoran), tambah saldo owner
                transaction.update(driverRef, { balance: (dSnap.data().balance || 0) - netSetoran });
                transaction.update(ownerRef, { balance: (oSnap.data().balance || 0) + netSetoran });
            });
            Swal.fire("Berhasil", "Pesanan selesai. Terima kasih, Mitra!", "success");
        } catch (e) {
            Swal.fire("Error", e.message, "error");
        }
    }
};

// --- FITUR PROFIL & LAINNYA ---
window.requestWithdraw = async () => {
    if (currentBalance < 10000) return Swal.fire("Gagal", "Minimal saldo Rp 10.000 untuk ditarik.", "error");
    
    const { value: amount } = await Swal.fire({
        title: 'Tarik Saldo',
        input: 'number',
        inputLabel: `Saldo Anda: Rp ${currentBalance.toLocaleString()}`,
        inputPlaceholder: 'Masukkan nominal...',
        showCancelButton: true
    });

    if (amount && amount >= 10000 && amount <= currentBalance) {
        await addDoc(collection(db, "withdraw_requests"), {
            driverId: currentDriverId,
            driverName: driverNameGlobal,
            amount: parseInt(amount),
            status: "pending",
            type: "driver",
            createdAt: serverTimestamp()
        });
        Swal.fire("Berhasil", "Permintaan penarikan dikirim ke admin.", "success");
    }
};

window.logout = async () => {
    const res = await Swal.fire({
        title: 'Logout?',
        text: "Anda akan keluar dari akun mitra.",
        icon: 'warning',
        showCancelButton: true
    });
    if(res.isConfirmed) {
        await signOut(auth);
        window.location.href="login-driver.html";
    }
};
