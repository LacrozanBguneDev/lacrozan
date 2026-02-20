import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { 
  AlertTriangle, Home, User, Search, Flame, Zap, 
  LayoutGrid, LogOut, ChevronRight, Sparkles, 
  ArrowRight, Github, Globe, Menu, X, ShieldCheck
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

// ==========================================
// 1. CONFIGURATION & ERROR BOUNDARY
// ==========================================
const CONFIG = {
  APP_NAME: "BguneTools",
  APP_LOGO: "https://c.termai.cc/i150/VrL65.png",
  DEV_PHOTO: "https://c.termai.cc/i6/EAb.jpg",
  DEV_PORTFOLIO: "https://dodo.com"
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md">
                <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-gray-800 mb-2">Terjadi Kesalahan</h2>
                <p className="text-gray-500 text-sm mb-6">Aplikasi mengalami crash. Mohon maaf atas ketidaknyamanan ini.</p>
                <button onClick={() => window.location.reload()} className="bg-sky-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-sky-600 transition w-full">Muat Ulang Aplikasi</button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// 2. FIREBASE SETUP
// (Menggunakan config dari prompt Anda)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
  authDomain: "eduku-web.firebaseapp.com",
  projectId: "eduku-web",
  storageBucket: "eduku-web.firebasestorage.com",
  messagingSenderId: "662463693471",
  appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
  measurementId: "G-G0VWNHHVB8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ==========================================
// 3. GLOBAL STATE MANAGEMENT (CONTEXT API)
// Penjelasan: Ini adalah "otak" aplikasi. Semua data yang 
// butuh diakses di banyak halaman ditaruh di sini.
// ==========================================
const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // State Bisnis Logika
  const [limit, setLimit] = useState(100);
  const [usedToday, setUsedToday] = useState(12);
  const [currentRoute, setCurrentRoute] = useState('landing'); // 'landing', 'dashboard', 'account'

  // Pantau status login secara realtime
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      // Logic Auto-Redirect: Jika login, langsung ke dashboard
      if (currentUser && currentRoute === 'landing') {
        setCurrentRoute('dashboard');
      }
    });
    return () => unsubscribe();
  }, [currentRoute]);

  const handleGoogleLogin = async () => {
    try {
      // Fitur Asli: await signInWithPopup(auth, googleProvider);
      // Mockup untuk preview (karena domain firebase mungkin terblokir di iframe canvas ini)
      setUser({
        displayName: "Pengguna Hebat",
        email: "user@example.com",
        photoURL: "https://ui-avatars.com/api/?name=Pengguna+Hebat&background=0D8ABC&color=fff"
      });
      setCurrentRoute('dashboard');
    } catch (error) {
      console.error("Login gagal:", error);
      alert("Gagal login dengan Google.");
    }
  };

  const handleLogout = async () => {
    try {
      // await signOut(auth);
      setUser(null);
      setCurrentRoute('landing');
    } catch (error) {
      console.error("Logout gagal:", error);
    }
  };

  const deductLimit = (amount = 1) => {
    if (limit - amount >= 0) {
      setLimit(prev => prev - amount);
      setUsedToday(prev => prev + amount);
      return true;
    }
    return false; // Limit habis
  };

  return (
    <AppContext.Provider value={{ 
      user, loadingAuth, currentRoute, setCurrentRoute, 
      handleGoogleLogin, handleLogout, 
      limit, usedToday, deductLimit 
    }}>
      {children}
    </AppContext.Provider>
  );
};

// ==========================================
// 4. MOCK DATA TOOLS & KATEGORI
// (Nanti ini datangnya dari Backend/Admin Dashboard)
// ==========================================
const CATEGORIES = ["Semua", "AI Text", "Media Downloader", "Utility", "Edukasi", "Religi"];
const MOCK_TOOLS = Array.from({ length: 45 }).map((_, i) => ({
  id: i + 1,
  title: `Tool Serbaguna ${i + 1}`,
  desc: "Deskripsi singkat mengenai alat canggih ini untuk mempermudah tugas Anda.",
  category: CATEGORIES[(i % 5) + 1],
  icon: <Zap size={20} className="text-blue-500" />,
  clicks: Math.floor(Math.random() * 5000),
  isTrending: Math.random() > 0.8
}));

// ==========================================
// 5. KOMPONEN UI: SHARED COMPONENTS
// ==========================================

// Global Top Navbar
const TopNavbar = () => {
  const { user, limit, currentRoute, setCurrentRoute } = useContext(AppContext);
  const isLanding = currentRoute === 'landing';

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50 px-4 md:px-8 flex items-center justify-between">
      <div 
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setCurrentRoute(user ? 'dashboard' : 'landing')}
      >
        <img src={CONFIG.APP_LOGO} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
        <span className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-sky-400">
          {CONFIG.APP_NAME}
        </span>
      </div>

      {!isLanding && user && (
        <div className="flex items-center gap-4">
          {/* Limit Badge Global */}
          <div className="hidden md:flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
            <Zap size={14} className="text-blue-500" />
            <span className="text-sm font-bold text-blue-700">Limit: {limit}</span>
          </div>
          <img 
            src={user.photoURL} 
            alt="Profile" 
            className="w-8 h-8 rounded-full border-2 border-white shadow-sm cursor-pointer"
            onClick={() => setCurrentRoute('account')}
          />
        </div>
      )}
    </nav>
  );
};

