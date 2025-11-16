import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, collection, query, orderBy, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { Heart, MessageCircle, User, LogOut, Home, Send, Search, Image, Film, Trash2, Loader, LayoutList, Shuffle, X, AlertTriangle, CornerDownRight } from 'lucide-react';

// --- Variabel Global Wajib dari Lingkungan Canvas ---
const apiKey = ""; // API Key dibiarkan kosong karena akan diisi oleh Canvas
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Konfigurasi dan Inisialisasi Firebase ---
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

// --- Konstanta & Utilitas ---
const POST_COLLECTION = `artifacts/${appId}/public/data/posts`;
const USERS_COLLECTION = `artifacts/${appId}/public/data/users`;

// Fungsi untuk mengunggah file ke API eksternal
const uploadFileToService = async (file) => {
  const url = 'https://api-faa.my.id/faa/tourl';
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Gagal mengunggah file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.url; // Asumsi API mengembalikan { url: "..." }
  } catch (error) {
    console.error("Error upload file:", error);
    throw new Error("Gagal mengunggah file. Cek konsol untuk detail.");
  }
};

// Fungsi untuk mendeteksi jenis media (YouTube, TikTok, dll.)
const getMediaEmbed = (url) => {
  if (!url) return null;

  // YouTube Embed
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch) {
    return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // TikTok Embed (Contoh sederhana, TikTok embedding lebih kompleks)
  if (url.includes('tiktok.com/')) {
    return { type: 'tiktok', url };
  }
  
  // Instagram Embed (Contoh sederhana, IG embedding lebih kompleks)
  if (url.includes('instagram.com/')) {
    return { type: 'instagram', url };
  }

  // Cek apakah URL adalah gambar (asumsi berdasar ekstensi)
  const imageRegex = /\.(jpg|jpeg|png|gif|webp)$/i;
  if (url.match(imageRegex)) {
      return { type: 'image', url };
  }

  return { type: 'link', url };
};

// Fungsi utilitas untuk format waktu
const formatTimestamp = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return 'Baru saja';
  const date = timestamp.toDate();
  return date.toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};


