import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  signInWithPopup // Fallback if redirect is blocked by iframe
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
  serverTimestamp,
  getDocs,
  where,
  limit,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { 
  Home, Search, User, Bell, PlusSquare, 
  Heart, MessageCircle, Share2, LogOut, 
  Settings, Shield, Trash2, Terminal, 
  BarChart2, Mic, Image as ImageIcon, Youtube,
  Play, Pause, Award, Info, AlertTriangle
} from 'lucide-react';

// --- KONFIGURASI GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com';
const APP_NAME = "BguneNet";
const APP_VERSION = "1.0.0 Alpha";
const APP_LOGO = "https://c.termai.cc/i46/b87.png"; // Placeholder logo
const DEV_PHOTO = "https://c.termai.cc/i6/EAb.jpg";

// Firebase Config
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- UTILITIES ---

// Format Waktu
const formatTimeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - date.toDate()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " tahun lalu";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " bulan lalu";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " hari lalu";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " jam lalu";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " menit lalu";
  return Math.floor(seconds) + " detik lalu";
};

// Deteksi Link & Format Teks
const processText = (text) => {
  if (!text) return null;
  
  // 1. Split by newlines first
  return text.split('\n').map((line, i) => (
    <span key={i} className="block mb-1">
      {line.split(' ').map((word, j) => {
        // URL Detection
        if (word.match(/^(https?:\/\/|www\.)/i)) {
          const href = word.startsWith('www.') ? `https://${word}` : word;
          return <a key={j} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all mr-1">{word}</a>;
        }
        // Bold (*text*)
        if (word.startsWith('*') && word.endsWith('*') && word.length > 2) {
          return <strong key={j} className="mr-1">{word.slice(1, -1)}</strong>;
        }
        // Italic (_text_)
        if (word.startsWith('_') && word.endsWith('_') && word.length > 2) {
          return <em key={j} className="mr-1">{word.slice(1, -1)}</em>;
        }
        // Hashtag (#tag)
        if (word.startsWith('#')) {
          return <span key={j} className="text-blue-400 font-bold mr-1">{word}</span>;
        }
        return <span key={j} className="mr-1">{word}</span>;
      })}
    </span>
  ));
};

