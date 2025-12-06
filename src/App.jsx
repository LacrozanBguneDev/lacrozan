import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';

// --- Konfigurasi dan Inisialisasi Firebase ---

// Variabel global dari environment Canvas
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'Secure-App';

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Konstanta Styling Tailwind
const COMPLEX_BG = "bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900";
const CARD_STYLE = "bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-8 md:p-10 transition duration-500 transform hover:shadow-indigo-500/50 hover:scale-[1.01]";
const BUTTON_STYLE = "w-full flex items-center justify-center font-bold py-3 rounded-xl transition duration-300 ease-in-out shadow-lg transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-offset-2";
const INPUT_STYLE = "w-full p-3 rounded-lg bg-white/5 border border-white/30 text-white placeholder-gray-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400";

// --- Komponen Tombol Google Sign In ---
const GoogleSignInButton = ({ onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`${BUTTON_STYLE} bg-white text-gray-800 hover:bg-gray-100 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {/* SVG Icon Google */}
        <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#FBC02D" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.706-6.088 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.867 1.192 7.953 3.149l4.331-4.331C34.364 8.769 29.818 7 24 7c-9.941 0-18 8.059-18 18s8.059 18 18 18c10.375 0 17.848-7.794 17.848-17.65 0-1.152-.109-2.29-.313-3.417z" />
            <path fill="#4285F4" d="M6 25c0 8.836 7.164 16 16 16s16-7.164 16-16H31c0 4.97-4.03 9-9 9s-9-4.03-9-9H6z" />
            <path fill="#34A853" d="M43.611 20.083c-.767-.532-1.928-.79-3.235-.978l-4.225-.668c-1.282-.204-2.527-.317-3.651-.317-6.627 0-12 5.373-12 12s5.373 12 12 12c4.89 0 9.27-.978 12.56-2.583l-3.352-3.352c-1.745.748-3.778 1.189-5.748 1.189-5.184 0-9.45-3.882-10.27-8.883h24.813c.204-1.127.317-2.29.317-3.417 0-1.144-.112-2.288-.317-3.417z" />
            <path fill="#EA4335" d="M24 7c3.275 0 6.137 1.192 8.353 3.149l4.331-4.331C34.364 8.769 29.818 7 24 7c-9.941 0-18 8.059-18 18h5c0-6.627 5.373-12 12-12z" />
        </svg>
        Masuk dengan Google
    </button>
);

// --- Komponen Utama Autentikasi ---
const AuthSection = ({ user, handleSignIn, handleSignOut, authReady, isLoading }) => {
  if (!authReady) {
    return (
      <div className="text-center p-12 text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-indigo-400 mx-auto"></div>
        <p className="mt-4 text-gray-300">Memuat sistem autentikasi...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {user ? (
        // STATE: Sudah Masuk (Logged In)
        <div className="text-center space-y-6 text-white">
          <div className="flex justify-center">
            <img
              src={user.photoURL || 'https://placehold.co/100x100/4c1d95/ffffff?text=U'}
              alt="User Avatar"
              className="w-24 h-24 rounded-full border-4 border-purple-400 shadow-xl transition-all duration-300 hover:rotate-3"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-3xl font-extrabold text-white">
            Selamat Datang, {user.displayName || 'Pengguna'}
          </h2>
          <p className="text-indigo-200">
            Anda berhasil masuk. Ini adalah sesi {user.isAnonymous ? 'Anonim (Guest)' : 'Premium (Google)'}.
          </p>
          
          <div className="bg-white/10 p-4 rounded-xl text-left">
            <p className="font-semibold text-gray-300 mb-1">ID Pengguna (UID):</p>
            <p className="font-mono text-sm text-yellow-300 break-all">{user.uid}</p>
          </div>

          <button
            onClick={handleSignOut}
            className={`${BUTTON_STYLE} bg-pink-600 hover:bg-pink-700 text-white focus:ring-pink-500`}
            disabled={isLoading}
          >
             {isLoading ? 'Keluar...' : 'Keluar (Sign Out)'}
          </button>
        </div>
      ) : (
        // STATE: Belum Masuk (Logged Out)
        <div className="space-y-6">
          <h2 className="text-4xl font-extrabold text-white text-center drop-shadow-lg">
            Akses Sistem
          </h2>
          <p className="text-center text-indigo-200">
            Gunakan otentikasi Google untuk keamanan dan sinkronisasi data.
          </p>
          
          <div className="space-y-4 pt-4">
            {/* Input Placeholder (for complex look, not functional) */}
            <input type="text" placeholder="Email (Hanya Google yang didukung)" className={INPUT_STYLE} disabled />
            <input type="password" placeholder="Password (Tidak Digunakan)" className={INPUT_STYLE} disabled />
          </div>

          <GoogleSignInButton onClick={handleSignIn} disabled={isLoading} />
        </div>
      )}

      {/* Footer Status */}
      <div className="mt-8 pt-6 border-t border-white/20 text-center">
          <h3 className="text-xs font-medium text-gray-400 mb-1">
            Status Aplikasi
          </h3>
          <p className="text-xs text-gray-500 break-all">
            App ID: <span className="font-mono text-gray-400">{appId}</span>
          </p>
      </div>
    </div>
  );
};

// --- Komponen Utama App ---
export const App = () => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Inisialisasi Auth dan Listener
  useEffect(() => {
    let unsubscribe;

    const initializeAuth = async () => {
      try {
        // Otentikasi awal dengan Custom Token atau Anonim
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Gagal Otentikasi Awal:", e);
      }

      // Listener perubahan state Auth
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthReady(true);
      });
    };

    initializeAuth();

    // Cleanup subscription
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 2. Handler Google Sign In
  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Panggil Google Sign-In via Popup
      await signInWithPopup(auth, provider);
      // State user akan diupdate oleh onAuthStateChanged
    } catch (e) {
      console.error("Error Google Sign In:", e);
      let errorMessage = "Terjadi kesalahan saat masuk.";

      if (e.code === 'auth/popup-closed-by-user') {
        errorMessage = "Popup ditutup oleh pengguna. Silakan coba lagi.";
      } else if (e.code === 'auth/cancelled-popup-request') {
        errorMessage = "Permintaan masuk dibatalkan. Pastikan popup diizinkan.";
      } else if (e.code === 'auth/account-exists-with-different-credential') {
        errorMessage = "Email ini sudah terdaftar dengan metode lain (contoh: email/password).";
      } else {
        errorMessage = e.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handler Sign Out
  const handleSignOut = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signOut(auth);
      // Re-authenticate secara anonim untuk menjaga sesi Canvas tetap berjalan
      await signInAnonymously(auth);
    } catch (e) {
      console.error("Error Sign Out:", e);
      setError("Gagal keluar: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${COMPLEX_BG} font-sans`}>
      <div className="w-full max-w-lg">
        
        {/* Kontainer Card Glassmorphism */}
        <div className={CARD_STYLE}>
            
            {/* Header */}
            <header className="text-center mb-10">
                <h1 className="text-5xl font-black text-white leading-tight drop-shadow-md">
                    Secure<span className="text-pink-400">Sphere</span>
                </h1>
                <p className="text-indigo-300 mt-2 text-lg font-medium">
                    Sistem Otentikasi Kompleks (Google Only)
                </p>
            </header>

            {/* Bagian Autentikasi */}
            <AuthSection
                user={user}
                handleSignIn={handleSignIn}
                handleSignOut={handleSignOut}
                authReady={authReady}
                isLoading={isLoading}
            />
        </div>

        {/* Error/Message Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-800/80 border-t-4 border-red-500 text-white rounded-xl shadow-lg text-sm transition-all duration-300 animate-pulse">
            <p className="font-bold">⚠️ Kesalahan Autentikasi:</p>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;