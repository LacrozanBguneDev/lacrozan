import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  arrayUnion, 
  arrayRemove, 
  getDoc, 
  setDoc,
  serverTimestamp,
  increment,
  limit
} from 'firebase/firestore';
import { 
  Home, Search, PlusSquare, Heart, User, Settings, 
  MessageCircle, Share2, MoreHorizontal, Image as ImageIcon, 
  Mic, Video, Send, LogOut, Shield, Terminal, BarChart2, 
  AlertTriangle, CheckCircle, Info, X, ChevronLeft, Sun, Moon
} from 'lucide-react';

// --- KONFIGURASI & KONSTANTA ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png"; // Placeholder logo
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg"; // Placeholder dev
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744";

// --- FIREBASE SETUP ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc", // Placeholder fallback
  authDomain: "eduku-web.firebaseapp.com",
  projectId: "eduku-web",
  storageBucket: "eduku-web.firebasestorage.com",
  messagingSenderId: "662463693471",
  appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
  measurementId: "G-G0VWNHHVB8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- UTILITIES ---

// Kompresi Gambar ke Base64 (Max 500KB untuk performa & hemat storage)
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Quality 0.7
      };
    };
  });
};

// Deteksi Video Embed
const getEmbedUrl = (url) => {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1].split('&')[0]}`;
  // TikTok (Simple workaround, usually requires official SDK, using generic embed approach)
  if (url.includes('tiktok.com')) return null; // TikTok embeds are complex without SDK, skipping for safety
  return null;
};

// Format Text (Bold, Italic, Link)
const formatText = (text) => {
  if (!text) return [];
  // Split by space/newline to handle logic
  const parts = text.split(/(\s+)/);
  
  return parts.map((part, index) => {
    if (part.startsWith('http') || part.startsWith('www')) {
      return <a key={index} href={part.startsWith('www') ? `https://${part}` : part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{part}</a>;
    }
    // Simple mock formatting for *bold* and _italic_
    if (part.startsWith('*') && part.endsWith('*')) return <strong key={index}>{part.slice(1, -1)}</strong>;
    if (part.startsWith('_') && part.endsWith('_')) return <em key={index}>{part.slice(1, -1)}</em>;
    
    return part;
  });
};