// YouTube Parser
const getYoutubeEmbed = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Kompres Gambar (Agar Base64 tidak terlalu besar untuk Firestore)
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
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
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Kompres ke 70% quality
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// --- KOMPONEN APLIKASI ---

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('splash'); // splash, home, search, profile, notif, dev, legal, detail
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Data State
  const [posts, setPosts] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  
  // Developer
  const isDev = user?.email === DEVELOPER_EMAIL;

  // Efek Login & Auth Redirect
  useEffect(() => {
    const handleAuth = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          // Update data user di Firestore saat login sukses
          await setDoc(doc(db, 'artifacts', appId, 'users', result.user.uid, 'profile', 'data'), {
            uid: result.user.uid,
            displayName: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL,
            bio: "Pengguna baru di BguneNet",
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            role: result.user.email === DEVELOPER_EMAIL ? 'developer' : 'user',
            followers: [],
            following: []
          }, { merge: true });
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };

    handleAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Splash screen logic
      setTimeout(() => {
        setCurrentPage('home');
        setLoading(false);
      }, 2500);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Semua Postingan Realtime
  useEffect(() => {
    // PUBLIC DATA PATH
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'posts'), 
      orderBy('createdAt', 'desc'),
      limit(50) // Limit biar tidak berat
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(loadedPosts);
    }, (error) => {
      console.error("Error fetching posts:", error);
    });

    return () => unsubscribe();
  }, []);

  // Scroll to top saat ganti halaman
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  // --- ACTIONS ---

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Redirect gagal, mencoba popup...", error);
      // Fallback ke popup jika di environment iframe tertentu redirect diblokir
      await signInWithPopup(auth, provider);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setCurrentPage('home');
  };

  const handleNavigation = (page) => {
    if (!user && page !== 'home' && page !== 'legal') {
      setShowOnboarding(true);
      return;
    }
    setCurrentPage(page);
  };

  // --- RENDERERS ---

  if (loading || currentPage === 'splash') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-cyan-400 text-white">
        <div className="animate-bounce mb-4">
          <img src={APP_LOGO} alt="Logo" className="w-24 h-24 rounded-full shadow-lg border-4 border-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-widest mb-2">{APP_NAME}</h1>
        <p className="text-sm opacity-80 animate-pulse">Karya Anak Bangsa 🇮🇩</p>
        <p className="absolute bottom-10 text-xs">By M. Irham Andika Putra</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} transition-colors duration-300 pb-20 md:pb-0`}>
      
      {/* --- NAVBAR ATAS --- */}
      <div className={`sticky top-0 z-50 shadow-sm ${darkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white/90 backdrop-blur-md'} px-4 py-3 flex justify-between items-center`}>
        <div className="flex items-center space-x-2" onClick={() => handleNavigation('home')}>
          <img src={APP_LOGO} className="w-8 h-8 rounded-full" />
          <span className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
            {APP_NAME}
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
           <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
             {darkMode ? "☀️" : "🌙"}
           </button>
           {user ? (
             <img 
              src={user.photoURL} 
              className="w-8 h-8 rounded-full border border-gray-300 cursor-pointer" 
              onClick={() => setCurrentPage('profile')}
            />
           ) : (
             <button 
              onClick={() => setShowOnboarding(true)}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-blue-700 transition"
            >
              Masuk
             </button>
           )}
        </div>
      </div>

      {/* --- KONTEN UTAMA --- */}
      <main className="max-w-2xl mx-auto min-h-screen pt-4">
        
        {currentPage === 'home' && (
          <Feed 
            user={user} 
            posts={posts} 
            isDev={isDev} 
            setShowOnboarding={setShowOnboarding}
          />
        )}

        {currentPage === 'search' && <SearchPage user={user} posts={posts} />}
        
        {currentPage === 'create' && <CreatePost user={user} onPost={() => setCurrentPage('home')} />}
        
        {currentPage === 'profile' && <Profile user={user} posts={posts} isDev={isDev} onLogout={handleLogout} />}
        
        {currentPage === 'dev' && isDev && <DeveloperPanel user={user} posts={posts} />}
        
        {currentPage === 'notif' && <NotificationPage />}

        {currentPage === 'legal' && <LegalPage goBack={() => setCurrentPage('profile')} />}

      </main>

      {/* --- NAVBAR BAWAH (MOBILE) --- */}
      <nav className={`fixed bottom-0 left-0 right-0 ${darkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'} flex justify-around p-3 z-50 md:max-w-2xl md:mx-auto md:relative md:border-t-0 md:bg-transparent md:mb-10 rounded-t-2xl`}>
        <NavBtn icon={<Home size={24} />} active={currentPage === 'home'} onClick={() => handleNavigation('home')} label="Beranda" />
        <NavBtn icon={<Search size={24} />} active={currentPage === 'search'} onClick={() => handleNavigation('search')} label="Cari" />
        <div className="-mt-8">
          <button 
            onClick={() => handleNavigation('create')}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4 rounded-full shadow-lg text-white transform transition hover:scale-110 active:scale-95"
          >
            <PlusSquare size={28} />
          </button>
        </div>
        {/* Fitur Ranking / Leaderboard */}
        <NavBtn icon={<Award size={24} />} active={currentPage === 'ranking'} onClick={() => alert("Fitur Leaderboard segera hadir di update v1.1!")} label="Rank" />
        <NavBtn icon={<User size={24} />} active={currentPage === 'profile'} onClick={() => handleNavigation('profile')} label="Akun" />
      </nav>

      {/* --- MODAL ONBOARDING (RESTRIKSI) --- */}
      {showOnboarding && !user && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl transform transition-all scale-100">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="text-blue-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2 dark:text-white">Selamat Datang!</h2>
            <p className="text-gray-500 mb-6 dark:text-gray-300">
              Kamu harus login untuk melihat lebih banyak, memposting, dan berinteraksi di <span className="font-bold text-blue-500">BguneNet</span>.
            </p>
            <button 
              onClick={handleLogin}
              className="w-full py-3 bg-white border border-gray-300 rounded-xl flex items-center justify-center space-x-2 hover:bg-gray-50 transition mb-3"
            >
              <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5" />
              <span className="font-medium text-gray-700">Lanjutkan dengan Google</span>
            </button>
            <button 
              onClick={() => setShowOnboarding(false)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Kembali (Mode Terbatas)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// --- SUB-KOMPONEN ---

function NavBtn({ icon, active, onClick, label }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center space-y-1 ${active ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function Feed({ user, posts, isDev, setShowOnboarding }) {
  const [filter, setFilter] = useState('Terbaru'); // Terbaru, Populer, Meme, Untuk Saya
  
  // Logika Filter & Sorting
  const filteredPosts = useMemo(() => {
    let result = [...posts];
    
    // Algoritma Acak (Simpel Shuffle setiap render) jika default
    if (filter === 'Untuk Saya') {
       result = result.sort(() => Math.random() - 0.5);
    } else if (filter === 'Populer') {
       result = result.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
    } else if (filter === 'Meme') {
       result = result.filter(p => p.hashtags?.includes('#meme') || p.description?.toLowerCase().includes('meme'));
    }
    // 'Terbaru' is default (already sorted by createdAt desc from Firestore)

    // Restriksi Guest: Cuma 5 post
    if (!user) {
      return result.slice(0, 5);
    }
    return result;
  }, [posts, filter, user]);

  return (
    <div className="pb-20 px-2">
      {/* Kategori Filter */}
      <div className="flex space-x-2 overflow-x-auto pb-4 scrollbar-hide">
        {['Untuk Saya', 'Populer', 'Meme', 'Terbaru'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === cat 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Daftar Post */}
      <div className="space-y-4">
        {filteredPosts.map(post => (
          <PostCard 
            key={post.id} 
            post={post} 
            user={user} 
            isDev={isDev}
            triggerAuth={() => setShowOnboarding(true)}
          />
        ))}
        {filteredPosts.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p>Belum ada postingan di kategori ini.</p>
          </div>
        )}
        
        {/* Pesan Kunci Guest */}
        {!user && filteredPosts.length > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-gray-800 rounded-xl text-center border border-blue-100 mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Login untuk melihat postingan lainnya tanpa batas!</p>
            <button onClick={() => setShowOnboarding(true)} className="text-blue-600 font-bold text-sm">Masuk Sekarang</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, user, isDev, triggerAuth }) {
  const [liked, setLiked] = useState(post.likes?.includes(user?.uid) || false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  const handleLike = async () => {
    if (!user) return triggerAuth();
    
    const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id);
    const newLikedState = !liked;
    setLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);

    try {
      if (newLikedState) {
        await updateDoc(postRef, { likes: arrayUnion(user.uid) });
      } else {
        await updateDoc(postRef, { likes: arrayRemove(user.uid) });
      }
    } catch (err) {
      console.error("Like error", err);
      // Revert if error
      setLiked(!newLikedState); 
    }
  };

  const handleShare = () => {
    const link = `${window.location.origin}?post=${post.id}`;
    navigator.clipboard.writeText(link);
    alert("Link tersalin! Bagikan ke temanmu.");
  };

  const handleDelete = async () => {
    if (!confirm("Hapus postingan ini secara permanen?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id));
      alert("Postingan dihapus.");
    } catch (e) {
      alert("Gagal menghapus.");
    }
  };

  const fetchComments = async () => {
    if (!showComments) {
       // Load comments (Mocking real-time subcollection would be better but keeping simple array for OneFile constraint if complex, 
       // but here we used subcollection logic? Actually lets fetch from a separate collection filtered by postId for better scalability)
       // For this task, assuming comments are in a separate collection for simplicity or inside the doc. 
       // LET'S USE A SUBCOLLECTION PATTERN SIMULATION by querying a root collection 'comments'
       
       const q = query(
         collection(db, 'artifacts', appId, 'public', 'data', 'comments'),
         where('postId', '==', post.id),
         orderBy('createdAt', 'desc'),
         limit(20)
       );
       const snap = await getDocs(q);
       setComments(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }
    setShowComments(!showComments);
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!user) return triggerAuth();
    if (!newComment.trim()) return;

    const commentData = {
      postId: post.id,
      userId: user.uid,
      userName: user.displayName,
      userPhoto: user.photoURL,
      text: newComment,
      createdAt: serverTimestamp()
    };

    // Optimistic UI
    setComments([commentData, ...comments]);
    setNewComment("");

    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'comments'), commentData);
    
    // Update comment count on post (optional for display)
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src={post.userPhoto || APP_LOGO} className="w-10 h-10 rounded-full bg-gray-200 object-cover" />
          <div>
            <h3 className="font-bold text-sm dark:text-white">{post.userName}</h3>
            <p className="text-xs text-gray-500">{formatTimeAgo(post.createdAt)}</p>
          </div>
        </div>
        {(user?.uid === post.userId || isDev) && (
          <button onClick={handleDelete} className="text-red-400 hover:text-red-600">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-2">
        {post.title && <h2 className="font-bold text-lg mb-1 dark:text-white">{post.title}</h2>}
        <div className="text-sm text-gray-800 dark:text-gray-200 mb-2 whitespace-pre-wrap">
          {processText(post.description)}
        </div>
        {post.hashtags && (
          <div className="text-blue-500 text-sm mb-2 font-medium">
            {post.hashtags}
          </div>
        )}
      </div>

      {/* Media */}
      {post.image && (
        <div className="w-full bg-black">
           <img src={post.image} className="w-full h-auto max-h-[500px] object-contain" loading="lazy" />
        </div>
      )}
      
      {post.video && (
        <div className="w-full aspect-video bg-black">
          <iframe 
            width="100%" 
            height="100%" 
            src={`https://www.youtube.com/embed/${post.video}`} 
            title="YouTube video" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Interactions */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-gray-500">
        <div className="flex space-x-6">
          <button onClick={handleLike} className={`flex items-center space-x-1 ${liked ? 'text-red-500' : 'hover:text-red-500'}`}>
            <Heart size={20} fill={liked ? "currentColor" : "none"} />
            <span className="text-sm font-medium">{likesCount}</span>
          </button>
          <button onClick={fetchComments} className="flex items-center space-x-1 hover:text-blue-500">
            <MessageCircle size={20} />
            <span className="text-sm font-medium">Komen</span>
          </button>
        </div>
        <button onClick={handleShare} className="hover:text-green-500">
          <Share2 size={20} />
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="bg-gray-50 dark:bg-gray-900 p-4 border-t border-gray-100 dark:border-gray-700">
          <form onSubmit={submitComment} className="flex space-x-2 mb-4">
            <input 
              type="text" 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Tulis komentar..."
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button type="submit" disabled={!newComment} className="text-blue-500 font-bold text-sm disabled:opacity-50">
              Kirim
            </button>
          </form>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {comments.map((c, idx) => (
              <div key={idx} className="flex space-x-2">
                <img src={c.userPhoto} className="w-6 h-6 rounded-full" />
                <div className="bg-white dark:bg-gray-800 p-2 rounded-r-xl rounded-bl-xl text-xs shadow-sm">
                  <span className="font-bold block dark:text-gray-300">{c.userName}</span>
                  <span className="dark:text-gray-400">{c.text}</span>
                </div>
                {(isDev || user?.uid === c.userId) && (
                   <button onClick={async () => {
                     await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'comments', c.id));
                     setComments(comments.filter(x => x.id !== c.id));
                   }} className="text-gray-400 hover:text-red-500">
                     <span className="text-[10px]">×</span>
                   </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreatePost({ user, onPost }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState("");
  const [image, setImage] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleImageChange = async (e) => {
    if (e.target.files[0]) {
      try {
        const compressed = await compressImage(e.target.files[0]);
        setImage(compressed);
      } catch (err) {
        alert("Gagal memproses gambar");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setUploading(true);

    const videoId = videoUrl ? getYoutubeEmbed(videoUrl) : null;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), {
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        title,
        description: desc,
        hashtags: tags,
        image: image, // Base64
        video: videoId, // YouTube ID
        likes: [],
        createdAt: serverTimestamp()
      });
      onPost();
    } catch (error) {
      console.error(error);
      alert("Gagal memposting. Pastikan koneksi aman.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 min-h-screen p-4">
      <div className="flex items-center mb-6">
        <button onClick={onPost} className="mr-4 text-2xl">←</button>
        <h2 className="text-xl font-bold">Buat Postingan Baru</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input 
          className="w-full text-lg font-bold border-b border-gray-200 dark:border-gray-700 bg-transparent p-2 focus:outline-none"
          placeholder="Judul (Opsional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea 
          className="w-full h-32 bg-gray-50 dark:bg-gray-900 rounded-xl p-3 focus:outline-none resize-none"
          placeholder="Apa yang kamu pikirkan? (Bisa pakai *tebal*, _miring_, atau link)"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          required
        ></textarea>
        
        <input 
          className="w-full text-blue-500 border-b border-gray-200 dark:border-gray-700 bg-transparent p-2 text-sm focus:outline-none"
          placeholder="#Hashtags (pisahkan dengan spasi)"
          value={tags}
          onChange={e => setTags(e.target.value)}
        />

        {/* Media Preview */}
        {image && (
          <div className="relative">
            <img src={image} className="w-full h-48 object-cover rounded-xl" />
            <button onClick={() => setImage(null)} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1">×</button>
          </div>
        )}

        <div className="flex space-x-4">
           {/* Image Upload */}
           <label className="flex items-center space-x-2 text-gray-500 cursor-pointer hover:text-blue-500">
             <ImageIcon size={20} />
             <span className="text-sm">Foto</span>
             <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
           </label>

           {/* Video URL Input Toggle */}
           <div className="flex-1">
             <div className="flex items-center space-x-2 text-gray-500 border-b pb-1">
               <Youtube size={20} />
               <input 
                 className="bg-transparent focus:outline-none text-sm w-full"
                 placeholder="Link YouTube..."
                 value={videoUrl}
                 onChange={e => setVideoUrl(e.target.value)}
               />
             </div>
           </div>
        </div>

        <button 
          type="submit" 
          disabled={uploading}
          className={`w-full py-3 rounded-xl font-bold text-white shadow-lg ${uploading ? 'bg-gray-400' : 'bg-gradient-to-r from-blue-600 to-cyan-500 transform active:scale-95 transition'}`}
        >
          {uploading ? "Mengirim..." : "Posting Sekarang"}
        </button>
      </form>
    </div>
  );
}

function SearchPage({ user, posts }) {
  const [queryTerm, setQueryTerm] = useState("");
  
  const results = posts.filter(p => 
    p.description?.toLowerCase().includes(queryTerm.toLowerCase()) || 
    p.userName?.toLowerCase().includes(queryTerm.toLowerCase()) ||
    p.hashtags?.toLowerCase().includes(queryTerm.toLowerCase())
  );

  return (
    <div className="p-4 pb-20">
      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl flex items-center space-x-2 mb-6">
        <Search className="text-gray-400" />
        <input 
          className="bg-transparent flex-1 focus:outline-none"
          placeholder="Cari user, postingan, atau hashtag..."
          value={queryTerm}
          onChange={e => setQueryTerm(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {queryTerm && results.length === 0 && <p className="text-center text-gray-500">Tidak ditemukan.</p>}
        {queryTerm && results.map(post => (
          <div key={post.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm flex items-center space-x-3">
             <img src={post.userPhoto} className="w-10 h-10 rounded-full bg-gray-200" />
             <div className="overflow-hidden">
               <h4 className="font-bold truncate">{post.userName}</h4>
               <p className="text-xs text-gray-500 truncate">{post.description}</p>
             </div>
          </div>
        ))}
        {!queryTerm && (
          <div className="text-center mt-10 opacity-50">
            <Search size={48} className="mx-auto mb-2" />
            <p>Mulai ketik untuk mencari...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Profile({ user, posts, isDev, onLogout }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newBio, setNewBio] = useState("Pengguna setia BguneNet");
  const [newName, setNewName] = useState(user?.displayName || "");
  const [page, setPage] = useState('main'); // main, legal

  const myPosts = posts.filter(p => p.userId === user?.uid);

  const handleUpdateProfile = async () => {
    // In real app, update auth profile + firestore user doc
    alert("Fitur update profil lengkap (Ganti nama/foto) akan tersedia di rilis berikutnya. Saat ini hanya simulasi lokal.");
    setIsEditing(false);
  };

  if (page === 'legal') return <LegalPage goBack={() => setPage('main')} />;

  return (
    <div className="pb-20">
      {/* Header Profile */}
      <div className="relative bg-gradient-to-r from-blue-600 to-cyan-500 h-32 rounded-b-3xl mb-12">
        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
           <img src={user?.photoURL || APP_LOGO} className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-900 shadow-md bg-white" />
        </div>
      </div>

      <div className="text-center px-4 mb-6">
        {isEditing ? (
          <div className="space-y-2 max-w-xs mx-auto">
            <input value={newName} onChange={e=>setNewName(e.target.value)} className="border p-1 w-full rounded text-center" />
            <input value={newBio} onChange={e=>setNewBio(e.target.value)} className="border p-1 w-full rounded text-center text-sm" />
            <button onClick={handleUpdateProfile} className="bg-blue-500 text-white px-4 py-1 rounded-full text-xs">Simpan</button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold flex justify-center items-center">
              {user?.displayName} 
              {isDev && <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full ml-2">DEV</span>}
            </h2>
            <p className="text-gray-500 text-sm mb-2">{newBio}</p>
            <div className="flex justify-center space-x-2">
              <button onClick={() => setIsEditing(true)} className="px-4 py-1 border border-gray-300 rounded-full text-xs">Edit Profil</button>
              {isDev && (
                <button onClick={() => window.location.href = `mailto:${DEVELOPER_EMAIL}`} className="px-4 py-1 bg-gray-800 text-white rounded-full text-xs">Email Dev</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Menu Options */}
      <div className="px-4 mb-6 space-y-2">
        {isDev && (
           <button onClick={() => window.dispatchEvent(new CustomEvent('nav-dev'))} className="w-full flex items-center p-3 bg-gray-900 text-white rounded-xl shadow-lg">
             <Terminal size={18} className="mr-3" />
             Dashboard Developer
           </button>
        )}
        <button onClick={() => setPage('legal')} className="w-full flex items-center p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:bg-gray-50">
          <Info size={18} className="mr-3 text-blue-500" />
          Tentang & Legal
        </button>
        <button onClick={onLogout} className="w-full flex items-center p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100">
          <LogOut size={18} className="mr-3" />
          Keluar
        </button>
      </div>

      {/* My Posts */}
      <div className="px-4">
        <h3 className="font-bold text-lg mb-4 border-b pb-2">Postingan Saya ({myPosts.length})</h3>
        <div className="space-y-4">
          {myPosts.map(p => (
            <PostCard key={p.id} post={p} user={user} isDev={isDev} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DeveloperPanel({ user, posts }) {
  const [cmd, setCmd] = useState("");
  const [logs, setLogs] = useState(["System initialized...", "Connected to Firestore...", "Waiting for commands..."]);

  const handleCommand = (e) => {
    if (e.key === 'Enter') {
      let newLog = `> ${cmd}`;
      if (cmd === 'clear') {
        setLogs([]);
      } else if (cmd === 'stats') {
        setLogs([...logs, newLog, `Total Posts: ${posts.length}`, `Active User: ${user.email}`]);
      } else if (cmd.startsWith('ban')) {
        setLogs([...logs, newLog, `User banned successfully (Simulation).`]);
      } else {
        setLogs([...logs, newLog, "Command not recognized."]);
      }
      setCmd("");
    }
  };

  return (
    <div className="pb-20 p-4">
      <h2 className="text-2xl font-bold mb-4 flex items-center text-blue-600">
        <Shield className="mr-2" /> Developer Dashboard
      </h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-4 rounded-xl">
          <h3 className="text-xs opacity-80">Total Postingan</h3>
          <p className="text-3xl font-bold">{posts.length}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-4 rounded-xl">
          <h3 className="text-xs opacity-80">Status Server</h3>
          <p className="text-lg font-bold flex items-center">
            <span className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></span> Online
          </p>
        </div>
      </div>

      {/* Terminal */}
      <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs shadow-2xl overflow-hidden">
        <div className="h-40 overflow-y-auto mb-2 space-y-1">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div className="flex items-center border-t border-gray-700 pt-2">
          <span className="mr-2">$</span>
          <input 
            className="bg-transparent focus:outline-none w-full" 
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={handleCommand}
            autoFocus
          />
        </div>
      </div>
      
      <p className="mt-4 text-xs text-gray-500 text-center">
        BguneNet Admin Panel v1.0 • Irham Dika
      </p>
    </div>
  );
}

function NotificationPage() {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[50vh] text-center">
      <Bell size={48} className="text-gray-300 mb-4" />
      <h3 className="text-lg font-bold text-gray-600">Belum ada notifikasi</h3>
      <p className="text-sm text-gray-400">Interaksi baru akan muncul di sini.</p>
    </div>
  );
}

function LegalPage({ goBack }) {
  return (
    <div className="p-6 pb-24">
      <button onClick={goBack} className="mb-4 text-blue-500 font-medium">← Kembali</button>
      <h1 className="text-2xl font-bold mb-6">Informasi & Legal</h1>
      
      <Section title="Tentang Pengembang">
        <p>Aplikasi ini dibuat oleh <strong>M. Irham Andika Putra</strong> (14 Tahun), siswa SMP Negeri 3 Mentok.</p>
        <p className="mt-2 text-xs text-gray-500">Versi Aplikasi: {APP_VERSION}</p>
      </Section>

      <Section title="Kebijakan Privasi">
        <p>Kami menghargai privasi Anda. Data login menggunakan Google Auth (Firebase) dan kami tidak menyimpan password Anda. Data postingan bersifat publik.</p>
      </Section>

      <Section title="Ketentuan Layanan">
        <ul className="list-disc ml-4 space-y-1">
          <li>Dilarang memposting konten SARA, pornografi, atau ilegal.</li>
          <li>Hormati sesama pengguna (No Cyberbullying).</li>
          <li>Developer berhak menghapus konten yang melanggar tanpa peringatan.</li>
        </ul>
      </Section>

      <Section title="DMCA & Laporan">
        <p>Jika menemukan pelanggaran hak cipta atau konten berbahaya, silakan hubungi developer di: <strong>{DEVELOPER_EMAIL}</strong></p>
      </Section>

      <div className="mt-8 text-center">
         <a href="https://whatsapp.com/channel/0029VbCftn6Dp2QEbNHkm744" target="_blank" className="inline-block bg-green-500 text-white px-6 py-2 rounded-full font-bold shadow-lg">
           Gabung Saluran WhatsApp Resmi
         </a>
         <p className="mt-4 text-xs text-gray-400">© 2025 BguneNet. All rights reserved.</p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6 border-b border-gray-100 pb-4 last:border-0">
      <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-200">{title}</h3>
      <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {children}
      </div>
    </div>
  );
}