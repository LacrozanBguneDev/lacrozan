import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile,
    signInWithCustomToken, 
    signInAnonymously, // Tambahkan signInAnonymously
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    query, 
    onSnapshot, 
    addDoc, 
    doc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove,
} from 'firebase/firestore';
import { ChevronRight, Heart, MessageCircle, User, Plus, Search, LogOut, Loader, Film, Image } from 'lucide-react';

// --- Konfigurasi dan Inisialisasi Firebase ---

// KONFIGURASI PENGGUNA BARU
const userFirebaseConfig = {
    apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
    authDomain: "eduku-web.firebaseapp.com",
    projectId: "eduku-web",
    storageBucket: "eduku-web.firebasestorage.com",
    messagingSenderId: "662463693471",
    appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
    measurementId: "G-G0VWNHHVB8"
};

const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : JSON.stringify(userFirebaseConfig));
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-social-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : ''; // Dapatkan token

let app;
let dbInstance;
let authInstance;

try {
    app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
} catch (error) {
    console.error("Kesalahan inisialisasi Firebase:", error);
}

// Endpoint Upload File
const UPLOAD_URL = 'https://api-faa.my.id/faa/tourl';

// Fungsi Helper untuk Upload File ke api-faa.my.id
const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const MAX_RETRIES = 3;
    let delay = 1000;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(UPLOAD_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gagal mengunggah file: Status ${response.status}. Pesan: ${errorText.substring(0, 50)}...`);
            }

            const data = await response.json();
            
            if (data.status && data.file && data.file.url) {
                return data.file.url;
            }
            throw new Error('Respons API tidak valid atau URL file tidak ditemukan.');

        } catch (error) {
            console.error(`Upaya unggah ${i + 1} gagal:`, error.message);
            if (i < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                throw new Error("Gagal mengunggah file setelah beberapa kali percobaan.");
            }
        }
    }
};

// Fungsi Helper untuk Mendapatkan Embed URL (Contoh sederhana)
const getEmbedUrl = (url) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.match(/(?:\/|v=)([\w-]{11})(?:\/|&|$)/)?.[1];
        return videoId ? { type: 'youtube', url: `https://www.youtube.com/embed/${videoId}` } : null;
    }
    if (url.includes('tiktok.com')) {
        return { type: 'tiktok', url: url };
    }
    if (url.includes('instagram.com') || url.includes('instagr.am')) {
        return { type: 'instagram', url: url };
    }
    return null;
};