// --- MAIN COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [splash, setSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); // home, search, add, notif, profile, dev, legal, post_detail
  const [darkMode, setDarkMode] = useState(false);
  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [viewCount, setViewCount] = useState(0); // Untuk limit user tamu
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Developer Dashboard State
  const [devStats, setDevStats] = useState({ users: 0, posts: 0 });
  const [terminalCmd, setTerminalCmd] = useState('');
  const [terminalOutput, setTerminalOutput] = useState(['BguneNet Terminal v1.0', 'Type "help" for commands']);

  // Auth & Init
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        // Jangan sign in anonymous otomatis agar fitur "Tamu" berjalan
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Ambil/Buat data user di Firestore
        const userRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'data');
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
          setUserData(snap.data());
        } else {
          // User Baru
          const newUserData = {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            bio: "Pengguna baru BguneNet 🇮🇩",
            role: currentUser.email === DEVELOPER_EMAIL ? 'developer' : 'user',
            followers: [],
            following: [],
            createdAt: serverTimestamp(),
            banned: false
          };
          await setDoc(userRef, newUserData);
          setUserData(newUserData);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    // Splash Screen Timer
    setTimeout(() => setSplash(false), 2500);

    return () => unsubscribe();
  }, []);

  // Fetch Posts
  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      const loadedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter Banned Posts/Users (Simple Client Side for UI)
      // Note: In real app, do this in backend/security rules
      setPosts(loadedPosts);
    });
    return () => unsub();
  }, []);

  // Login Handler
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowLoginModal(false);
      setViewCount(0); // Reset limit view
    } catch (error) {
      console.error("Login Error", error);
    }
  };

  // Tamu Navigation Guard
  const handleNavChange = (tab) => {
    if (!user) {
      if (tab !== 'home') {
        setShowLoginModal(true);
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveTab(tab);
  };

  // --- RENDERERS ---

  if (splash) return <SplashScreen />;

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${darkMode ? 'bg-gray-900 text-white' : 'bg-blue-50 text-slate-800'}`}>
      {/* Mobile Frame Container for Desktop View */}
      <div className="mx-auto max-w-md bg-white min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* TOP NAVBAR */}
        <header className={`sticky top-0 z-30 px-4 py-3 flex justify-between items-center backdrop-blur-md bg-opacity-90 ${darkMode ? 'bg-gray-800/90' : 'bg-blue-600/90 text-white'}`}>
          <div className="flex items-center gap-2" onClick={() => handleNavChange('home')}>
             <img src={APP_LOGO} className="w-8 h-8 rounded-full border-2 border-white" alt="logo" />
             <h1 className="font-bold text-lg tracking-tight">BguneNet</h1>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setDarkMode(!darkMode)}>
               {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             {user && (
               <button onClick={() => handleNavChange('notif')}>
                 <Heart size={20} className={notifications.length > 0 ? "fill-red-500 text-red-500" : ""} />
               </button>
             )}
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className={`flex-1 overflow-y-auto pb-20 ${darkMode ? 'bg-gray-900' : 'bg-slate-50'}`}>
          
          {activeTab === 'home' && (
            <HomeFeed 
              posts={posts} 
              user={user} 
              userData={userData}
              viewCount={viewCount} 
              setViewCount={setViewCount}
              setShowLoginModal={setShowLoginModal}
              handleNavChange={handleNavChange}
              darkMode={darkMode}
            />
          )}

          {activeTab === 'search' && <SearchPage posts={posts} handleNavChange={handleNavChange} />}
          
          {activeTab === 'add' && <CreatePost user={user} userData={userData} setActiveTab={setActiveTab} />}
          
          {activeTab === 'profile' && <ProfilePage user={user} userData={userData} isOwnProfile={true} handleLogout={() => signOut(auth)} handleNavChange={handleNavChange} />}
          
          {activeTab === 'dev' && <DeveloperPanel user={user} posts={posts} />}

          {activeTab === 'legal' && <LegalPage handleNavChange={handleNavChange} />}

        </main>

        {/* BOTTOM NAVIGATION */}
        <nav className={`fixed bottom-0 w-full max-w-md border-t flex justify-around items-center py-3 z-40 backdrop-blur-lg ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white/95 border-blue-100 text-blue-400'}`}>
          <NavBtn icon={Home} label="Beranda" active={activeTab === 'home'} onClick={() => handleNavChange('home')} />
          <NavBtn icon={Search} label="Cari" active={activeTab === 'search'} onClick={() => handleNavChange('search')} />
          <div className="relative -top-5">
            <button 
              onClick={() => handleNavChange('add')}
              className="bg-gradient-to-tr from-blue-500 to-cyan-400 text-white p-4 rounded-full shadow-lg hover:shadow-blue-500/50 transition-all transform hover:scale-105 active:scale-95"
            >
              <PlusSquare size={24} />
            </button>
          </div>
          <NavBtn icon={BarChart2} label="Rank" active={activeTab === 'rank'} onClick={() => handleNavChange('legal')} /> 
          <NavBtn 
            icon={userData?.role === 'developer' ? Terminal : User} 
            label={userData?.role === 'developer' ? "Dev" : "Akun"} 
            active={activeTab === 'profile' || activeTab === 'dev'} 
            onClick={() => handleNavChange(userData?.role === 'developer' ? 'dev' : 'profile')} 
          />
        </nav>

        {/* LOGIN MODAL */}
        {showLoginModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-center items-center p-6 animate-fade-in text-white text-center">
            <img src={APP_LOGO} className="w-24 h-24 mb-4 rounded-2xl shadow-2xl" />
            <h2 className="text-3xl font-bold mb-2">Selamat Datang di BguneNet! 🇮🇩</h2>
            <p className="mb-8 opacity-80">Platform sosial media anak bangsa. Login untuk like, komen, dan posting sepuasnya.</p>
            
            <button 
              onClick={handleLogin}
              className="bg-white text-blue-900 w-full py-3 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" />
              Lanjutkan dengan Google
            </button>
            
            <p className="mt-6 text-xs text-gray-400">
              Dengan masuk, Anda menyetujui Ketentuan Layanan & Kebijakan Privasi kami.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

// --- SUB COMPONENTS ---

const NavBtn = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-blue-600 scale-110' : ''} transition-all`}>
    <Icon size={22} className={active ? "fill-blue-100" : ""} />
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

const SplashScreen = () => (
  <div className="fixed inset-0 z-[100] bg-blue-600 flex flex-col items-center justify-center text-white">
    <div className="relative mb-4">
      <div className="absolute inset-0 bg-white rounded-full opacity-20 animate-ping"></div>
      <img src={APP_LOGO} className="w-32 h-32 rounded-full border-4 border-white shadow-2xl relative z-10" />
    </div>
    <h1 className="text-4xl font-black tracking-tighter mb-1">BguneNet</h1>
    <p className="text-blue-200 text-sm font-medium tracking-widest">KARYA ANAK BANGSA</p>
    <div className="absolute bottom-10 text-xs text-blue-200 text-center">
      <p>Created by M. Irham Andika Putra</p>
      <p>SMP Negeri 3 Mentok</p>
    </div>
  </div>
);

const HomeFeed = ({ posts, user, userData, viewCount, setViewCount, setShowLoginModal, handleNavChange, darkMode }) => {
  const [filter, setFilter] = useState('all'); // all, popular, meme, latest
  
  // Random Algorithm Logic (Shuffle on Load)
  const displayPosts = useMemo(() => {
    let filtered = [...posts];
    if (filter === 'meme') filtered = filtered.filter(p => p.tags?.includes('meme'));
    // Randomize slightly to mimic algorithm
    return filtered.sort(() => Math.random() - 0.5);
  }, [posts, filter]);

  return (
    <div className="pb-4">
      {/* Category Tabs */}
      <div className={`flex gap-2 p-4 overflow-x-auto no-scrollbar ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
        {['Untuk Saya', 'Populer', 'Meme', 'Terbaru'].map((f, i) => (
           <button 
             key={i} 
             onClick={() => setFilter(i === 0 ? 'all' : i === 2 ? 'meme' : 'all')}
             className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
               (i === 0 && filter === 'all') || (i === 2 && filter === 'meme') 
               ? 'bg-blue-600 text-white' 
               : `${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`
             }`}
           >
             {f}
           </button>
        ))}
      </div>

      <div className="space-y-4 px-2">
        {displayPosts.map((post, idx) => (
          <PostCard 
            key={post.id} 
            post={post} 
            user={user}
            userData={userData}
            idx={idx}
            viewCount={viewCount}
            setViewCount={setViewCount}
            setShowLoginModal={setShowLoginModal}
            handleNavChange={handleNavChange}
            darkMode={darkMode}
          />
        ))}
        {displayPosts.length === 0 && (
          <div className="text-center py-20 opacity-50">
            <p>Belum ada postingan...</p>
          </div>
        )}
      </div>
    </div>
  );
};

const PostCard = ({ post, user, userData, idx, viewCount, setViewCount, setShowLoginModal, handleNavChange, darkMode }) => {
  const [liked, setLiked] = useState(post.likes?.includes(user?.uid));
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);

  useEffect(() => {
    // Visitor Limit Logic
    if (!user && idx >= 5) {
      // Logic handled in parent rendering usually, but here we can blur content
    }
  }, [idx, user]);

  const handleLike = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    
    // Optimistic Update in Firestore
    const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id);
    if (newLiked) {
      await updateDoc(postRef, { likes: arrayUnion(user.uid) });
    } else {
      await updateDoc(postRef, { likes: arrayRemove(user.uid) });
    }
  };

  const handleShare = () => {
    if(!user) {
      setShowLoginModal(true);
      return;
    }
    // Simulate copying unique link
    const link = `https://app.bgunenet.my.id/post/${post.id}`;
    navigator.clipboard.writeText(link);
    alert('Link tersalin! Bagikan ke temanmu.');
  };

  // Content Locking for guests > 5 posts
  if (!user && idx >= 5) return null; // Or show blur overlay

  return (
    <div className={`rounded-xl overflow-hidden shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-blue-50'}`}>
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={post.authorPhoto || APP_LOGO} className="w-10 h-10 rounded-full object-cover bg-gray-200" />
          <div>
            <h3 className="font-bold text-sm leading-tight">{post.authorName}</h3>
            <p className="text-[10px] opacity-60">
              {post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : 'Baru saja'}
            </p>
          </div>
        </div>
        <button className="opacity-50 hover:opacity-100"><MoreHorizontal size={18} /></button>
      </div>

      {/* Content */}
      <div className="px-3 pb-2">
        {post.title && <h2 className="font-bold text-lg mb-1">{post.title}</h2>}
        <div className={`text-sm mb-2 whitespace-pre-wrap ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {formatText(post.description)}
        </div>
        
        {post.hashtags && (
          <p className="text-blue-500 text-xs mb-2">{post.hashtags.map(t => `#${t} `)}</p>
        )}
      </div>

      {/* Media */}
      {post.image && (
        <img src={post.image} className="w-full h-auto max-h-[500px] object-cover bg-black/5" />
      )}
      
      {post.videoEmbed && (
        <div className="w-full aspect-video bg-black">
          <iframe 
            src={post.videoEmbed} 
            className="w-full h-full" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
          ></iframe>
        </div>
      )}

      {post.audio && (
         <div className="px-3 py-2">
            <audio controls src={post.audio} className="w-full h-10" />
         </div>
      )}

      {/* Actions */}
      <div className={`px-4 py-3 flex items-center justify-between border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className="flex gap-6">
          <button onClick={handleLike} className={`flex items-center gap-1.5 transition-colors ${liked ? 'text-pink-500' : 'opacity-60 hover:opacity-100'}`}>
            <Heart size={22} className={liked ? 'fill-pink-500' : ''} />
            <span className="text-xs font-semibold">{likesCount}</span>
          </button>
          <button className="opacity-60 hover:opacity-100 flex items-center gap-1.5">
            <MessageCircle size={22} />
            <span className="text-xs font-semibold">0</span>
          </button>
          <button onClick={handleShare} className="opacity-60 hover:opacity-100">
            <Share2 size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

const CreatePost = ({ user, userData, setActiveTab }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [image, setImage] = useState(null);
  const [audio, setAudio] = useState(null);
  const [videoLink, setVideoLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (e) => {
    if (e.target.files[0]) {
      const base64 = await compressImage(e.target.files[0]);
      setImage(base64);
    }
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAudio(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!desc && !image && !videoLink) return;

    setLoading(true);
    try {
      const embed = getEmbedUrl(videoLink);
      
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), {
        title,
        description: desc,
        hashtags: tags.split(' ').filter(t => t),
        image,
        audio,
        videoEmbed: embed,
        authorId: user.uid,
        authorName: userData?.displayName || user.displayName,
        authorPhoto: userData?.photoURL || user.photoURL,
        createdAt: serverTimestamp(),
        likes: [],
        type: image ? 'image' : embed ? 'video' : 'text'
      });
      setActiveTab('home');
    } catch (err) {
      alert('Gagal memposting: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 min-h-full bg-white">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setActiveTab('home')}><ChevronLeft /></button>
        <h2 className="font-bold text-xl">Buat Postingan Baru</h2>
      </div>

      <div className="space-y-4">
        <input 
          type="text" 
          placeholder="Judul (Opsional)" 
          className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 ring-blue-500 font-bold"
          value={title} onChange={e => setTitle(e.target.value)}
        />
        
        <textarea 
          placeholder="Apa yang kamu pikirkan? (Gunakan *bold* atau _miring_)" 
          className="w-full h-32 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 ring-blue-500 resize-none"
          value={desc} onChange={e => setDesc(e.target.value)}
        />

        <input 
          type="text" 
          placeholder="#Hastag (pisahkan dengan spasi)" 
          className="w-full p-3 bg-gray-50 rounded-xl border-none text-blue-500"
          value={tags} onChange={e => setTags(e.target.value)}
        />

        {/* Media Inputs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg cursor-pointer whitespace-nowrap">
            <ImageIcon size={18} /> Foto
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
          <label className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg cursor-pointer whitespace-nowrap">
            <Mic size={18} /> Audio
            <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
          </label>
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg flex-1">
            <Video size={18} />
            <input 
              type="text" 
              placeholder="Link YouTube/TikTok" 
              className="bg-transparent text-sm w-full focus:outline-none"
              value={videoLink} onChange={e => setVideoLink(e.target.value)}
            />
          </div>
        </div>

        {/* Previews */}
        {image && (
          <div className="relative">
             <img src={image} className="w-full h-48 object-cover rounded-lg" />
             <button onClick={() => setImage(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><X size={14}/></button>
          </div>
        )}

        <button 
          onClick={handleSubmit} 
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
        >
          {loading ? 'Mengirim...' : <><Send size={18} /> Posting Sekarang</>}
        </button>
      </div>
    </div>
  );
};

const ProfilePage = ({ user, userData, handleLogout, handleNavChange }) => {
  if (!user) return <div className="p-10 text-center"><p>Silakan login dulu.</p></div>;

  return (
    <div>
      {/* Header Profile */}
      <div className="bg-gradient-to-b from-blue-600 to-blue-400 p-6 pb-12 text-white relative">
        <div className="flex justify-end">
          <button onClick={handleLogout} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><LogOut size={18} /></button>
        </div>
        <div className="flex flex-col items-center mt-4">
          <img 
            src={userData?.photoURL || user.photoURL} 
            className="w-24 h-24 rounded-full border-4 border-white shadow-xl bg-white object-cover"
          />
          <h2 className="text-2xl font-bold mt-3">{userData?.displayName}</h2>
          <p className="opacity-80 text-sm max-w-[250px] text-center mt-1">{userData?.bio}</p>
          
          <div className="flex gap-6 mt-6">
            <div className="text-center">
              <span className="block font-bold text-lg">0</span>
              <span className="text-xs opacity-70">Followers</span>
            </div>
            <div className="text-center">
              <span className="block font-bold text-lg">0</span>
              <span className="text-xs opacity-70">Following</span>
            </div>
             <div className="text-center">
              <span className="block font-bold text-lg">0</span>
              <span className="text-xs opacity-70">Posts</span>
            </div>
          </div>
        </div>
        
        {/* Curved Divider */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-slate-50 rounded-t-[30px]"></div>
      </div>

      <div className="px-4 -mt-2">
        <button className="w-full py-2 border border-blue-200 text-blue-600 rounded-full font-semibold text-sm mb-6">Edit Profil</button>
        
        <h3 className="font-bold text-lg mb-4">Postingan Saya</h3>
        <div className="grid grid-cols-3 gap-1">
           {/* Mock Grid for Profile Posts */}
           <div className="aspect-square bg-gray-200 rounded-lg"></div>
           <div className="aspect-square bg-gray-200 rounded-lg"></div>
           <div className="aspect-square bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
};

const SearchPage = ({ posts }) => {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!queryText) {
      setResults([]);
      return;
    }
    // Simple client side search
    const filtered = posts.filter(p => 
      p.description?.toLowerCase().includes(queryText.toLowerCase()) || 
      p.authorName?.toLowerCase().includes(queryText.toLowerCase()) ||
      p.hashtags?.some(h => h.toLowerCase().includes(queryText.toLowerCase()))
    );
    setResults(filtered);
  }, [queryText, posts]);

  return (
    <div className="p-4">
      <div className="bg-gray-100 p-2 rounded-xl flex items-center gap-2 mb-4">
        <Search size={20} className="text-gray-400" />
        <input 
          className="bg-transparent w-full outline-none" 
          placeholder="Cari akun, postingan, atau #tag..." 
          value={queryText}
          onChange={e => setQueryText(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {results.map(post => (
          <div key={post.id} className="flex gap-3 items-center border-b pb-2">
            <img src={post.authorPhoto} className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <p className="font-bold text-sm">{post.authorName}</p>
              <p className="text-xs text-gray-500 truncate">{post.description}</p>
            </div>
          </div>
        ))}
        {queryText && results.length === 0 && <p className="text-center text-gray-400">Tidak ditemukan.</p>}
      </div>
    </div>
  );
};

const DeveloperPanel = ({ user, posts }) => {
  const [cmd, setCmd] = useState('');
  
  if (user?.email !== DEVELOPER_EMAIL) {
    return <div className="p-10 text-center text-red-500">AKSES DITOLAK. Halaman ini hanya untuk Developer (Irham Dika).</div>;
  }

  return (
    <div className="p-4 pb-20 bg-gray-900 min-h-screen text-green-400 font-mono text-sm">
      <div className="flex items-center gap-2 mb-6 border-b border-green-800 pb-2">
        <Terminal size={20} />
        <h2 className="font-bold text-lg">BguneNet_Core_System</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-900/20 border border-green-800 p-4 rounded">
          <p className="text-xs opacity-70">TOTAL POSTS</p>
          <p className="text-2xl font-bold">{posts.length}</p>
        </div>
        <div className="bg-green-900/20 border border-green-800 p-4 rounded">
          <p className="text-xs opacity-70">SYSTEM STATUS</p>
          <p className="text-2xl font-bold text-green-500">ONLINE</p>
        </div>
      </div>

      <div className="bg-black p-4 rounded border border-green-800 h-64 overflow-y-auto mb-4">
        <p>System initialized...</p>
        <p>Connected to Firebase: OK</p>
        <p>Admin: {user.email}</p>
        <p>Log: Monitoring user activity...</p>
      </div>

      <div className="flex gap-2">
        <span className="text-green-600">{">"}</span>
        <input 
          className="bg-transparent w-full outline-none text-white" 
          placeholder="Enter command (ban_user, delete_post)..."
          value={cmd} onChange={e => setCmd(e.target.value)}
        />
      </div>
      
      <div className="mt-8 text-xs text-gray-500">
        <p>Developer Contact: {DEVELOPER_EMAIL}</p>
        <p>App ID: {appId}</p>
      </div>
    </div>
  );
};

const LegalPage = ({ handleNavChange }) => {
  return (
    <div className="p-4 space-y-6 text-sm text-gray-700">
      <button onClick={() => handleNavChange('profile')} className="mb-4"><ChevronLeft /></button>
      <h2 className="text-xl font-bold">Informasi Legal</h2>
      
      <section>
        <h3 className="font-bold flex items-center gap-2"><Shield size={16}/> Kebijakan Privasi</h3>
        <p className="mt-1">Kami mengumpulkan data dasar (nama, foto) via Google Login. Data Anda aman dan tidak diperjualbelikan.</p>
      </section>
      
      <section>
        <h3 className="font-bold flex items-center gap-2"><Info size={16}/> Ketentuan Layanan</h3>
        <p className="mt-1">Dilarang memposting konten SARA, pornografi, atau ilegal. Pelanggaran berakibat Banned permanen.</p>
      </section>

      <section>
        <h3 className="font-bold flex items-center gap-2"><AlertTriangle size={16}/> DMCA / Laporan</h3>
        <p className="mt-1">Laporkan pelanggaran hak cipta ke: {DEVELOPER_EMAIL}</p>
      </section>

      <div className="bg-blue-50 p-4 rounded-xl text-center">
        <p className="font-bold text-blue-800">Dukung BguneNet!</p>
        <a href={WHATSAPP_CHANNEL} target="_blank" className="block mt-2 text-blue-600 underline">Gabung Channel WhatsApp Resmi</a>
        <a href="https://forms.gle/BzWCNSbj4WVh4Q3o9" target="_blank" className="block mt-1 text-blue-600 underline">Lapor Bug</a>
      </div>

      <div className="text-center opacity-50 text-xs mt-10">
        <p>© 2024 BguneNet. Created by M. Irham Andika Putra.</p>
        <p>SMP Negeri 3 Mentok</p>
      </div>
    </div>
  );
}