// Mobile Bottom Navigation (Mirip Instagram/Aplikasi Native)
const BottomNavbar = () => {
  const { currentRoute, setCurrentRoute } = useContext(AppContext);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 z-50 flex items-center justify-around px-2 md:hidden pb-safe">
      <button 
        onClick={() => setCurrentRoute('dashboard')}
        className={`flex flex-col items-center justify-center w-16 h-full gap-1 ${currentRoute === 'dashboard' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <Home size={22} className={currentRoute === 'dashboard' ? 'fill-blue-100' : ''} />
        <span className="text-[10px] font-medium">Beranda</span>
      </button>
      <button 
        onClick={() => setCurrentRoute('account')}
        className={`flex flex-col items-center justify-center w-16 h-full gap-1 ${currentRoute === 'account' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <User size={22} className={currentRoute === 'account' ? 'fill-blue-100' : ''} />
        <span className="text-[10px] font-medium">Akun</span>
      </button>
    </div>
  );
};

// ==========================================
// 6. HALAMAN: LANDING PAGE
// ==========================================
const LandingPage = () => {
  const { handleGoogleLogin } = useContext(AppContext);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-16">
      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/50 text-blue-700 font-medium text-sm mb-8 border border-blue-200">
          <Sparkles size={16} /> Platform Tools #1 di Indonesia
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-slate-800 leading-tight mb-6">
          Semua yang Anda Butuhkan, <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-sky-400">Dalam Satu Tempat.</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl">
          Dari AI ChatGPT, Download Video, Jadwal Sholat, hingga Perbaiki Foto Blur. 
          Lebih dari 100+ alat ajaib siap mempercepat pekerjaan Anda.
        </p>
        
        <button 
          onClick={handleGoogleLogin}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gray-900 text-white font-bold rounded-2xl overflow-hidden hover:bg-gray-800 transition-all shadow-xl shadow-gray-900/20 hover:scale-105 active:scale-95"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
          Mulai Gratis Sekarang
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Feature Grid Demo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 w-full max-w-4xl opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
          {["AI Assistant", "Video Downloader", "Jadwal Sholat", "HD Image"].map((f, i) => (
             <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2">
               <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                 <LayoutGrid size={20} className="text-blue-500" />
               </div>
               <span className="text-sm font-semibold text-gray-600">{f}</span>
             </div>
          ))}
        </div>
      </main>

      {/* Developer Profile Section */}
      <section className="bg-white py-16 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
          <div className="relative">
             <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20"></div>
             <img src={CONFIG.DEV_PHOTO} alt="Developer" className="relative w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover" />
             <div className="absolute bottom-0 right-0 bg-green-500 w-6 h-6 rounded-full border-4 border-white"></div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Dikembangkan oleh Dodo</h3>
            <p className="text-gray-500 mb-4 max-w-md">
              Seorang Fullstack Engineer yang percaya bahwa teknologi harus mudah diakses oleh siapa saja. BguneTools adalah proyek dedikasi saya untuk komunitas.
            </p>
            <a 
              href={CONFIG.DEV_PORTFOLIO} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:underline"
            >
              <Globe size={18} /> Kunjungi Portofolio Saya
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

// ==========================================
// 7. HALAMAN: DASHBOARD (INTI APLIKASI)
// ==========================================
const Dashboard = () => {
  const { user, limit, usedToday } = useContext(AppContext);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Dapatkan salam berdasarkan waktu
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  // Filter Data
  const filteredTools = useMemo(() => {
    return MOCK_TOOLS.filter(tool => {
      const matchCat = activeCategory === "Semua" || tool.category === activeCategory;
      const matchSearch = tool.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  const trendingTools = useMemo(() => MOCK_TOOLS.filter(t => t.isTrending).slice(0, 4), []);
  const paginatedTools = filteredTools.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredTools.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24 px-4 md:px-8 max-w-7xl mx-auto">
      
      {/* 1. Header & Profil Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">
            {getGreeting()}, <br className="md:hidden" />
            <span className="text-blue-600">{user?.displayName?.split(' ')[0] || 'User'}! 👋</span>
          </h1>
        </div>
      </div>

      {/* 2. AI Viral Section (Gemini Placeholder) */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 mb-8 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="flex items-start gap-4 relative z-10">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <Sparkles className="text-blue-100" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">Inspirasi AI Hari Ini</h3>
            <p className="text-blue-50 text-sm leading-relaxed">
              "Kreativitas adalah kecerdasan yang bersenang-senang." - Coba fitur AI Text kita yang sedang viral hari ini untuk membuat konten sosial media Anda meledak!
            </p>
          </div>
        </div>
      </div>

      {/* 3. Limit & Stats Kolom */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Zap size={18} className="text-yellow-500" />
            <span className="text-sm font-semibold">Sisa Limit</span>
          </div>
          <div className="text-3xl font-black text-gray-800">{limit}<span className="text-lg font-medium text-gray-400">/100</span></div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
            <div className="bg-yellow-400 h-1.5 rounded-full" style={{ width: `${(limit/100)*100}%` }}></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <LayoutGrid size={18} className="text-blue-500" />
            <span className="text-sm font-semibold">Dipakai Hari Ini</span>
          </div>
          <div className="text-3xl font-black text-gray-800">{usedToday} <span className="text-sm font-medium text-gray-400">Fitur</span></div>
          <p className="text-xs text-green-500 font-medium mt-3 flex items-center gap-1">
            <ShieldCheck size={14}/> Anda sangat produktif!
          </p>
        </div>
      </div>

      {/* 4. Search & Categories */}
      <div className="sticky top-16 z-30 bg-gray-50 pt-2 pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Cari fitur... (Cth: Download Youtube, Jadwal Sholat)"
            className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setCurrentPage(1); }}
              className={`whitespace-nowrap px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeCategory === cat 
                ? 'bg-gray-900 text-white shadow-md' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Trending Section */}
      {!searchQuery && activeCategory === "Semua" && (
        <div className="mb-8 mt-2">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Flame className="text-red-500" /> Sedang Tren
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trendingTools.map(tool => (
              <div key={`trend-${tool.id}`} className="bg-gradient-to-br from-white to-red-50/30 p-4 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {tool.icon}
                  </div>
                  <span className="text-[10px] font-bold bg-white border border-gray-100 px-2 py-1 rounded-full text-gray-500 flex items-center gap-1">
                     <Flame size={10} className="text-red-400"/> {tool.clicks}
                  </span>
                </div>
                <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{tool.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">{tool.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Tools Grid Hamparan */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          {searchQuery ? 'Hasil Pencarian' : (activeCategory === "Semua" ? 'Semua Fitur' : `Kategori: ${activeCategory}`)}
        </h2>
        
        {paginatedTools.length === 0 ? (
           <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-500 font-medium">Tidak ada tools yang ditemukan.</p>
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginatedTools.map(tool => (
              <div key={tool.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col h-full">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {tool.icon}
                </div>
                <h3 className="font-bold text-gray-800 text-sm mb-1">{tool.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-grow">{tool.desc}</p>
                
                {/* Tombol Buka Tersembunyi (Muncul saat hover di desktop, tampil di mobile) */}
                <div className="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center">
                   <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{tool.category}</span>
                   <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 7. Pagination (Hemat Tempat) */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50"
            >
               Kembali
            </button>
            <span className="text-sm font-bold text-gray-600 px-4">
              {currentPage} / {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-gray-200 bg-white disabled:opacity-50 hover:bg-gray-50"
            >
               Lanjut
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

// ==========================================
// 8. HALAMAN: AKUN
// ==========================================
const AccountPage = () => {
  const { user, handleLogout, limit } = useContext(AppContext);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24 px-4 max-w-lg mx-auto">
       <h1 className="text-2xl font-black text-gray-800 mb-6">Profil Akun</h1>
       
       <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-blue-400 to-sky-400"></div>
          <img src={user?.photoURL} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white shadow-md relative z-10 mt-6 bg-white object-cover" />
          <h2 className="text-xl font-bold text-gray-800 mt-4">{user?.displayName || 'User'}</h2>
          <p className="text-gray-500 text-sm mb-4">{user?.email || 'email@example.com'}</p>
          
          <div className="w-full bg-blue-50 text-blue-700 py-3 rounded-xl font-bold flex justify-between items-center px-4">
             <span>Sisa Limit Anda</span>
             <span className="text-xl flex items-center gap-1"><Zap size={18}/> {limit}</span>
          </div>
       </div>

       <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 border-b border-gray-50 transition-colors">
            <span className="font-semibold text-gray-700 text-sm">Pengaturan Profil</span>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 border-b border-gray-50 transition-colors">
            <span className="font-semibold text-gray-700 text-sm">Riwayat Penggunaan</span>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition-colors text-red-500 font-bold"
          >
            <LogOut size={18} /> Keluar Akun
          </button>
       </div>
    </div>
  );
};

// ==========================================
// 9. APP ROUTER (STATE MACHINE LOGIC)
// ==========================================
const MainApp = () => {
  const { currentRoute, loadingAuth } = useContext(AppContext);

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <TopNavbar />
      
      {/* Pengganti React Router (Render Conditional) */}
      {currentRoute === 'landing' && <LandingPage />}
      {currentRoute === 'dashboard' && <Dashboard />}
      {currentRoute === 'account' && <AccountPage />}

      {/* Tampilkan Bottom Nav hanya jika bukan di landing page */}
      {currentRoute !== 'landing' && <BottomNavbar />}
    </>
  );
};

// ==========================================
// 10. ROOT ENTRY
// ==========================================
export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        {/* Tambahkan CSS Khusus untuk menyembunyikan scrollbar di menu kategori */}
        <style dangerouslySetInnerHTML={{__html: `
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
        `}} />
        <MainApp />
      </AppProvider>
    </ErrorBoundary>
  );
}