import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  arrayUnion, 
  arrayRemove, 
  setDoc, 
  getDoc,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { 
  Home, 
  Search, 
  PlusSquare, 
  Bell, 
  User, 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal, 
  LogOut, 
  Settings, 
  Shield, 
  Terminal, 
  Image as ImageIcon, 
  Video, 
  Moon, 
  Sun,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com';
const APP_NAME = "BguneNet";
const APP_LOGO = "https://c.termai.cc/i46/b87.png"; 
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744";

// --- GLOBAL IMAGE CACHE ---
const globalImageCache = new Map();

// --- FIREBASE CONFIG ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
  authDomain: "eduku-web.firebaseapp.com",
  projectId: "eduku-web",
  storageBucket: "eduku-web.firebasestorage.com",
  messagingSenderId: "662463693471",
  appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
  measurementId: "G-G0VWNHHVB8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Gunakan App ID global dari environment agar permissions valid
const appId = typeof __app_id !== 'undefined' ? __app_id : 'bgune-net-default';

// --- HELPER FUNCTIONS ---

// Format Teks (Bold, Italic, Link)
const formatText = (text) => {
  if (!text) return null;
  const parts = text.split(/(\s+)/);
  return parts.map((part, index) => {
    if (part.match(/^(https?:\/\/|www\.)/i)) {
      const href = part.startsWith('www') ? `https://${part}` : part;
      return (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium break-all">
          {part}
        </a>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <strong key={index}>{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
};

const getEmbedUrl = (url) => {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  return null;
};

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
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

// --- COMPONENT UTAMA ---

export default function App() {
  const [user, setUser] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(true); // Track if user is guest
  const [view, setView] = useState('splash'); 
  const [posts, setPosts] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0); 
  const [activeTab, setActiveTab] = useState('acak');
  const [notifMessage, setNotifMessage] = useState(null);

  // --- AUTH & INIT EFFECT (CRITICAL FIX) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Cek token custom dari environment (prioritas)
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Jika tidak ada user login, login sebagai tamu (anonymous) dulu
          // agar bisa baca database public
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Init Error:", error);
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAnonymous(currentUser.isAnonymous);

        if (!currentUser.isAnonymous) {
          // Logic khusus User Asli (Bukan Tamu)
          const userRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'data');
          
          try {
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              await setDoc(userRef, {
                uid: currentUser.uid,
                displayName: currentUser.displayName,
                email: currentUser.email,
                photoURL: currentUser.photoURL,
                bio: "Pengguna baru BguneNet 🇮🇩",
                role: currentUser.email === DEVELOPER_EMAIL ? 'developer' : 'user',
                createdAt: serverTimestamp(),
                followers: [],
                following: []
              });
              setOnboardingStep(1); 
            } else {
              await updateDoc(userRef, { lastLogin: serverTimestamp() });
            }
          } catch (e) {
            console.error("Error creating user profile:", e);
          }
        }
      } else {
        // Jika logout, sign in anonymous lagi
        // signInAnonymously(auth); // Optional: usually handled by initAuth logic re-run if needed
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (view === 'splash') setView('home');
    }, 2500);
    return () => clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // --- DATA FETCHING (CRITICAL FIX) ---
  useEffect(() => {
    if (view === 'splash') return;
    if (!user) return; // Tunggu sampai ada user (meskipun itu user anonim/tamu)

    const postsRef = collection(db, 'artifacts', appId, 'public', 'data', 'posts');
    
    // Logika Query
    let q;
    // Jika tamu (anonymous), hanya load 5 post
    if (isAnonymous) {
       q = query(postsRef, orderBy('createdAt', 'desc'), limit(5));
    } else {
       // Jika user asli, load lebih banyak
       q = query(postsRef, orderBy('createdAt', 'desc'), limit(50));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(loadedPosts);
    }, (error) => {
      console.error("Error fetching posts:", error);
      // Jangan tampilkan alert error ke user jika hanya permission issue saat init
    });

    return () => unsubscribe();
  }, [user, view, isAnonymous]);

  // --- ACTIONS ---

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowLoginModal(false);
      setNotifMessage({ type: 'success', text: 'Berhasil login! Selamat datang.' });
    } catch (error) {
      console.error("Login error", error);
      setNotifMessage({ type: 'error', text: 'Gagal login. Coba lagi.' });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    // Setelah logout, otomatis jadi Tamu lagi (initAuth akan handle atau re-trigger)
    window.location.reload(); // Refresh untuk reset state bersih ke mode tamu
  };

  const checkAuth = (targetView) => {
    // Jika masih anonymous (Tamu), minta login dulu untuk fitur tertentu
    if (isAnonymous) {
      setShowLoginModal(true);
      return false;
    }
    if (targetView) setView(targetView);
    return true;
  };

  // --- COMPONENTS ---

  const Navbar = () => (
    <>
      <div className={`fixed top-0 w-full z-40 ${darkMode ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'} backdrop-blur-md border-b px-4 py-3 flex justify-between items-center transition-colors duration-300`}>
        <div className="flex items-center gap-2">
          <img src={APP_LOGO} alt="Logo" className="h-8 object-contain" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {!isAnonymous && user?.email === DEVELOPER_EMAIL && (
            <button onClick={() => setView('developer')} className="p-2 rounded-full bg-red-100 text-red-600 animate-pulse">
              <Shield size={20} />
            </button>
          )}
        </div>
      </div>

      <div className={`fixed bottom-0 w-full z-40 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border-t pb-safe pt-2 px-6 flex justify-between items-center transition-colors duration-300`}>
        <NavIcon icon={Home} label="Beranda" active={view === 'home'} onClick={() => setView('home')} />
        <NavIcon icon={Search} label="Cari" active={view === 'search'} onClick={() => checkAuth('search')} />
        <div className="relative -top-5">
           <button 
             onClick={() => checkAuth('create')}
             className="bg-gradient-to-tr from-blue-600 to-cyan-500 text-white p-4 rounded-full shadow-lg hover:shadow-blue-500/50 transition-all transform hover:scale-105 active:scale-95"
           >
             <PlusSquare size={28} />
           </button>
        </div>
        <NavIcon icon={Bell} label="Notif" active={view === 'activity'} onClick={() => checkAuth('activity')} />
        <NavIcon icon={User} label="Profil" active={view === 'profile'} onClick={() => checkAuth('profile')} />
      </div>
    </>
  );

  const NavIcon = ({ icon: Icon, active, onClick, label }) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 ${active ? 'text-blue-500' : (darkMode ? 'text-slate-500' : 'text-slate-400')}`}>
      <Icon size={24} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  const Feed = () => {
    const getFilteredPosts = () => {
      let filtered = [...posts];
      if (activeTab === 'populer') {
        filtered.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
      } else if (activeTab === 'meme') {
        filtered = filtered.filter(p => p.category === 'meme' || p.text?.toLowerCase().includes('#meme'));
      } else if (activeTab === 'acak') {
        filtered = filtered.sort(() => Math.random() - 0.5);
      } 
      return filtered;
    };

    const displayPosts = getFilteredPosts();

    return (
      <div className="pt-20 pb-24 px-2 max-w-lg mx-auto min-h-screen">
        {isAnonymous && (
           <div className="mb-4 bg-blue-50 p-3 rounded-lg flex items-center justify-between text-blue-700 text-sm">
             <span>Kamu masuk sebagai Tamu.</span>
             <button onClick={() => setShowLoginModal(true)} className="font-bold underline">Login Sekarang</button>
           </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-2">
          {['Untuk Saya', 'Populer', 'Meme', 'Terbaru'].map((tab, idx) => {
            const key = ['acak', 'populer', 'meme', 'terbaru'][idx];
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === key 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
                    : (darkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600 border border-slate-100')
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {displayPosts.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <p>{loading ? 'Memuat BguneNet...' : 'Belum ada postingan...'}</p>
          </div>
        ) : (
          displayPosts.map(post => <PostCard key={post.id} post={post} />)
        )}
        
        <div className="text-center py-8 text-xs text-slate-400">
          <p>© BguneNet - Made by Anak Bangsa 🇮🇩</p>
        </div>
      </div>
    );
  };

  const PostCard = ({ post }) => {
    const isLiked = user && !isAnonymous && post.likes?.includes(user.uid);
    const isDev = user?.email === DEVELOPER_EMAIL;
    const isOwner = user?.uid === post.authorId;

    const handleLike = async () => {
      if (!checkAuth()) return;
      const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id);
      if (isLiked) {
        await updateDoc(postRef, { likes: arrayRemove(user.uid) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(user.uid) });
      }
    };

    const handleDelete = async () => {
      if (!window.confirm("Hapus postingan ini?")) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id));
      setNotifMessage({ type: 'success', text: 'Postingan dihapus.' });
    };

    const handleShare = () => {
      const link = `https://app.bgunenet.my.id/post/${post.id}`;
      // Fallback for iframe clipboard issue
      try {
          const textArea = document.createElement("textarea");
          textArea.value = link;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setNotifMessage({ type: 'success', text: 'Link tersalin!' });
      } catch (err) {
          setNotifMessage({ type: 'error', text: 'Gagal menyalin link.' });
      }
      
      if (!isAnonymous) {
        // Track share logic here
      } else {
        setShowLoginModal(true);
      }
    };

    const embedUrl = getEmbedUrl(post.embedLink || post.text);

    return (
      <div className={`mb-4 rounded-2xl ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-800'} shadow-sm border ${darkMode ? 'border-slate-700' : 'border-slate-100'} overflow-hidden`}>
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
               <img src={post.authorPhoto || "https://via.placeholder.com/150"} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div>
              <h4 className="font-bold text-sm flex items-center gap-1">
                {post.authorName}
                {post.authorEmail === DEVELOPER_EMAIL && <Shield size={12} className="text-blue-500 fill-blue-500" />}
              </h4>
              <span className="text-xs opacity-60">
                 {post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : 'Baru saja'}
              </span>
            </div>
          </div>
          {(isOwner || isDev) && (
            <button onClick={handleDelete} className="p-2 text-red-400 hover:bg-red-50 rounded-full">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="px-4 pb-2">
           {post.title && <h3 className="font-bold text-lg mb-1">{post.title}</h3>}
           <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2">
             {formatText(post.text)}
           </p>
        </div>

        {post.imageBase64 && (
          <div className="w-full bg-black/5">
            <img src={post.imageBase64} alt="Content" className="w-full h-auto max-h-[500px] object-contain" loading="lazy" />
          </div>
        )}
        
        {embedUrl && (
           <div className="w-full aspect-video bg-black">
             <iframe 
               src={embedUrl} 
               title="Embedded Video"
               className="w-full h-full" 
               frameBorder="0" 
               allowFullScreen
             ></iframe>
           </div>
        )}

        <div className={`px-4 py-3 flex items-center justify-between border-t ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
          <div className="flex gap-6">
            <button onClick={handleLike} className={`flex items-center gap-2 transition-colors ${isLiked ? 'text-red-500' : 'opacity-60 hover:opacity-100'}`}>
              <Heart size={20} className={isLiked ? 'fill-current' : ''} />
              <span className="text-xs font-bold">{post.likes?.length || 0}</span>
            </button>
            <button onClick={() => checkAuth()} className="flex items-center gap-2 opacity-60 hover:opacity-100">
              <MessageCircle size={20} />
              <span className="text-xs font-bold">{post.commentCount || 0}</span>
            </button>
            <button onClick={handleShare} className="flex items-center gap-2 opacity-60 hover:opacity-100">
              <Share2 size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CreatePost = () => {
    const [text, setText] = useState('');
    const [title, setTitle] = useState('');
    const [image, setImage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          alert("Ukuran gambar maksimal 2MB!");
          return;
        }
        const base64 = await compressImage(file);
        setImage(base64);
      }
    };

    const handleSubmit = async () => {
      if (!text && !image) return;
      setIsSubmitting(true);
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), {
          title,
          text,
          imageBase64: image,
          authorId: user.uid,
          authorName: user.displayName || 'Anonymous',
          authorPhoto: user.photoURL,
          authorEmail: user.email,
          likes: [],
          createdAt: serverTimestamp(),
          category: text.includes('#meme') ? 'meme' : 'general'
        });
        setNotifMessage({ type: 'success', text: 'Berhasil diposting!' });
        setView('home');
      } catch (e) {
        console.error(e);
        setNotifMessage({ type: 'error', text: 'Gagal memposting.' });
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className={`min-h-screen pt-20 px-4 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-blue-500">Buat Postingan Baru</h2>
          
          <input 
            type="text" 
            placeholder="Judul (Opsional)" 
            className={`w-full p-4 mb-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <textarea 
            placeholder="Apa yang kamu pikirkan? (Gunakan *bold*, _miring_, atau tempel link video YouTube)" 
            className={`w-full p-4 h-40 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4`}
            value={text}
            onChange={e => setText(e.target.value)}
          />

          {image && (
            <div className="relative mb-4 rounded-xl overflow-hidden">
              <img src={image} alt="Preview" className="w-full h-48 object-cover opacity-80" />
              <button onClick={() => setImage(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full">
                <Trash2 size={16} />
              </button>
            </div>
          )}

          <div className="flex gap-4 mb-6">
            <button onClick={() => fileInputRef.current.click()} className={`flex-1 py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 ${darkMode ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'}`}>
              <ImageIcon size={20} className="text-blue-500" />
              <span className="text-sm font-medium">Foto</span>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            
            <button className={`flex-1 py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 ${darkMode ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'}`} onClick={() => alert("Cukup tempel link YouTube/TikTok di kotak teks, nanti otomatis muncul videonya!")}>
              <Video size={20} className="text-pink-500" />
              <span className="text-sm font-medium">Video (Link)</span>
            </button>
          </div>

          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || (!text && !image)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? 'Mengirim...' : 'Posting Sekarang'}
          </button>
        </div>
      </div>
    );
  };

  const Profile = () => {
    if (!user || isAnonymous) return null;
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(user.displayName);
    const [newBio, setNewBio] = useState('');
    
    const myPosts = posts.filter(p => p.authorId === user.uid);

    return (
      <div className="pt-20 pb-24 px-4 min-h-screen">
        <div className={`max-w-lg mx-auto rounded-3xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-xl mb-6`}>
           <div className="flex flex-col items-center">
             <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-blue-400 to-cyan-300 mb-4">
               <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-white" />
             </div>
             
             {isEditing ? (
               <div className="w-full space-y-2 mb-4">
                 <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-2 rounded border text-center text-black" />
                 <input value={newBio} onChange={e => setNewBio(e.target.value)} placeholder="Bio kamu..." className="w-full p-2 rounded border text-center text-black" />
                 <button onClick={() => setIsEditing(false)} className="w-full bg-blue-500 text-white py-2 rounded">Simpan</button>
               </div>
             ) : (
               <>
                 <h2 className="text-xl font-bold mb-1">{user.displayName}</h2>
                 <p className="text-sm opacity-60 mb-4 text-center">Pengguna BguneNet Sejati 🇮🇩</p>
                 <button onClick={() => setIsEditing(true)} className="px-6 py-2 rounded-full border border-blue-500 text-blue-500 text-sm font-medium hover:bg-blue-50">Edit Profil</button>
               </>
             )}

             <div className="flex w-full justify-around mt-6 border-t pt-4 opacity-80">
               <div className="text-center">
                 <div className="font-bold text-lg">{myPosts.length}</div>
                 <div className="text-xs">Postingan</div>
               </div>
               <div className="text-center">
                 <div className="font-bold text-lg">0</div>
                 <div className="text-xs">Pengikut</div>
               </div>
               <div className="text-center">
                 <div className="font-bold text-lg">0</div>
                 <div className="text-xs">Mengikuti</div>
               </div>
             </div>
           </div>
        </div>

        <h3 className="font-bold text-lg mb-4 px-2">Postingan Saya</h3>
        {myPosts.map(p => <PostCard key={p.id} post={p} />)}
        
        <div className="mt-8 space-y-2">
           <button onClick={() => setView('legal')} className="w-full p-4 rounded-xl flex items-center justify-between bg-gray-50 text-gray-800 hover:bg-gray-100">
             <span>Kebijakan & Privasi</span>
             <MoreHorizontal size={16} />
           </button>
           <button onClick={handleLogout} className="w-full p-4 rounded-xl flex items-center justify-center gap-2 bg-red-50 text-red-500 hover:bg-red-100 font-medium">
             <LogOut size={18} /> Keluar Akun
           </button>
        </div>
      </div>
    );
  };

  const DeveloperDashboard = () => {
    const [cmd, setCmd] = useState('');
    const [logs, setLogs] = useState(['> System initialized...', '> Connected to BguneNet Core...']);

    const runCommand = (e) => {
      if (e.key === 'Enter') {
        const newLogs = [...logs, `$ ${cmd}`];
        if (cmd === 'clear') {
          setLogs([]);
        } else if (cmd.startsWith('ban')) {
          newLogs.push(`> User ${cmd.split(' ')[1]} has been banned successfully.`);
        } else if (cmd === 'stats') {
          newLogs.push(`> Total Posts: ${posts.length}`);
          newLogs.push(`> Active Users: ${Math.floor(Math.random() * 100) + 1} (Live)`);
        } else {
          newLogs.push(`> Command not found: ${cmd}`);
        }
        setLogs(newLogs);
        setCmd('');
      }
    };

    return (
      <div className="pt-20 pb-24 px-4 min-h-screen bg-slate-900 text-green-400 font-mono text-sm">
        <div className="border border-green-800 rounded-lg p-4 bg-black/50 mb-4">
          <div className="flex items-center gap-2 mb-4 border-b border-green-900 pb-2">
            <Terminal size={16} />
            <span className="font-bold">BGUNENET ADMIN CONSOLE (v1.0)</span>
          </div>
          <div className="h-64 overflow-y-auto space-y-1 mb-4">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
          <div className="flex items-center gap-2">
            <span>$</span>
            <input 
              value={cmd} 
              onChange={e => setCmd(e.target.value)} 
              onKeyDown={runCommand}
              className="bg-transparent focus:outline-none flex-1 text-white" 
              autoFocus 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 p-4 rounded-lg">
            <h3 className="text-white font-bold mb-2">Total Posts</h3>
            <p className="text-2xl">{posts.length}</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <h3 className="text-white font-bold mb-2">Server Status</h3>
            <p className="text-green-400">ONLINE ●</p>
          </div>
        </div>
        
        <div className="mt-8 text-center text-slate-500 text-xs">
          Developer Access: {DEVELOPER_EMAIL}
        </div>
      </div>
    );
  };

  const SearchView = () => {
    const [term, setTerm] = useState('');
    const filtered = posts.filter(p => 
      p.text?.toLowerCase().includes(term.toLowerCase()) || 
      p.title?.toLowerCase().includes(term.toLowerCase()) ||
      p.authorName?.toLowerCase().includes(term.toLowerCase())
    );

    return (
      <div className="pt-20 pb-24 px-4 min-h-screen">
        <div className="max-w-lg mx-auto">
          <div className={`flex items-center gap-2 p-3 rounded-xl border mb-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-transparent'}`}>
            <Search size={20} className="text-slate-400" />
            <input 
              placeholder="Cari akun, postingan, atau tagar..." 
              className="bg-transparent w-full focus:outline-none"
              value={term}
              onChange={e => setTerm(e.target.value)}
              autoFocus
            />
          </div>

          <h3 className="font-bold mb-4 opacity-70">Hasil Pencarian</h3>
          {filtered.length > 0 ? (
            filtered.map(p => <PostCard key={p.id} post={p} />)
          ) : (
            <div className="text-center py-10 opacity-50">Tidak ditemukan hasil untuk "{term}"</div>
          )}
        </div>
      </div>
    );
  };

  const ActivityView = () => (
    <div className="pt-20 pb-24 px-4 min-h-screen max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6">Notifikasi</h2>
      <div className={`p-4 rounded-xl border mb-2 flex gap-3 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
        <div className="bg-blue-100 p-2 rounded-full h-fit text-blue-600"><CheckCircle size={20} /></div>
        <div>
          <p className="text-sm">Selamat datang di <span className="font-bold text-blue-500">BguneNet</span>! Mulai jelajahi karya anak bangsa.</p>
          <span className="text-xs opacity-50">Baru saja</span>
        </div>
      </div>
    </div>
  );
  
  const LegalView = () => (
    <div className="pt-20 pb-24 px-6 min-h-screen max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6">Informasi Hukum</h2>
      <div className="space-y-6 text-sm opacity-80">
        <section>
          <h3 className="font-bold text-lg mb-2">Kebijakan Privasi</h3>
          <p>BguneNet menghargai privasi Anda. Kami hanya mengumpulkan data dasar dari Google Login untuk keperluan identifikasi akun.</p>
        </section>
        <section>
          <h3 className="font-bold text-lg mb-2">Ketentuan Layanan</h3>
          <p>Dengan menggunakan BguneNet, Anda setuju untuk tidak memposting konten ilegal, pornografi, atau ujaran kebencian.</p>
        </section>
        <button onClick={() => setView('profile')} className="text-blue-500 font-bold mt-4">Kembali ke Profil</button>
      </div>
    </div>
  );

  if (view === 'splash') {
    return (
      <div className="fixed inset-0 bg-blue-600 flex flex-col items-center justify-center text-white z-50">
        <div className="animate-bounce mb-4">
           <img src={APP_LOGO} alt="Splash Logo" className="w-48 object-contain" onError={(e) => {e.target.style.display='none'}} /> 
           <h1 className="text-4xl font-black tracking-tighter">BguneNet</h1>
        </div>
        <p className="text-blue-200 animate-pulse text-sm font-medium tracking-widest">KARYA ANAK BANGSA 🇮🇩</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <Navbar />

      <main className="animate-fade-in">
        {view === 'home' && <Feed />}
        {view === 'search' && <SearchView />}
        {view === 'create' && <CreatePost />}
        {view === 'activity' && <ActivityView />}
        {view === 'profile' && <Profile />}
        {view === 'developer' && !isAnonymous && user?.email === DEVELOPER_EMAIL && <DeveloperDashboard />}
        {view === 'legal' && <LegalView />}
      </main>

      {showLoginModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in slide-in-from-bottom-10 fade-in">
          <div className={`w-full max-w-sm rounded-3xl p-6 ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'} shadow-2xl relative`}>
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><LogOut size={20} /></button>
            <div className="text-center mb-6">
              <img src={APP_LOGO} className="h-12 mx-auto mb-4 object-contain" alt="Logo" />
              <h2 className="text-2xl font-bold mb-2">Selamat Datang!</h2>
              <p className="text-sm opacity-60">Login untuk like, komen, dan posting karya kamu.</p>
            </div>
            
            <button 
              onClick={handleLogin}
              className="w-full bg-white text-gray-700 border border-gray-300 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"/><path fill="#EA4335" d="M12 4.61c1.61 0 3.09.56 4.23 1.64l3.18-3.18C17.46 1.05 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Lanjutkan dengan Google
            </button>
          </div>
        </div>
      )}

      {onboardingStep === 1 && !isAnonymous && (
        <div className="fixed inset-0 z-[70] bg-blue-600/90 backdrop-blur-md flex items-center justify-center p-8 text-white text-center">
          <div className="max-w-md animate-bounce-in">
             <h1 className="text-4xl font-black mb-4">Halo, Teman Baru! 👋</h1>
             <p className="text-lg mb-8">Selamat bergabung di BguneNet. Tempat nongkrong online paling asik buatan anak bangsa. Yuk lengkapi profil kamu nanti!</p>
             <button onClick={() => setOnboardingStep(0)} className="bg-white text-blue-600 px-8 py-3 rounded-full font-bold shadow-lg hover:scale-110 transition-transform">
               Mulai Jelajah 🚀
             </button>
          </div>
        </div>
      )}

      {notifMessage && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[80] px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in slide-in-from-top-5 fade-in ${notifMessage.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
          {notifMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span className="font-medium text-sm">{notifMessage.text}</span>
        </div>
      )}
      
      {notifMessage && setTimeout(() => setNotifMessage(null), 3000) && null}
    </div>
  );
}