// --- Komponen Kartu Postingan ---
const PostCard = React.memo(({ post, userId, handleLike }) => {
    const isLiked = post.likes?.includes(userId);
    const likeCount = post.likes?.length || 0;
    const isImageOrVideo = ['image', 'video-upload'].includes(post.mediaType);
    const isVideoEmbed = ['youtube', 'tiktok', 'instagram'].includes(post.mediaType);

    const renderMedia = () => {
        if (!post.mediaUrl) return null;

        if (isImageOrVideo) {
            const isVideo = post.mediaUrl.match(/\.(mp4|mov|webm)$/i);
            
            if (isVideo) {
                return (
                    <video 
                        controls 
                        src={post.mediaUrl} 
                        className="w-full h-auto max-h-96 object-contain rounded-md mb-3 bg-black"
                    >
                        Browser Anda tidak mendukung tag video.
                    </video>
                );
            }
            
            return (
                <img 
                    src={post.mediaUrl} 
                    alt={post.title} 
                    className="w-full h-48 object-cover rounded-md mb-3"
                    onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/600x400/ef4444/ffffff?text=Error+Loading+Image"; }}
                />
            );
        }

        if (isVideoEmbed) {
            if (post.mediaType === 'youtube' && post.mediaUrl.includes('youtube.com/embed')) {
                return (
                    <div className="relative pt-[56.25%] mb-3 rounded-md overflow-hidden bg-gray-900">
                        <iframe
                            src={post.mediaUrl}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute top-0 left-0 w-full h-full"
                        ></iframe>
                    </div>
                );
            }
            return (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-md mb-3">
                    <p className="text-sm font-medium text-red-800 flex items-center">
                        <Film className="w-4 h-4 mr-2" />
                        Media Tertanam ({post.mediaType})
                    </p>
                    <a 
                        href={post.mediaUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-red-500 hover:text-red-600 text-sm truncate block"
                    >
                        {post.mediaUrl}
                    </a>
                </div>
            );
        }
        
        return null;
    };

    return (
        <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 mb-6">
            <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white text-lg font-bold mr-3">{post.userName ? post.userName[0].toUpperCase() : 'U'}</div>
                <div>
                    <p className="font-semibold text-gray-800">@{post.userName || 'Pengguna Anonim'}</p>
                    <p className="text-xs text-gray-500">{new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                </div>
                <p className="ml-auto text-xs text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">ID: {post.userId.substring(0, 4)}</p>
            </div>
            
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{post.title}</h2>
            
            {renderMedia()}
            
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{post.content}</p>
            
            <div className="flex items-center mt-4 pt-4 border-t border-gray-100">
                <button 
                    onClick={() => handleLike(post.id, isLiked)} 
                    className={`flex items-center p-2 rounded-full transition duration-200 ${isLiked ? 'text-red-500 hover:bg-red-100' : 'text-gray-500 hover:text-red-500 hover:bg-gray-100'}`}
                    aria-label={isLiked ? "Batal Suka" : "Suka"}
                >
                    <Heart className="w-5 h-5 fill-current" />
                    <span className="ml-2 font-medium">{likeCount} Suka</span>
                </button>
                <div className="flex items-center text-gray-500 ml-4 p-2">
                    <MessageCircle className="w-5 h-5" />
                    <span className="ml-2">{post.commentsCount || 0} Komentar</span>
                </div>
            </div>
        </div>
    );
});


// --- Komponen Modal Postingan Baru ---
const CreatePostModal = ({ isOpen, onClose, userId, userName, addPost }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [file, setFile] = useState(null);
    const [embedUrl, setEmbedUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState('text'); // 'text', 'image', 'video'

    const handlePost = async () => {
        if (!title || !content || loading) {
            setError('Judul dan Konten tidak boleh kosong.');
            return;
        }

        setLoading(true);
        setError('');
        let mediaUrl = '';
        let mediaType = 'none';

        try {
            if (mode === 'image' && file) {
                const fileType = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') || file.type.startsWith('audio/') ? 'video-upload' : 'file-upload');
                mediaUrl = await uploadFile(file);
                mediaType = fileType;
            } else if (mode === 'video' && embedUrl) {
                const embedInfo = getEmbedUrl(embedUrl);
                if (embedInfo) {
                    mediaUrl = embedInfo.url;
                    mediaType = embedInfo.type;
                } else {
                    throw new Error('URL Embed Video tidak valid atau tidak didukung (Hanya YouTube yang diutamakan).');
                }
            }

            const newPost = {
                userId,
                userName,
                title,
                content,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType,
                likes: [],
                commentsCount: 0,
                timestamp: new Date(),
            };

            await addPost(newPost);
            
            // Reset state
            setTitle('');
            setContent('');
            setFile(null);
            setEmbedUrl('');
            setMode('text');
            onClose();

        } catch (err) {
            console.error("Gagal membuat postingan:", err);
            setError(err.message || 'Gagal membuat postingan.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-5 border-b pb-3 flex justify-between items-center">
                    Buat Postingan Baru
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </h2>
                
                {/* Mode Selector */}
                <div className="flex space-x-2 mb-4 overflow-x-auto pb-1">
                    <button 
                        onClick={() => { setMode('text'); setFile(null); setEmbedUrl(''); setError(''); }}
                        className={`shrink-0 px-4 py-2 rounded-full flex items-center transition duration-200 ${mode === 'text' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        <Plus className="w-4 h-4 mr-1"/> Teks
                    </button>
                    <button 
                        onClick={() => { setMode('image'); setEmbedUrl(''); setError(''); }}
                        className={`shrink-0 px-4 py-2 rounded-full flex items-center transition duration-200 ${mode === 'image' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        <Image className="w-4 h-4 mr-1"/> Gambar/Video (Upload)
                    </button>
                    <button 
                        onClick={() => { setMode('video'); setFile(null); setError(''); }}
                        className={`shrink-0 px-4 py-2 rounded-full flex items-center transition duration-200 ${mode === 'video' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        <Film className="w-4 h-4 mr-1"/> Embed Video (YT/TT/IG)
                    </button>
                </div>

                {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</p>}
                
                <input
                    type="text"
                    placeholder="Judul Postingan (Wajib)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 mb-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold"
                />

                <textarea
                    placeholder="Tulis konten postingan Anda di sini..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows="6"
                    className="w-full p-3 mb-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                ></textarea>

                {mode === 'image' && (
                    <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unggah Gambar, Video, atau Audio</label>
                        <input
                            type="file"
                            onChange={(e) => setFile(e.target.files[0])}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                         {file && <p className="mt-2 text-sm text-gray-600">File terpilih: {file.name} ({Math.round(file.size / 1024)} KB)</p>}
                         <p className="mt-2 text-xs text-gray-500">Mendukung .jpg, .png, .mp4, .mp3, dll. (Pastikan ukuran file kecil untuk demo)</p>
                    </div>
                )}

                {mode === 'video' && (
                    <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">URL Video Tertanam (YouTube, TikTok, Instagram)</label>
                        <input
                            type="url"
                            placeholder="Tempel URL YouTube/TikTok/IG di sini"
                            value={embedUrl}
                            onChange={(e) => setEmbedUrl(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                         <p className="mt-2 text-xs text-gray-500">Hanya YouTube yang akan muncul dalam bingkai, TikTok/IG akan muncul sebagai tautan.</p>
                    </div>
                )}

                <button
                    onClick={handlePost}
                    disabled={!title || !content || loading}
                    className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition duration-300 disabled:bg-indigo-300 shadow-md flex items-center justify-center"
                >
                    {loading ? (
                        <>
                            <Loader className="w-5 h-5 animate-spin mr-2"/> Mengunggah & Memposting...
                        </>
                    ) : (
                        'Publikasikan Postingan'
                    )}
                </button>
            </div>
        </div>
    );
};

// --- Komponen Utama Aplikasi ---
const App = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState('Beranda'); // 'Beranda', 'Akun'
    const [posts, setPosts] = useState([]);
    const [isPostModalOpen, setIsPostModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [feedTab, setFeedTab] = useState('Terbaru'); // 'Terbaru', 'Untukmu'

    // 1. Inisialisasi Firebase dan Autentikasi
    useEffect(() => {
        if (!authInstance || !dbInstance) {
            setLoading(false);
            return;
        }

        const handleInitialAuth = async () => {
            try {
                // Reintroduce Canvas initial sign-in logic.
                if (initialAuthToken) {
                    await signInWithCustomToken(authInstance, initialAuthToken);
                } else {
                    await signInAnonymously(authInstance);
                }
            } catch (e) {
                console.error("Kesalahan inisialisasi otentikasi Canvas:", e);
            }
        };

        handleInitialAuth(); // Run initial sign-in logic

        // 1a. Inisialisasi Auth State Listener
        const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
            // HANYA terima pengguna yang sudah Login (Authenticated) dan BUKAN pengguna Anonim.
            if (currentUser && !currentUser.isAnonymous) {
                setUser(currentUser);
            } else {
                // Jika pengguna anonim (hasil dari inisiasi Canvas) atau belum login, 
                // paksa ke AuthView dengan menyetel user ke null.
                setUser(null); 
            }
            // Setelah cek status awal, matikan loading.
            setLoading(false); 
        });
        
        return () => unsubscribe();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 2. Load Postingan dari Firestore (Real-time)
    useEffect(() => {
        if (!dbInstance || !user) {
            setPosts([]); // Hapus postingan jika pengguna keluar
            return;
        }

        const postsCollectionRef = collection(dbInstance, `/artifacts/${appId}/public/data/posts`);
        const q = query(postsCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp || new Date(), 
            })).sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate()); // Urutkan berdasarkan terbaru

            setPosts(fetchedPosts);
        }, (error) => {
            console.error("Error fetching posts:", error);
        });

        return () => unsubscribe();
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    // 3. Fungsi Autentikasi (sekarang menerima callback error, dan tidak menggunakan alert)
    const handleAuth = async (email, password, isRegister, username, setErrorCallback) => {
        if (!authInstance) return console.error("Firebase Auth tidak tersedia.");

        setLoading(true);
        setErrorCallback('');
        try {
            if (isRegister) {
                if (!username || username.length < 3) throw new Error('Username harus minimal 3 karakter.');
                
                const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
                
                await updateProfile(userCredential.user, {
                    displayName: username 
                });
                
            } else {
                await signInWithEmailAndPassword(authInstance, email, password);
            }
        } catch (error) {
            console.error("Kesalahan Auth:", error.message);
            // Terjemahkan pesan error umum
            let errorMessage = 'Login/Daftar Gagal. Silakan coba lagi.';
            
            // Penanganan error spesifik untuk auth/operation-not-allowed
            if (error.code === 'auth/operation-not-allowed') {
                errorMessage = 'Autentikasi Email/Password Belum Diaktifkan. Anda harus mengaktifkan metode "Email/Password" di konsol Firebase (Authentication -> Sign-in method).';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Email sudah terdaftar. Silakan Login.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Format email tidak valid.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password harus minimal 6 karakter.';
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'Email atau password salah.';
            }

            setErrorCallback(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        if (!authInstance) return;
        try {
            await signOut(authInstance);
            setUser(null);
            setCurrentView('Beranda'); 
        } catch (error) {
            console.error("Gagal Logout:", error);
        }
    };

    // 4. Fungsi Database (Post, Like)
    const addPost = async (newPost) => {
        if (!dbInstance) return;
        const postsCollectionRef = collection(dbInstance, `/artifacts/${appId}/public/data/posts`);
        await addDoc(postsCollectionRef, newPost);
    };

    const handleLike = useCallback(async (postId, isLiked) => {
        if (!dbInstance || !user) return;
        
        const postRef = doc(dbInstance, `/artifacts/${appId}/public/data/posts`, postId);
        
        try {
            if (isLiked) {
                await updateDoc(postRef, {
                    likes: arrayRemove(user.uid)
                });
            } else {
                await updateDoc(postRef, {
                    likes: arrayUnion(user.uid)
                });
            }
        } catch (error) {
            console.error("Gagal memperbarui like:", error);
        }
    }, [user]);

    // 5. Logika Filter dan Pencarian
    const filteredPosts = useMemo(() => {
        let result = posts.filter(post => 
            post.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            post.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.userName?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (feedTab === 'Untukmu') {
            // Algoritma "Untukmu": Acak
            return result.sort(() => Math.random() - 0.5);
        }
        return result;
    }, [posts, searchQuery, feedTab]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader className="w-8 h-8 text-indigo-500 animate-spin mr-3" />
                <p className="text-gray-600">Memuat Aplikasi...</p>
            </div>
        );
    }

    // Redirect to AuthView if user is null (not logged in)
    if (!user) {
        return <AuthView handleAuth={handleAuth} loading={loading} />;
    }

    const userName = user.displayName || `User-${user.uid.substring(0, 6)}`;
    
    // --- Render Halaman Beranda ---
    const HomeView = () => (
        <div className="max-w-3xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-6">Beranda</h1>

            {/* Kontrol Postingan dan Pencarian */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <button
                    onClick={() => setIsPostModalOpen(true)}
                    className="w-full md:w-auto flex items-center justify-center bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-indigo-700 transition duration-300 shadow-lg shadow-indigo-200"
                >
                    <Plus className="w-5 h-5 mr-2" /> Buat Postingan
                </button>
                
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Cari postingan, judul, atau pengguna..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-3 pl-10 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                </div>
            </div>

            {/* Tab Filter Feed */}
            <div className="flex border-b border-gray-200 mb-8">
                {['Terbaru', 'Untukmu'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFeedTab(tab)}
                        className={`px-4 py-2 text-lg font-medium transition duration-200 ${
                            feedTab === tab 
                                ? 'text-indigo-600 border-b-2 border-indigo-600' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Daftar Postingan */}
            <div className="space-y-6">
                {filteredPosts.length > 0 ? (
                    filteredPosts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post} 
                            userId={user.uid} 
                            handleLike={handleLike} 
                        />
                    ))
                ) : (
                    <div className="text-center p-10 bg-gray-100 rounded-xl">
                        <p className="text-gray-600">
                            {searchQuery ? `Tidak ada postingan yang cocok dengan "${searchQuery}".` : 'Belum ada postingan. Ayo mulai buat yang pertama!'}
                        </p>
                    </div>
                )}
            </div>
            
            <CreatePostModal 
                isOpen={isPostModalOpen}
                onClose={() => setIsPostModalOpen(false)}
                userId={user.uid}
                userName={userName}
                addPost={addPost}
            />
        </div>
    );

    // --- Render Halaman Akun ---
    const ProfileView = () => (
        <div className="max-w-xl mx-auto p-4 md:p-8 pt-10">
            <div className="bg-white p-8 rounded-xl shadow-2xl border border-gray-100">
                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 bg-indigo-500 rounded-full flex items-center justify-center text-white text-4xl font-extrabold mb-4 border-4 border-indigo-100">
                        {userName[0].toUpperCase()}
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">@{userName}</h2>
                    <p className="text-gray-500 mb-6">ID Pengguna: <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded-md">{user.uid}</span></p>

                    <div className="w-full space-y-3">
                        <div className="bg-indigo-50 p-4 rounded-lg flex justify-between items-center">
                            <span className="font-medium text-indigo-700">Email</span>
                            <span className="text-indigo-900">{user.email || 'Tidak Tersedia'}</span>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-lg flex justify-between items-center">
                            <span className="font-medium text-indigo-700">Jumlah Postingan</span>
                            <span className="text-indigo-900 font-bold">{posts.filter(p => p.userId === user.uid).length}</span>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleLogout}
                        className="mt-8 w-full flex items-center justify-center bg-red-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-red-700 transition duration-300 shadow-md shadow-red-200"
                    >
                        <LogOut className="w-5 h-5 mr-2" /> Logout
                    </button>
                </div>
            </div>
        </div>
    );
    
    // --- Render Aplikasi dengan Navigasi ---
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header / Navigasi */}
            <header className="bg-white shadow-lg sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-extrabold text-indigo-600">
                        <span className="text-indigo-800">FAA</span> Sosial
                    </h1>
                    
                    <nav className="flex items-center space-x-6">
                        <button 
                            onClick={() => setCurrentView('Beranda')} 
                            className={`flex items-center text-sm font-semibold transition duration-200 ${currentView === 'Beranda' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                        >
                            <ChevronRight className="w-4 h-4 mr-1"/> Beranda
                        </button>
                        <button 
                            onClick={() => setCurrentView('Akun')} 
                            className={`flex items-center text-sm font-semibold transition duration-200 ${currentView === 'Akun' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                        >
                            <User className="w-4 h-4 mr-1"/> Akun
                        </button>
                        <button
                            onClick={handleLogout}
                            className="text-red-500 hover:text-red-700 flex items-center text-sm font-semibold"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </nav>
                </div>
            </header>

            {/* Konten Utama */}
            <main className="flex-grow pb-12">
                {currentView === 'Beranda' && <HomeView />}
                {currentView === 'Akun' && <ProfileView />}
            </main>
            
            {/* Tombol Postingan Cepat untuk Mobile */}
            <button
                onClick={() => setIsPostModalOpen(true)}
                className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition duration-300 md:hidden z-50"
                aria-label="Buat Postingan Baru"
            >
                <Plus className="w-6 h-6" />
            </button>
        </div>
    );
};

// --- Komponen View Autentikasi (Login/Register) ---
const AuthView = ({ handleAuth, loading }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [authError, setAuthError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');

        if (isRegister && username.length < 3) {
            setAuthError('Username harus minimal 3 karakter.');
            return;
        }

        if (password.length < 6) {
            setAuthError('Password harus minimal 6 karakter.');
            return;
        }

        // Panggil handleAuth dari App, dan gunakan setAuthError sebagai callback
        await handleAuth(email, password, isRegister, username, setAuthError);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 md:p-10 rounded-xl shadow-2xl w-full max-w-md border border-gray-100">
                <h1 className="text-3xl font-extrabold text-indigo-600 text-center mb-2">FAA Sosial</h1>
                <h2 className="text-xl font-bold text-gray-800 text-center mb-8">
                    {isRegister ? 'Daftar Akun Baru' : 'Login ke Akun Anda'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {authError && <p className="bg-red-100 text-red-700 p-3 rounded-md text-sm">{authError}</p>}

                    {isRegister && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="username">Username</label>
                            <input
                                id="username"
                                type="text"
                                placeholder="Pilih username unik Anda"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="email@contoh.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="minimal 6 karakter"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading || (isRegister && !username) || !email || !password}
                        className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition duration-300 disabled:bg-indigo-300 shadow-md flex items-center justify-center"
                    >
                        {loading ? (
                            <>
                                <Loader className="w-5 h-5 animate-spin mr-2"/> Memproses...
                            </>
                        ) : (
                            isRegister ? 'Daftar' : 'Login'
                        )}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600">
                    {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}
                    <button 
                        onClick={() => { setIsRegister(!isRegister); setAuthError(''); }} 
                        className="text-indigo-600 font-semibold ml-1 hover:text-indigo-800"
                        disabled={loading}
                    >
                        {isRegister ? 'Login' : 'Daftar sekarang'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default App;