const PostCard = ({ post, currentUserId, userProfiles, onLike, onComment, onDelete }) => {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isLiked = post.likes.includes(currentUserId);
  const authorProfile = userProfiles[post.userId] || { displayName: 'Pengguna Tidak Dikenal', email: 'anon@example.com' };
  const mediaEmbed = getMediaEmbed(post.mediaUrl);
  const isOwner = post.userId === currentUserId;

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (newComment.trim() && currentUserId) {
      onComment(post.id, newComment.trim());
      setNewComment('');
    }
  };

  const handleDelete = async () => {
      if (window.confirm("Apakah Anda yakin ingin menghapus postingan ini?")) {
          setIsDeleting(true);
          try {
              await onDelete(post.id);
          } catch (error) {
              console.error("Gagal menghapus post:", error);
              // Handle error visually if needed
          } finally {
              setIsDeleting(false);
          }
      }
  };

  const renderMedia = () => {
    if (!mediaEmbed) return null;

    if (mediaEmbed.type === 'image') {
      return (
        <img
          src={mediaEmbed.url}
          alt="Post media"
          className="w-full h-auto max-h-96 object-contain rounded-lg mt-3 bg-gray-100"
          onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/600x400/CCCCCC/333333?text=Gagal+Muat+Gambar"; }}
        />
      );
    }
    
    // Untuk YouTube, gunakan iframe
    if (mediaEmbed.type === 'youtube') {
      return (
        <div className="relative pt-[56.25%] mt-3 rounded-lg overflow-hidden shadow-lg"> {/* 16:9 Aspect Ratio */}
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={mediaEmbed.embedUrl}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded YouTube Video"
          ></iframe>
        </div>
      );
    }

    // Untuk link lainnya (TikTok/IG/lainnya), tampilkan sebagai tautan
    if (mediaEmbed.type === 'link' || mediaEmbed.type === 'tiktok' || mediaEmbed.type === 'instagram') {
        return (
            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm truncate">
                <p className="font-semibold text-indigo-700">Link Tertanam:</p>
                <a href={mediaEmbed.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline break-words">
                    {mediaEmbed.url}
                </a>
                <p className='text-xs text-indigo-500'>*Tidak semua platform mengizinkan embed langsung, klik untuk melihat.</p>
            </div>
        );
    }

    return null;
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-100 transition duration-300 hover:shadow-xl mb-6">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-indigo-200 rounded-full flex items-center justify-center text-indigo-700 font-bold mr-3">
            <User size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-800">{authorProfile.displayName || authorProfile.email.split('@')[0]}</p>
            <p className="text-xs text-gray-500">{formatTimestamp(post.timestamp)}</p>
          </div>
        </div>
        {isOwner && (
            <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 disabled:opacity-50"
                title="Hapus Postingan"
            >
                {isDeleting ? <Loader size={18} className='animate-spin' /> : <Trash2 size={18} />}
            </button>
        )}
      </div>

      {/* Judul dan Konten */}
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{post.title}</h2>
      <div
        className="text-gray-700 leading-relaxed text-base"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
      
      {/* Media */}
      {renderMedia()}

      {/* Aksi */}
      <div className="flex items-center space-x-5 mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={() => onLike(post.id, isLiked)}
          className={`flex items-center space-x-1 p-2 rounded-full transition duration-150 ${
            isLiked ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-gray-500 hover:text-red-500 hover:bg-gray-50'
          }`}
        >
          <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
          <span className="font-semibold">{post.likes.length} Suka</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center space-x-1 text-gray-500 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition duration-150"
        >
          <MessageCircle size={20} />
          <span className="font-semibold">{post.comments.length} Komentar</span>
        </button>
      </div>

      {/* Komentar */}
      {showComments && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <h4 className="font-bold text-gray-700 mb-3">Komentar ({post.comments.length})</h4>
          
          {/* Form Komentar */}
          <form onSubmit={handleCommentSubmit} className="flex mb-4">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Tulis komentar..."
              className="flex-grow p-2 border border-gray-300 rounded-l-lg focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white p-2 rounded-r-lg hover:bg-indigo-700 transition duration-150 flex items-center"
            >
              <CornerDownRight size={20} />
            </button>
          </form>

          {/* Daftar Komentar */}
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {post.comments.slice().reverse().map((comment, index) => { // Tampilkan komentar terbaru di atas
              const commenterProfile = userProfiles[comment.userId] || { displayName: 'Anon' };
              return (
                <div key={index} className="flex text-sm">
                  <span className="font-bold text-indigo-600 mr-2">{commenterProfile.displayName || comment.userId.substring(0, 5)}:</span>
                  <p className="text-gray-700 break-words">{comment.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const PostModal = ({ onClose, currentUserId, userName }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const contentRef = React.useRef(null);

  const applyStyle = (style) => {
    document.execCommand(style, false, null);
    contentRef.current.focus();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileToUpload(file);
      setMediaUrl(''); // Hapus URL jika file dipilih
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !content.trim()) {
      setError('Judul dan konten tidak boleh kosong.');
      return;
    }

    setIsLoading(true);
    let finalMediaUrl = mediaUrl.trim();

    try {
      if (fileToUpload) {
        finalMediaUrl = await uploadFileToService(fileToUpload);
      }

      const newPost = {
        title: title.trim(),
        content: contentRef.current.innerHTML.trim(), // Ambil HTML dari contenteditable
        mediaUrl: finalMediaUrl,
        userId: currentUserId,
        userName: userName,
        timestamp: serverTimestamp(),
        likes: [],
        comments: [],
      };

      const docRef = doc(collection(db, POST_COLLECTION));
      await setDoc(docRef, newPost);
      
      onClose();
    } catch (err) {
      console.error("Gagal membuat postingan:", err);
      setError(`Gagal memposting: ${err.message || 'Kesalahan jaringan/API.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const richTextToolbar = (
    <div className="mb-3 p-2 bg-gray-50 rounded-lg flex space-x-2 border border-gray-200">
      <button type="button" onClick={() => applyStyle('bold')} className="p-1 text-sm font-bold bg-white rounded shadow hover:bg-gray-100 border">B</button>
      <button type="button" onClick={() => applyStyle('italic')} className="p-1 text-sm italic bg-white rounded shadow hover:bg-gray-100 border">I</button>
      <button type="button" onClick={() => applyStyle('underline')} className="p-1 text-sm underline bg-white rounded shadow hover:bg-gray-100 border">U</button>
      <button type="button" onClick={() => applyStyle('insertUnorderedList')} className="p-1 text-sm bg-white rounded shadow hover:bg-gray-100 border">List</button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-3xl font-extrabold text-indigo-700 mb-6 border-b pb-2">Buat Postingan Baru</h2>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-2 rounded-full bg-gray-100 hover:bg-gray-200">
          <X size={24} />
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center space-x-2">
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Judul */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Judul Postingan</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold"
              placeholder="Masukkan judul yang menarik..."
              required
            />
          </div>

          {/* Konten (Rich Text) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Konten</label>
            {richTextToolbar}
            <div
              ref={contentRef}
              contentEditable
              onInput={(e) => setContent(e.currentTarget.innerHTML)}
              className="w-full p-3 border border-gray-300 rounded-lg min-h-[150px] focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-inner"
              style={{ outline: 'none' }}
              placeholder="Tulis konten Anda di sini..."
            ></div>
          </div>

          {/* Media */}
          <div className='p-4 border border-indigo-200 rounded-lg space-y-3 bg-indigo-50'>
            <label className="block text-sm font-medium text-indigo-700">Media (Gambar/Video/Link Embed)</label>
            
            {/* Upload File */}
            <div className='flex items-center space-x-3'>
                <Image size={20} className='text-indigo-500' />
                <label className="block text-sm font-medium text-gray-700 cursor-pointer p-2 bg-white rounded-lg border hover:bg-gray-100 transition">
                    {fileToUpload ? `File Terpilih: ${fileToUpload.name}` : 'Pilih File (Gambar/Video) dari Komputer'}
                    <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,video/*" />
                </label>
            </div>

            <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className='w-full border-t border-indigo-300'></div>
                ATAU
                <div className='w-full border-t border-indigo-300'></div>
            </div>

            {/* Link Embed */}
            <div className='flex items-center space-x-3'>
                <Film size={20} className='text-indigo-500' />
                <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => {
                        setMediaUrl(e.target.value);
                        setFileToUpload(null); // Hapus file jika URL dimasukkan
                    }}
                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Link Embed (YouTube/TikTok/IG/Gambar URL)..."
                />
            </div>
            
            {(fileToUpload || mediaUrl) && (
                <p className='text-xs text-indigo-600 pt-2'>Media akan diunggah/digunakan: {fileToUpload ? fileToUpload.name : mediaUrl}</p>
            )}
          </div>


          {/* Tombol Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:bg-indigo-700 transition duration-150 disabled:bg-indigo-400 flex items-center justify-center space-x-2"
          >
            {isLoading && <Loader size={20} className="animate-spin" />}
            <span>{isLoading ? 'Mengunggah & Memposting...' : 'Posting Sekarang'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

const AuthScreen = ({ onLoginSuccess, isReady }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Email dan kata sandi harus diisi.');
      setIsLoading(false);
      return;
    }

    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Tambahkan data pengguna ke Firestore
        await setDoc(doc(db, USERS_COLLECTION, userCredential.user.uid), {
          displayName: displayName || email.split('@')[0],
          email: email,
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email atau kata sandi salah.');
      } else if (err.code === 'auth/weak-password') {
        setError('Kata sandi harus minimal 6 karakter.');
      } else {
        setError(`Gagal ${isRegister ? 'mendaftar' : 'masuk'}. Cek email/password.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader size={32} className="animate-spin text-indigo-600" />
        <p className="ml-3 text-lg text-gray-600">Memuat konfigurasi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-2xl border border-indigo-100">
        <h2 className="text-3xl font-extrabold text-center text-indigo-700 mb-6">
          {isRegister ? 'Daftar Akun Baru' : 'Masuk ke Komunitas'}
        </h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p className="font-bold">Error:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="contoh@mail.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Kata Sandi</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Minimal 6 karakter"
            />
          </div>
          {isRegister && (
            <div>
              <label htmlFor="displayname" className="block text-sm font-medium text-gray-700">Nama Tampilan (Opsional)</label>
              <input
                id="displayname"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Nama Anda"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition duration-150 disabled:bg-indigo-400 flex items-center justify-center space-x-2"
          >
            {isLoading && <Loader size={20} className="animate-spin" />}
            <span>{isRegister ? 'Daftar Sekarang' : 'Masuk'}</span>
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfilePage = ({ user, userProfile, onLogout }) => {
  if (!userProfile) {
    return (
      <div className="p-8 text-center text-gray-600">
        <Loader size={32} className="animate-spin mx-auto text-indigo-600 mb-4" />
        Memuat profil pengguna...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-2xl p-8 border border-indigo-100">
        <h1 className="text-4xl font-extrabold text-indigo-700 mb-6 border-b pb-3">Profil Pengguna</h1>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              <User size={30} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Nama Tampilan</p>
              <p className="text-2xl font-bold text-gray-800">{userProfile.displayName}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <p className="text-sm font-medium text-gray-500">Email:</p>
            <p className="text-lg text-gray-800">{user.email}</p>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <p className="text-sm font-medium text-gray-500">ID Pengguna:</p>
            <p className="text-xs break-all bg-gray-100 p-2 rounded-lg font-mono">{user.uid}</p>
            <p className="text-xs text-red-500">*Gunakan ID ini untuk berinteraksi dengan pengguna lain.</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="mt-8 w-full flex items-center justify-center space-x-2 bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-red-700 transition duration-150"
        >
          <LogOut size={20} />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );
};

const HomePage = ({ posts, userProfiles, currentUserId, onLike, onComment, onOpenPostModal }) => {
  const [activeCategory, setActiveCategory] = useState('latest'); // 'latest' atau 'foryou'
  const [searchTerm, setSearchTerm] = useState('');

  // Logika pencarian dan pengurutan
  const filteredAndSortedPosts = useMemo(() => {
    let result = posts.slice(); // Salin array posts

    // 1. Pencarian
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(post =>
        post.title.toLowerCase().includes(lowerSearchTerm) ||
        post.content.toLowerCase().includes(lowerSearchTerm) ||
        (userProfiles[post.userId]?.displayName || '').toLowerCase().includes(lowerSearchTerm)
      );
    }

    // 2. Kategori/Pengurutan
    if (activeCategory === 'foryou') {
      // Logika "Untukmu": Acak postingan
      result.sort(() => Math.random() - 0.5);
    } else {
      // Logika "Terbaru": Sortir berdasarkan timestamp (sudah diurutkan dari Firestore, tapi tetap jaga)
      result.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    }

    return result;
  }, [posts, activeCategory, searchTerm, userProfiles]);


  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Header dan Tombol Posting */}
      <div className="sticky top-0 bg-white z-10 pt-1 pb-4 shadow-sm -mx-4 sm:-mx-6 px-4 sm:px-6 mb-4 rounded-b-xl border-b">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-extrabold text-indigo-700">Beranda Komunitas</h1>
          <button
            onClick={onOpenPostModal}
            className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-xl shadow-md hover:bg-indigo-700 transition duration-150 flex items-center space-x-1"
          >
            <Send size={20} />
            <span>Posting</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari postingan, judul, atau pengguna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-3 pl-10 pr-4 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
          />
          {searchTerm && (
            <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
            >
                <X size={18} />
            </button>
          )}
        </div>

        {/* Kategori */}
        <div className="flex space-x-4 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveCategory('latest')}
            className={`flex items-center space-x-1 font-semibold pb-1 transition duration-150 ${
              activeCategory === 'latest'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-indigo-600'
            }`}
          >
            <LayoutList size={20} />
            <span>Terbaru</span>
          </button>
          <button
            onClick={() => setActiveCategory('foryou')}
            className={`flex items-center space-x-1 font-semibold pb-1 transition duration-150 ${
              activeCategory === 'foryou'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-indigo-600'
            }`}
          >
            <Shuffle size={20} />
            <span>Untukmu</span>
          </button>
        </div>
      </div>

      {/* Daftar Postingan */}
      <div>
        {posts.length === 0 ? (
          <div className="text-center p-10 bg-white rounded-xl shadow-lg mt-6 text-gray-600">
            <AlertTriangle size={32} className="mx-auto text-yellow-500 mb-3" />
            <p className="text-lg font-semibold">Belum ada postingan!</p>
            <p>Jadilah yang pertama untuk membuat konten.</p>
          </div>
        ) : filteredAndSortedPosts.length === 0 ? (
            <div className="text-center p-10 bg-white rounded-xl shadow-lg mt-6 text-gray-600">
                <Search size={32} className="mx-auto text-indigo-500 mb-3" />
                <p className="text-lg font-semibold">Tidak ditemukan hasil untuk "{searchTerm}"</p>
                <p>Coba kata kunci lain atau cek kategori.</p>
            </div>
        ) : (
          filteredAndSortedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              userProfiles={userProfiles}
              onLike={onLike}
              onComment={onComment}
              onDelete={(postId) => deletePost(postId, currentUserId)} // Tambahkan fungsi delete
            />
          ))
        )}
      </div>
    </div>
  );
};


// --- Komponen Utama Aplikasi ---
const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [userProfiles, setUserProfiles] = useState({}); // Cache profil pengguna
  const [view, setView] = useState('home'); // 'home', 'profile'
  const [showPostModal, setShowPostModal] = useState(false);

  // 1. Inisialisasi Firebase & Otentikasi
  useEffect(() => {
    if (!auth) return;

    const initializeAuth = async () => {
      try {
        if (initialAuthToken) {
          // Gunakan custom token jika tersedia
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          // Jika tidak ada token, gunakan sign-in anonim (untuk testing awal)
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Firebase Sign-In Error:", e);
      }
    };

    // Listener Perubahan Status Auth
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    initializeAuth();
    return () => unsubscribe();
  }, []);

  // 2. Ambil Profil Pengguna
  useEffect(() => {
    if (user && db) {
      const fetchProfile = async () => {
        const docRef = doc(db, USERS_COLLECTION, user.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            // Jika profil tidak ada (misalnya, sign-in anonim atau dari token lama), buat profil default
            const defaultProfile = {
                displayName: user.email ? user.email.split('@')[0] : 'Pengguna Anonim',
                email: user.email || 'anon@example.com',
                createdAt: serverTimestamp(),
            };
            setDoc(docRef, defaultProfile, { merge: true });
            setUserProfile(defaultProfile);
          }
        }, (error) => {
            console.error("Error fetching user profile:", error);
        });
        return unsubscribe;
      };
      
      let unsubscribe;
      fetchProfile().then(unsub => unsubscribe = unsub);
      return () => unsubscribe && unsubscribe();
    } else {
      setUserProfile(null);
    }
  }, [user]);

  // 3. Listener Realtime Postingan & Profil Penulis
  useEffect(() => {
    if (!isAuthReady || !user || !db) return;

    // Query untuk mengambil semua postingan, diurutkan berdasarkan waktu (terbaru di atas)
    const postsQuery = query(collection(db, POST_COLLECTION), orderBy('timestamp', 'desc'));

    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Pastikan likes dan comments selalu array
        likes: doc.data().likes || [],
        comments: doc.data().comments || []
      }));
      setPosts(fetchedPosts);

      // Kumpulkan ID pengguna unik dari semua postingan
      const userIds = [...new Set(fetchedPosts.map(p => p.userId))];
      
      // Ambil profil untuk semua ID yang baru
      userIds.forEach(async (uid) => {
        if (!userProfiles[uid]) {
          const userDocRef = doc(db, USERS_COLLECTION, uid);
          onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserProfiles(prev => ({
                ...prev,
                [uid]: docSnap.data(),
              }));
            }
          });
        }
      });

    }, (error) => {
        console.error("Error fetching posts:", error);
    });

    return () => unsubscribePosts();
  }, [isAuthReady, user, userProfiles]);


  // --- Fungsi Aksi CRUD Firestore ---

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      // Pindah ke AuthScreen setelah logout
      setView('home'); 
    } catch (error) {
      console.error("Gagal logout:", error);
    }
  }, []);

  const toggleLike = useCallback(async (postId, isLiked) => {
    if (!user) return;
    const postRef = doc(db, POST_COLLECTION, postId);
    
    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (error) {
      console.error("Gagal toggle like:", error);
    }
  }, [user]);

  const addComment = useCallback(async (postId, text) => {
    if (!user) return;
    const postRef = doc(db, POST_COLLECTION, postId);

    const newComment = {
      userId: user.uid,
      text: text,
      timestamp: serverTimestamp(),
    };

    try {
      await updateDoc(postRef, {
        comments: arrayUnion(newComment),
      });
    } catch (error) {
      console.error("Gagal menambah komentar:", error);
    }
  }, [user]);

  const deletePost = async (postId, userId) => {
      if (!user || user.uid !== userId) {
          console.error("Akses ditolak: Hanya pemilik yang bisa menghapus.");
          return;
      }
      try {
          await deleteDoc(doc(db, POST_COLLECTION, postId));
          console.log("Postingan berhasil dihapus:", postId);
      } catch (error) {
          console.error("Gagal menghapus postingan:", error);
          throw error;
      }
  };


  // --- Render Utama ---

  if (!isAuthReady || (user && !userProfile)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <Loader size={48} className="animate-spin text-indigo-600 mb-4" />
        <h1 className="text-2xl font-bold text-gray-700">Memuat Aplikasi...</h1>
        <p className="text-gray-500 mt-2">Menunggu otentikasi dan data pengguna.</p>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <AuthScreen onLoginSuccess={() => setView('home')} isReady={isAuthReady} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 bg-white shadow-md z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-extrabold text-indigo-600">
                <Heart size={24} className='inline-block mr-1 text-red-500' />
                SosialKu
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setView('home')}
                className={`flex items-center p-2 rounded-lg transition duration-150 ${
                  view === 'home' ? 'bg-indigo-50 text-indigo-600 font-bold shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Home size={20} className="mr-1" />
                <span className="hidden sm:inline">Beranda</span>
              </button>
              <button
                onClick={() => setView('profile')}
                className={`flex items-center p-2 rounded-lg transition duration-150 ${
                  view === 'profile' ? 'bg-indigo-50 text-indigo-600 font-bold shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <User size={20} className="mr-1" />
                <span className="hidden sm:inline">{userProfile.displayName || 'Akun'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition duration-150"
                title="Keluar"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Konten Utama */}
      <main className="max-w-7xl mx-auto pt-6 pb-20 px-4 sm:px-6 lg:px-8">
        {view === 'home' && (
          <HomePage
            posts={posts}
            userProfiles={userProfiles}
            currentUserId={user.uid}
            onLike={toggleLike}
            onComment={addComment}
            onOpenPostModal={() => setShowPostModal(true)}
          />
        )}
        {view === 'profile' && (
          <ProfilePage
            user={user}
            userProfile={userProfile}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Modal Posting */}
      {showPostModal && (
        <PostModal
          onClose={() => setShowPostModal(false)}
          currentUserId={user.uid}
          userName={userProfile.displayName || user.email.split('@')[0]}
        />
      )}
    </div>
  );
};

export default App;