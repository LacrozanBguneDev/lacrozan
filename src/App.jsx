import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, onAuthStateChanged, signOut, 
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInAnonymously, signInWithCustomToken 
} from 'firebase/auth';
import { 
    getFirestore, doc, collection, query, onSnapshot, 
    updateDoc, arrayUnion, arrayRemove, setDoc, 
    serverTimestamp, addDoc, getDoc, setLogLevel, deleteDoc, where
} from 'firebase/firestore';
import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image, Loader2, Link, 
    ListOrdered, Shuffle, Code, Calendar, Lock, Mail, UserPlus, LogIn, AlertCircle, 
    Edit, Trash2, X, Check, Save, PlusCircle, Search, UserCheck, ChevronRight,
    Share2, Film, TrendingUp, Flame, ArrowLeft
} from 'lucide-react';

// Atur log level ke 'warn' atau 'error' agar tidak terlalu berisik di konsol
setLogLevel('warn');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 

// --- 1. KONFIGURASI DAN INISIALISASI FIREBASE ---
// PERBAIKAN: Gunakan config dari environment jika ada (untuk menghindari custom-token-mismatch),
// jika tidak ada baru gunakan config hardcoded Anda.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
  authDomain: "eduku-web.firebaseapp.com",
  projectId: "eduku-web",
  storageBucket: "eduku-web.firebasestorage.com",
  messagingSenderId: "662463693471",
  appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
  measurementId: "G-G0VWNHHVB8"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const getPublicCollection = (collectionName) => 
    `artifacts/${appId}/public/data/${collectionName}`;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 2. FUNGSI UNGGAH API EKSTERNAL (Sama) ---
const uploadToFaaAPI = async (file, onProgress) => {
    const apiUrl = 'https://api-faa.my.id/faa/tourl'; 
    const formData = new FormData();
    onProgress(0);
    formData.append('file', file, file.name);

    try {
        for (let i = 0; i <= 90; i += 10) {
            onProgress(i);
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }
        const response = await fetch(apiUrl, { method: 'POST', body: formData });
        onProgress(90);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        onProgress(100);
        if (data && data.status) {
            return data.url;
        } else {
            throw new Error(data.message || 'Gagal mengunggah file. Respon API tidak valid.');
        }
    } catch (error) {
        onProgress(0); 
        console.error('Upload ke API Faa2 gagal:', error);
        throw new Error('Gagal mengunggah media. Pastikan file valid.');
    }
};

// --- 3. UTILITY FUNCTIONS (Sama) ---
const formatTimeAgo = (timestamp) => {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const fullDate = date.toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (seconds > 86400) { 
        return { relative: fullDate, full: fullDate };
    }
    
    if (seconds < 60) return { relative: 'Baru saja', full: fullDate };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { relative: `${minutes} menit yang lalu`, full: fullDate };
    const hours = Math.floor(minutes / 60);
    return { relative: `${hours} jam yang lalu`, full: fullDate };
};

const getMediaEmbed = (url) => {
    if (!url) return null;
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (youtubeMatch) {
        return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=0` };
    }
    if (url.includes('tiktok.com') || url.includes('instagram.com')) {
        return { type: 'link', embedUrl: url, displayUrl: url, platform: url.includes('tiktok.com') ? 'TikTok' : 'Instagram' };
    }

    return null;
};

const renderMarkdown = (text) => {
    if (!text) return <p className="text-gray-500 italic">Tidak ada konten teks.</p>;
    let html = text;
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm text-red-600 font-mono">$1</code>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-800 leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: html }} />;
};


// --- 4. LAYAR OTENTIKASI FIREBASE (AuthScreen) ---
const AuthScreen = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // --- FUNGSI YANG DIPERBAIKI ---
    const saveUserProfile = async (uid, uname, uemail) => {
        const profileRef = doc(db, getPublicCollection('userProfiles'), uid);
        
        // 1. Cek dulu apakah profil sudah ada
        const docSnap = await getDoc(profileRef);

        if (docSnap.exists()) {
            // 2. Jika SUDAH ADA (ini terjadi saat login)
            // Kita hanya update email jika perlu, dan JANGAN reset data lain.
            // 'uname' akan bernilai null saat login, jadi 'username' tidak akan tertimpa.
            const updateData = { email: uemail };
            if (uname) {
                // Ini seharusnya hanya terjadi saat registrasi jika username diisi
                // tapi doc-nya sudah ada (kasus aneh, tapi aman)
                updateData.username = uname;
            }
            // Gunakan updateDoc untuk menghindari penimpaan field lain
            await updateDoc(profileRef, updateData);
            
        } else {
            // 3. Jika BELUM ADA (ini adalah registrasi baru)
            // Buat dokumen profil baru dengan data default.
            await setDoc(profileRef, {
                username: uname || uemail.split('@')[0], // Gunakan email-prefix sebagai fallback
                email: uemail,
                createdAt: serverTimestamp(),
                uid: uid,
                photoURL: '', // Default untuk pengguna baru
                following: [], // Default untuk pengguna baru
                followers: [] // Default untuk pengguna baru
            });
        }
    };
    // --- AKHIR FUNGSI YANG DIPERBAIKI ---

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isLogin) {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                // Panggilan ini sekarang aman dan tidak akan me-reset data
                await saveUserProfile(userCredential.user.uid, null, email);
                onLoginSuccess(); 
            } else {
                if (!username.trim()) {
                    setError('Username harus diisi.');
                    setIsLoading(false); // Hentikan loading jika ada error validasi
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Panggilan ini akan membuat profil baru
                await saveUserProfile(userCredential.user.uid, username.trim(), email);
                onLoginSuccess();
            }
        } catch (err) {
            console.error("Autentikasi Gagal:", err); 
            let errorMessage = "Gagal. Periksa email/password dan pastikan izin Firebase telah diaktifkan.";
            if (err.code === 'auth/invalid-email') {
                errorMessage = 'Format email tidak valid.';
            } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                errorMessage = 'Email atau password salah.';
            } else if (err.code === 'auth/email-already-in-use') {
                 errorMessage = 'Email sudah terdaftar.';
            } else if (err.code === 'auth/weak-password') {
                 errorMessage = 'Password harus lebih dari 6 karakter.';
            } else if (err.code === 'permission-denied' || err.code === 'PERMISSION_DENIED') {
                 errorMessage = 'Izin ditolak. **CEK SECURITY RULES FIRESTORE ANDA!**';
            }
            
            setError(`${errorMessage} [Kode: ${err.code}]`); 
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-2xl border border-indigo-100">
                <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">
                    {isLogin ? 'Masuk' : 'Daftar'}
                </h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-start space-x-2" role="alert">
                        <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                        <p>{error}</p>
                    </div>
                )}
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-xl mb-4 text-sm">
                    <p className='font-semibold'>Silakan gunakan Email dan Password Anda.</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="relative">
                        <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            required
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition"
                            disabled={isLoading}
                        />
                    </div>
                    
                    {!isLogin && (
                         <div className="relative">
                            <UserPlus size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Username (Nama Tampilan)"
                                required
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition"
                                disabled={isLoading}
                            />
                        </div>
                    )}

                    <div className="relative">
                        <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password (Min. 6 Karakter)"
                            required
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:bg-indigo-300 shadow-lg hover:shadow-xl transform hover:scale-[1.01] duration-150"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                <span>{isLogin ? 'Masuk' : 'Daftar'}</span>
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600">
                    {isLogin ? (
                        <>
                            Belum punya akun?{' '}
                            <button 
                                onClick={() => {setIsLogin(false); setError('');}} 
                                className="text-indigo-600 font-semibold hover:text-indigo-800"
                            >
                                Daftar Sekarang
                            </button>
                        </>
                    ) : (
                        <>
                            Sudah punya akun?{' '}
                            <button 
                                onClick={() => {setIsLogin(true); setError('');}} 
                                className="text-indigo-600 font-semibold hover:text-indigo-800"
                            >
                                Masuk
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
};


// --- 5. KOMPONEN POSTINGAN (PostItem) ---
const PostItem = ({ post, currentUserId, currentUserEmail, profile, handleFollowToggle, goToProfile }) => {
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [comments, setComments] = useState([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [showFullContent, setShowFullContent] = useState(false);
    
    // State Edit
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedContent, setEditedContent] = useState(post.content || '');
    const [editedMediaUrl, setEditedMediaUrl] = useState(post.mediaUrl || '');
    const [isDeleting, setIsDeleting] = useState(false);


    const isLiked = post.likes && post.likes.includes(currentUserId);
    const mediaEmbed = useMemo(() => getMediaEmbed(post.mediaUrl), [post.mediaUrl]);
    const formattedTime = useMemo(() => formatTimeAgo(post.timestamp), [post.timestamp]);
    
    const isOwner = post.userId === currentUserId;
    const isDeveloper = currentUserEmail === DEVELOPER_EMAIL;
    const canEditOrDelete = isOwner || isDeveloper;
    const isFollowing = profile.following?.includes(post.userId);
    
    const MAX_LENGTH = 200;
    const isLongText = post.content && post.content.length > MAX_LENGTH && !isEditing;
    
    const displayedContent = useMemo(() => {
        if (!post.content) return '';
        if (!isLongText || showFullContent || isEditing) {
            return post.content;
        }
        return post.content.substring(0, MAX_LENGTH) + '...';
    }, [post.content, isLongText, showFullContent, isEditing]);
    

    const handleLike = async () => {
        if (!currentUserId) return;
        const postRef = doc(db, getPublicCollection('posts'), post.id);
        
        try {
            if (isLiked) {
                await updateDoc(postRef, { likes: arrayRemove(currentUserId) });
            } else {
                await updateDoc(postRef, { likes: arrayUnion(currentUserId) });
            }
        } catch (error) {
            console.error("Gagal mengubah status like:", error);
        }
    };

    const handleShare = async () => {
        const url = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
        try {
            await navigator.clipboard.writeText(url);
            alert("Link postingan berhasil disalin! Anda bisa membagikannya sekarang.");
        } catch (err) {
            console.error('Gagal menyalin link:', err);
            alert("Gagal menyalin link. Browser Anda mungkin tidak mendukung fitur ini.");
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const username = profile.username || 'Pengguna Tidak Dikenal';
        
        const commentsRef = collection(db, getPublicCollection('comments'));
        try {
            await addDoc(commentsRef, {
                postId: post.id,
                userId: currentUserId,
                text: newComment.trim(),
                username: username,
                timestamp: serverTimestamp() 
            });
            const postRef = doc(db, getPublicCollection('posts'), post.id);
            await updateDoc(postRef, {
                commentsCount: (post.commentsCount || 0) + 1
            });

            setNewComment('');
        } catch (error) {
            console.error("Gagal menambahkan komentar:", error);
        }
    };

    const handleUpdatePost = async () => {
        if (!editedContent.trim() && !editedMediaUrl.trim()) {
            alert('Konten postingan atau URL media tidak boleh kosong.');
            return;
        }
        try {
            const postRef = doc(db, getPublicCollection('posts'), post.id);
            await updateDoc(postRef, {
                title: editedTitle.trim(),
                content: editedContent.trim(),
                mediaUrl: editedMediaUrl.trim(),
                updatedAt: serverTimestamp()
            });
            setIsEditing(false);
            console.log("Postingan berhasil diubah!");
        } catch (error) {
            console.error("Gagal mengupdate postingan:", error);
            alert("Gagal mengupdate postingan. Cek konsol untuk detail.");
        }
    };

    const handleDelete = async () => {
        if (!isDeleting) {
            setIsDeleting(true);
            return;
        }

        try {
            await deleteDoc(doc(db, getPublicCollection('posts'), post.id));
            console.log("Postingan berhasil dihapus.");
            setIsDeleting(false);
        } catch (error) {
            console.error("Gagal menghapus postingan:", error);
            alert("Gagal menghapus postingan. Cek konsol untuk detail.");
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        if (!showComments) return;
        setIsLoadingComments(true);
        // Menggunakan query collection, bukan doc
        const commentsQuery = query(
            collection(db, getPublicCollection('comments')),
            where('postId', '==', post.id),
        );

        const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
            const fetchedComments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            fetchedComments.sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
                return timeB - timeA; 
            });

            setComments(fetchedComments);
            setIsLoadingComments(false);
        }, (error) => {
            console.error("Error fetching comments:", error);
            setIsLoadingComments(false);
        });

        return unsubscribe;
    }, [showComments, post.id]);

    const displayedUsername = post.user?.username || 'Pengguna Dihapus';
    const initialLetter = displayedUsername.charAt(0).toUpperCase();

    const isVideo = (post.mediaUrl && (/\.(mp4|webm|ogg|mov)$/i.test(post.mediaUrl) || post.mediaType === 'video')) && !mediaEmbed;
    const isImage = (post.mediaUrl && (/\.(jpg|jpeg|png|gif|webp)$/i.test(post.mediaUrl) || post.mediaType === 'image')) && !mediaEmbed;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl mb-6 border border-gray-100 transition-all duration-300 hover:border-indigo-200 relative">
             {/* Label Shorts */}
             {post.isShort && (
                <div className="absolute top-6 right-6 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center shadow-sm">
                    <Film size={12} className="mr-1" /> SHORTS
                </div>
            )}

            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                    {post.user?.photoURL ? (
                         <img 
                            src={post.user.photoURL}
                            alt={`${displayedUsername} PFP`}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 cursor-pointer border border-gray-200"
                            onClick={() => goToProfile(post.userId)}
                        />
                    ) : (
                        <div 
                            className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 cursor-pointer"
                            onClick={() => goToProfile(post.userId)}
                        >
                            {initialLetter}
                        </div>
                    )}
                    
                    <div>
                        <p 
                            className="font-semibold text-gray-800 hover:text-indigo-600 transition cursor-pointer"
                            onClick={() => goToProfile(post.userId)}
                        >
                            {displayedUsername} {isDeveloper && <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full">DEV</span>}
                        </p>
                        <div className="flex items-center text-xs text-gray-500" title={formattedTime.full}>
                             <Calendar size={12} className="mr-1"/>
                             <p>{formattedTime.relative}</p>
                        </div>
                    </div>
                </div>

                <div className='flex space-x-2 items-center mt-8 sm:mt-0'>
                    {!isOwner && post.userId !== currentUserId && (
                        <button
                            onClick={() => handleFollowToggle(post.userId, isFollowing)}
                            className={`px-3 py-1 text-sm rounded-full transition font-medium shadow-sm ${isFollowing ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            title={isFollowing ? 'Berhenti Mengikuti' : 'Ikuti Pengguna Ini'}
                        >
                            {isFollowing ? <UserCheck size={16} className='inline mr-1'/> : <UserPlus size={16} className='inline mr-1'/>}
                            {isFollowing ? 'Mengikuti' : 'Ikuti'}
                        </button>
                    )}

                    {canEditOrDelete && (
                        <div className="flex space-x-2">
                            <button 
                                onClick={() => { setIsEditing(true); setIsDeleting(false); }}
                                className="p-2 rounded-full text-indigo-600 hover:bg-indigo-50 transition"
                                title="Edit Postingan"
                            >
                                <Edit size={20} />
                            </button>
                            <button 
                                onClick={handleDelete}
                                className={`p-2 rounded-full transition ${isDeleting ? 'bg-red-500 text-white shadow-md' : 'text-red-500 hover:bg-red-100'}`}
                                title={isDeleting ? "Klik lagi untuk Konfirmasi Hapus" : "Hapus Postingan"}
                            >
                                {isDeleting ? <Check size={20} /> : <Trash2 size={20} />}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Mode TAMPIL / EDIT */}
            {isEditing ? (
                <div className='space-y-4 pt-2 pb-4'>
                    <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        placeholder="Judul Postingan"
                        className="w-full text-xl font-bold p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        placeholder="Konten Anda"
                        rows="6"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    />
                    <input
                        type="url"
                        value={editedMediaUrl}
                        onChange={(e) => setEditedMediaUrl(e.target.value)}
                        placeholder="Link Media (Gambar/Video/YouTube)"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />

                    <div className="flex justify-end space-x-2">
                         <button 
                            onClick={() => {
                                setIsEditing(false);
                                setEditedTitle(post.title || '');
                                setEditedContent(post.content || '');
                                setEditedMediaUrl(post.mediaUrl || '');
                            }}
                            className="flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                        >
                            <X size={20} />
                            <span>Batal</span>
                        </button>
                        <button 
                            onClick={handleUpdatePost}
                            className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-md"
                        >
                            <Save size={20} />
                            <span>Simpan Perubahan</span>
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {post.title && (
                        <h3 className="text-xl font-bold text-gray-900 mb-3 border-b pb-1">
                            {post.title}
                        </h3>
                    )}

                    <div className="mb-4">
                        {renderMarkdown(displayedContent)}
                        
                        {isLongText && (
                            <button 
                                onClick={() => setShowFullContent(!showFullContent)}
                                className="text-indigo-600 font-medium text-sm mt-1 hover:underline flex items-center"
                            >
                                {showFullContent ? 'Sembunyikan' : 'Baca Selengkapnya'}
                                <ChevronRight size={16} className={`ml-1 transition-transform ${showFullContent ? 'rotate-90' : ''}`} />
                            </button>
                        )}
                    </div>

                    {(isImage || isVideo || mediaEmbed) && (
                        <div className="mb-4">
                             {isImage && (
                                <img 
                                    src={post.mediaUrl} 
                                    alt="Post Media" 
                                    className="w-full max-h-[50vh] object-cover rounded-lg mb-4 border border-gray-200 shadow-sm" 
                                    onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/600x400/CCCCCC/000000?text=Gambar+Gagal+Dimuat"; }}
                                />
                            )}
                            
                            {isVideo && (
                                <video controls className="w-full max-h-[50vh] object-cover rounded-lg mb-4 border border-gray-200 shadow-sm">
                                    <source src={post.mediaUrl} type="video/mp4" />
                                    Browser Anda tidak mendukung tag video.
                                </video>
                            )}
                            
                            {mediaEmbed && mediaEmbed.type === 'youtube' && (
                                <div className="relative pt-[56.25%] rounded-lg overflow-hidden shadow-lg border border-gray-200">
                                    <iframe
                                        src={mediaEmbed.embedUrl}
                                        title="Embedded Video"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="absolute top-0 left-0 w-full h-full border-0"
                                    ></iframe>
                                </div>
                            )}
                             {mediaEmbed && mediaEmbed.type === 'link' && (
                                <a 
                                    href={mediaEmbed.displayUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-2 bg-indigo-50 p-3 rounded-lg border border-indigo-200 shadow-sm transition hover:shadow-md"
                                >
                                    <Link size={18} />
                                    <span>Lihat tautan {mediaEmbed.platform}</span>
                                </a>
                            )}
                        </div>
                    )}
                </>
            )}


            <div className="flex items-center justify-between text-gray-600 border-t pt-3">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={handleLike} 
                        className={`flex items-center space-x-1 px-3 py-2 rounded-full transition ${isLiked ? 'text-red-500 bg-red-50' : 'hover:text-red-500 hover:bg-gray-100'}`}
                        disabled={!currentUserId}
                    >
                        <Heart size={20} fill={isLiked ? '#ef4444' : 'none'} strokeWidth={isLiked ? 1.5 : 2} />
                        <span className="text-sm font-medium">{post.likes?.length || 0} Suka</span>
                    </button>
                    <button 
                        onClick={() => setShowComments(!showComments)} 
                        className={`flex items-center space-x-1 px-3 py-2 rounded-full transition ${showComments ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:text-indigo-500 hover:bg-gray-100'}`}
                    >
                        <MessageSquare size={20} />
                        <span className="text-sm font-medium">{post.commentsCount || 0} Komentar</span>
                    </button>
                    <button 
                        onClick={handleShare} 
                        className={`flex items-center space-x-1 px-3 py-2 rounded-full transition text-gray-600 hover:text-green-600 hover:bg-green-50`}
                        title="Bagikan Postingan Ini"
                    >
                        <Share2 size={20} />
                        <span className="text-sm font-medium hidden sm:inline">Bagikan</span>
                    </button>
                </div>
            </div>

            {showComments && (
                <div className="mt-4 border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Komentar ({comments.length})</h4>
                    
                    <form onSubmit={handleComment} className="flex space-x-2 mb-4">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Tulis komentar..."
                            className="flex-grow p-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={!currentUserId}
                        />
                        <button 
                            type="submit"
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition disabled:bg-indigo-300 font-medium shadow-md"
                            disabled={!currentUserId || !newComment.trim()}
                        >
                            <Send size={20} />
                        </button>
                    </form>

                    {isLoadingComments ? (
                        <div className="flex justify-center p-4 text-indigo-600"><Loader2 className="animate-spin" size={24} /></div>
                    ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {comments.map((comment) => (
                                <div key={comment.id} className="text-sm bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <p className="font-semibold text-gray-800 flex justify-between items-center">
                                        {comment.username || 'Anonim'} 
                                        <span className="text-xs text-gray-500 font-normal">
                                            {formatTimeAgo(comment.timestamp).relative}
                                        </span>
                                    </p>
                                    <p className="text-gray-700 mt-1">{comment.text}</p>
                                </div>
                            ))}
                            {comments.length === 0 && <p className="text-center text-gray-500 text-sm py-4">Belum ada komentar.</p>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


// --- 6. KOMPONEN BUAT POSTINGAN (CreatePost) ---
const CreatePost = ({ setPage, userId, username }) => {
    const [title, setTitle] = useState(''); 
    const [content, setContent] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaType, setMediaType] = useState('text'); 
    const [isLoading, setIsLoading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [progress, setProgress] = useState(0); 
    const [isShort, setIsShort] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setMediaFile(file);
            setMediaUrl(''); 
            if (file.type.startsWith('image/')) {
                setMediaType('image');
                setIsShort(false);
            } else if (file.type.startsWith('video/')) {
                 setMediaType('video');
            } else {
                setMediaType('media');
                setIsShort(false);
            }
        }
    };

    const handleUrlChange = (e) => {
        setMediaUrl(e.target.value);
        setMediaFile(null); 
        setMediaType('link');
        setIsShort(false);
    };

    const handleProgressUpdate = useCallback((newProgress) => {
        setProgress(newProgress);
    }, []);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploadError(''); 
        if (!content.trim() && !mediaFile && !mediaUrl) {
            setUploadError('Tolong masukkan konten teks, unggah media, atau berikan link.');
            return;
        }

        setIsLoading(true);
        setProgress(0);
        let finalMediaUrl = '';
        let finalMediaType = mediaType;

        try {
            if (mediaFile) {
                finalMediaUrl = await uploadToFaaAPI(mediaFile, handleProgressUpdate);
                finalMediaType = mediaFile.type.startsWith('image/') ? 'image' : 'video';

            } else if (mediaUrl) {
                finalMediaUrl = mediaUrl;
                finalMediaType = 'link';
            } else {
                finalMediaType = 'text';
                setProgress(100); 
            }

            if (finalMediaType !== 'text' && progress < 100) {
                 setProgress(95); 
                 await new Promise(resolve => setTimeout(resolve, 500));
            }

            const postsRef = collection(db, getPublicCollection('posts'));
            await addDoc(postsRef, {
                userId,
                title: title.trim(), 
                content: content.trim(),
                mediaUrl: finalMediaUrl,
                mediaType: finalMediaType,
                timestamp: serverTimestamp(),
                likes: [],
                commentsCount: 0,
                isShort: isShort && finalMediaType === 'video', // Flag untuk Shorts
                user: { username: username, uid: userId } 
            });
            
            setProgress(100);
            await new Promise(resolve => setTimeout(resolve, 300));

            setTitle('');
            setContent('');
            setMediaFile(null);
            setMediaUrl('');
            setMediaType('text');
            setIsShort(false);
            // Arahkan ke Shorts jika itu Shorts, jika tidak ke Home
            setPage(isShort && finalMediaType === 'video' ? 'shorts' : 'home');
        } catch (error) {
            console.error("Gagal memposting:", error);
            setUploadError(`Gagal memposting: ${error.message || 'Terjadi kesalahan tidak dikenal.'}`);
            setProgress(0); 
        } finally {
            setIsLoading(false);
            setProgress(0); 
        }
    };

    return (
        <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-2xl border border-indigo-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">Buat Postingan Baru</h2>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-4 text-sm text-indigo-700 font-medium">
                Anda memposting sebagai: **{username}**
            </div>

            {uploadError && (
                 <div className="p-3 mb-4 rounded-lg text-sm bg-red-100 text-red-700 border border-red-300">
                    {uploadError}
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {isLoading && (
                    <div className="mt-4">
                        <div className="text-sm font-semibold text-indigo-600 mb-1 flex justify-between">
                            <span>Mengunggah Media ({mediaFile ? 'File' : 'Teks'})...</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}
                
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Judul Postingan (Opsional)"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isLoading}
                />

                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Konten Anda (tekan Enter untuk baris baru)"
                    rows="6"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    disabled={isLoading}
                />

                <div className="flex items-center text-sm text-gray-600 bg-gray-100 p-3 rounded-lg border border-gray-200">
                    <Code size={16} className="mr-2 text-indigo-500 flex-shrink-0"/>
                    <span>Gunakan format Markdown: **tebal**, *miring*, atau `kode` inline.</span>
                </div>


                <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                    <label className={`flex items-center space-x-2 text-indigo-600 cursor-pointer p-3 rounded-lg border border-indigo-200 transition flex-1 w-full ${isLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 hover:bg-indigo-100'}`}>
                        <Image size={20} />
                        <span>{mediaFile ? mediaFile.name : 'Unggah File (Gambar/Video)'}</span>
                        <input 
                            type="file" 
                            accept="image/*,video/*"
                            onChange={handleFileChange} 
                            className="hidden" 
                            disabled={isLoading || !!mediaUrl} 
                        />
                    </label>

                    <div className="flex-1 w-full">
                        <div className={`flex items-center space-x-2 text-green-600 p-3 rounded-lg border transition ${isLoading ? 'bg-gray-100 text-gray-400 border-gray-300' : 'bg-green-50 border-green-200'}`}>
                            <Link size={20} />
                            <input 
                                type="url" 
                                value={mediaUrl}
                                onChange={handleUrlChange} 
                                placeholder="Link YouTube/Media Eksternal" 
                                className="w-full bg-transparent outline-none placeholder-gray-500"
                                disabled={isLoading || !!mediaFile} 
                            />
                        </div>
                    </div>
                </div>
                
                {/* Pilihan Shorts - Muncul hanya jika Video */}
                {mediaType === 'video' && (
                    <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 cursor-pointer" onClick={() => setIsShort(!isShort)}>
                        <div className={`w-6 h-6 rounded border border-red-600 flex items-center justify-center transition ${isShort ? 'bg-red-600' : 'bg-white'}`}>
                            {isShort && <Check size={16} className="text-white" />}
                        </div>
                        <div className="flex items-center">
                            <Film size={18} className="mr-2" />
                            <span className="font-semibold">Posting sebagai Video Pendek (Shorts)</span>
                        </div>
                    </div>
                )}

                <p className="text-xs text-gray-500 text-center pt-2">
                    {mediaFile ? `File: ${mediaFile.name} akan diunggah.` : mediaUrl ? `Link: ${mediaUrl} akan di-embed.` : 'Pilih file atau masukkan link untuk media.'}
                </p>

                <button
                    type="submit"
                    disabled={isLoading || (!content.trim() && !mediaFile && !mediaUrl)}
                    className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:bg-indigo-300 shadow-lg transform hover:scale-[1.01] duration-150"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            <span>Mengunggah ({Math.round(progress)}%)...</span>
                        </>
                    ) : (
                        <span>Posting Sekarang</span>
                    )}
                </button>
            </form>
        </div>
    );
};


// --- 7. KOMPONEN BERANDA (HomeScreen) ---
const HomeScreen = ({ currentUserId, currentUserEmail, profile, handleFollowToggle, goToProfile, allPosts, isLoadingPosts }) => {
    const [feedType, setFeedType] = useState('foryou'); 

    // Filter post based on feed type and sort
    const processedPosts = useMemo(() => {
        let list = [...allPosts];

        // 1. "Untuk Anda" (For You) - Algoritma Kompleks (Simulasi)
        // Filter: Campuran Postingan Baru + Postingan dengan Like Banyak + Random
        if (feedType === 'foryou') {
             // Berikan skor: (Likes * 2) + (Komentar * 3)
             // Tapi acak sedikit agar tidak membosankan
             list = list.sort((a, b) => {
                const scoreA = (a.likes?.length || 0) * 2 + (a.commentsCount || 0) * 3 + Math.random() * 5;
                const scoreB = (b.likes?.length || 0) * 2 + (b.commentsCount || 0) * 3 + Math.random() * 5;
                return scoreB - scoreA;
             });
             // Ambil 50 teratas saja agar performa bagus
             return list.slice(0, 50);
        }

        // 2. "Terpopuler" - Urutkan berdasarkan Likes terbanyak
        if (feedType === 'popular') {
            list.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
            return list;
        }

        // 3. "Terbaru" - Murni kronologis
        if (feedType === 'latest') {
            list.sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
                return timeB - timeA; 
            });
            return list;
        }

        return list;

    }, [allPosts, feedType]);


    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Beranda Untuk Anda</h1>
            <p className="text-gray-500 mb-6 text-sm">Konten yang dipilih khusus berdasarkan interaksi komunitas.</p>
            
            <div className="flex space-x-2 border-b pb-3 mb-6 overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setFeedType('foryou')}
                    className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full font-semibold transition shadow-sm ${feedType === 'foryou' ? 'bg-indigo-600 text-white' : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'}`}
                >
                    <Shuffle size={18} />
                    <span>Untuk Anda</span>
                </button>
                <button 
                    onClick={() => setFeedType('popular')}
                    className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full font-semibold transition shadow-sm ${feedType === 'popular' ? 'bg-red-500 text-white' : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'}`}
                >
                    <Flame size={18} />
                    <span>Terpopuler</span>
                </button>
                <button 
                    onClick={() => setFeedType('latest')}
                    className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full font-semibold transition shadow-sm ${feedType === 'latest' ? 'bg-green-600 text-white' : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'}`}
                >
                    <TrendingUp size={18} />
                    <span>Terbaru</span>
                </button>
            </div>

            {isLoadingPosts ? (
                <div className="flex flex-col items-center justify-center h-48 text-indigo-600 bg-white p-8 rounded-xl shadow-md">
                    <Loader2 className="animate-spin" size={32} />
                    <p className="mt-2 text-lg">Meracik Algoritma...</p>
                </div>
            ) : processedPosts.length === 0 ? (
                <div className="text-center p-8 bg-white rounded-xl text-gray-500 shadow-md border border-gray-200">
                    <p>Tidak ada postingan di filter ini.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {processedPosts.map(post => (
                        <PostItem 
                            key={post.id} 
                            post={post} 
                            currentUserId={currentUserId} 
                            currentUserEmail={currentUserEmail}
                            profile={profile}
                            handleFollowToggle={handleFollowToggle}
                            goToProfile={goToProfile}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- 8. KOMPONEN SHORTS (Baru) ---
const ShortsScreen = ({ allPosts, currentUserId, handleFollowToggle, profile }) => {
    // Filter hanya video yang ditandai short atau tipe video
    const shortVideos = useMemo(() => {
        return allPosts.filter(p => 
            (p.mediaType === 'video' || p.isShort === true) && p.mediaUrl
        );
    }, [allPosts]);

    return (
        <div className="fixed inset-0 bg-black z-50 flex justify-center overflow-hidden pt-16 sm:pt-0">
            <div className="w-full max-w-md h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
                {shortVideos.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white p-8 text-center">
                        <Film size={48} className="mb-4 text-gray-500"/>
                        <p className="text-xl font-bold">Belum ada video Shorts.</p>
                        <p className="text-gray-400 mt-2">Jadilah yang pertama memposting video pendek!</p>
                    </div>
                ) : (
                    shortVideos.map((post) => (
                        <ShortItem 
                            key={post.id} 
                            post={post} 
                            currentUserId={currentUserId}
                            handleFollowToggle={handleFollowToggle}
                            profile={profile}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

const ShortItem = ({ post, currentUserId, handleFollowToggle, profile }) => {
    const isLiked = post.likes && post.likes.includes(currentUserId);
    const isFollowing = profile.following?.includes(post.userId);
    
    const handleLike = async (e) => {
        e.stopPropagation();
        if (!currentUserId) return;
        const postRef = doc(db, `artifacts/${appId}/public/data/posts`, post.id);
        try {
            if (isLiked) {
                await updateDoc(postRef, { likes: arrayRemove(currentUserId) });
            } else {
                await updateDoc(postRef, { likes: arrayUnion(currentUserId) });
            }
        } catch (error) {
            console.error("Like Error:", error);
        }
    };

    return (
        <div className="snap-start w-full h-full relative bg-gray-900 flex items-center justify-center border-b border-gray-800">
            {/* Video Container */}
            <video 
                src={post.mediaUrl} 
                className="w-full h-full object-contain" 
                controls={false}
                autoPlay 
                muted 
                loop 
                playsInline
                onClick={(e) => e.target.muted = !e.target.muted} // Klik untuk unmute
            />
            
            {/* Overlay Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent text-white">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-bold">
                             {post.user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-shadow-sm">{post.user?.username}</p>
                            {!isFollowing && post.userId !== currentUserId && (
                                <button 
                                    onClick={() => handleFollowToggle(post.userId, false)}
                                    className="text-xs bg-red-600 px-2 py-1 rounded text-white font-bold mt-1"
                                >
                                    Ikuti
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <p className="text-sm line-clamp-2 mb-2">{post.content}</p>
                <p className="text-xs text-gray-400">{formatTimeAgo(post.timestamp).relative}</p>
            </div>

            {/* Action Buttons (Right Side) */}
            <div className="absolute right-2 bottom-20 flex flex-col items-center space-y-6 z-10">
                <button onClick={handleLike} className="flex flex-col items-center">
                    <div className={`p-3 rounded-full bg-black/40 backdrop-blur-sm ${isLiked ? 'text-red-500' : 'text-white'}`}>
                        <Heart size={28} fill={isLiked ? 'currentColor' : 'none'} />
                    </div>
                    <span className="text-white text-xs mt-1 font-bold drop-shadow-md">{post.likes?.length || 0}</span>
                </button>
                
                <button className="flex flex-col items-center">
                    <div className="p-3 rounded-full bg-black/40 backdrop-blur-sm text-white">
                        <MessageSquare size={28} />
                    </div>
                    <span className="text-white text-xs mt-1 font-bold drop-shadow-md">{post.commentsCount || 0}</span>
                </button>

                <button onClick={() => navigator.clipboard.writeText(window.location.origin + '?post=' + post.id)} className="flex flex-col items-center">
                     <div className="p-3 rounded-full bg-black/40 backdrop-blur-sm text-white">
                        <Share2 size={28} />
                    </div>
                    <span className="text-white text-xs mt-1 font-bold drop-shadow-md">Share</span>
                </button>
            </div>
        </div>
    );
}

// --- 9. KOMPONEN SINGLE POST (Tampilan Dari Share Link) ---
const SinglePostView = ({ postId, allPosts, goBack, ...props }) => {
    const post = allPosts.find(p => p.id === postId);

    if (!post) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                <p className="text-gray-600">Mencari postingan atau postingan telah dihapus...</p>
                <button onClick={goBack} className="mt-4 text-indigo-600 font-bold hover:underline">Kembali ke Beranda</button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pt-4">
            <button onClick={goBack} className="flex items-center text-indigo-600 font-semibold mb-4 hover:bg-indigo-50 p-2 rounded-lg w-fit transition">
                <ArrowLeft size={20} className="mr-2" /> Kembali ke Beranda
            </button>
            <PostItem post={post} {...props} />
        </div>
    );
}


// --- 10. KOMPONEN AKUN (ProfileScreen) ---
const ProfileScreen = ({ currentUserId, username, email, allPosts, currentUserEmail, photoURL, isSelf, handleFollowToggle, profile }) => {
    const [userPosts, setUserPosts] = useState([]);
    const [isEditingPFP, setIsEditingPFP] = useState(false);
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState(username);
    const [newPhotoUrl, setNewPhotoUrl] = useState(photoURL || '');
    const [pfpFile, setPfpFile] = useState(null);
    const [isLoadingPFP, setIsLoadingPFP] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [progress, setProgress] = useState(0); 
    const [usernameError, setUsernameError] = useState('');

    useEffect(() => {
        const filteredPosts = allPosts
            .filter(post => post.userId === currentUserId)
            .sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
                return timeB - timeA; 
            });
            
        setUserPosts(filteredPosts);
    }, [allPosts, currentUserId]);

    // Handle PFP Upload
    const handlePhotoFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPfpFile(file);
            setNewPhotoUrl('');
            setUploadError('');
        }
    };
    
    const handleSavePFP = async () => {
        setIsLoadingPFP(true);
        setUploadError('');
        setProgress(0);
        let finalUrl = newPhotoUrl.trim();

        try {
            if (pfpFile) {
                finalUrl = await uploadToFaaAPI(pfpFile, setProgress);
            } else if (!finalUrl) {
                finalUrl = '';
            }

            const profileRef = doc(db, getPublicCollection('userProfiles'), currentUserId);
            await updateDoc(profileRef, {
                photoURL: finalUrl
            });

            setIsEditingPFP(false);
            setPfpFile(null);
            setNewPhotoUrl(finalUrl);
        } catch (error) {
            console.error("Gagal menyimpan PFP:", error);
            setUploadError(error.message || "Gagal mengunggah gambar profil.");
            setProgress(0);
        } finally {
            setIsLoadingPFP(false);
        }
    };

    // Handle Username Update
    const handleUpdateUsername = async () => {
        setUsernameError('');
        const trimmedUsername = newUsername.trim();

        if (trimmedUsername.length < 3) {
            setUsernameError('Username minimal 3 karakter.');
            return;
        }
        if (trimmedUsername === username) {
            setIsEditingUsername(false);
            return;
        }

        try {
            const profileRef = doc(db, getPublicCollection('userProfiles'), currentUserId);
            await updateDoc(profileRef, {
                username: trimmedUsername
            });

            // Update all posts belonging to this user with the new username
            const batchPromises = allPosts
                .filter(post => post.userId === currentUserId)
                .map(post => updateDoc(doc(db, getPublicCollection('posts'), post.id), {
                    'user.username': trimmedUsername 
                }));
            
            await Promise.all(batchPromises);

            setIsEditingUsername(false);
        } catch (error) {
            console.error("Gagal mengupdate username:", error);
            setUsernameError('Gagal mengupdate. Coba lagi nanti.');
        }
    };

    const isDeveloper = currentUserEmail === DEVELOPER_EMAIL;
    const initialLetter = username.charAt(0).toUpperCase();
    const isFollowing = profile.following?.includes(currentUserId);


    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-2xl mb-8 border border-indigo-100">
                <div className="flex items-start space-x-4">
                    {/* FOTO PROFIL */}
                    <div className="relative">
                        {photoURL ? (
                            <img 
                                src={photoURL} 
                                alt={`${username} PFP`} 
                                className="w-20 h-20 rounded-full object-cover border-4 border-indigo-200 flex-shrink-0"
                            />
                        ) : (
                            <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 border-4 border-indigo-200">
                                {initialLetter}
                            </div>
                        )}
                        {isSelf && (
                            <button
                                onClick={() => setIsEditingPFP(!isEditingPFP)}
                                className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full text-indigo-600 border border-indigo-300 shadow-md hover:bg-indigo-50 transition"
                                title="Ubah Foto Profil"
                            >
                                <Edit size={16} />
                            </button>
                        )}
                    </div>
                    
                    <div className='flex-grow'>
                        {/* USERNAME DISPLAY / EDIT */}
                        <div className='flex items-center space-x-2'>
                            {isEditingUsername ? (
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className={`text-2xl font-extrabold text-gray-900 border-b border-indigo-400 focus:outline-none focus:border-indigo-600 w-full ${usernameError ? 'border-red-500' : ''}`}
                                />
                            ) : (
                                <h1 className="text-3xl font-extrabold text-gray-900">{username}</h1>
                            )}
                            {isSelf && (
                                <button
                                    onClick={() => isEditingUsername ? handleUpdateUsername() : setIsEditingUsername(true)}
                                    className={`p-1.5 rounded-full transition ${isEditingUsername ? 'bg-green-500 text-white hover:bg-green-600' : 'text-gray-500 hover:bg-gray-100'}`}
                                    title={isEditingUsername ? "Simpan Username" : "Edit Username"}
                                >
                                    {isEditingUsername ? <Check size={20} /> : <Edit size={20} />}
                                </button>
                            )}
                        </div>
                        {usernameError && <p className='text-sm text-red-500 mt-1'>{usernameError}</p>}


                        <p className="text-gray-500 text-sm flex items-center mt-1">
                             <Mail size={14} className="mr-1 text-gray-400"/> {email} {isDeveloper && <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full ml-2 font-medium">DEVELOPER</span>}
                        </p>
                        <p className="text-gray-400 text-xs break-all flex items-center mt-1">
                            <Code size={14} className="mr-1 text-gray-400"/>
                            <span className='font-medium'>ID:</span> {currentUserId}
                        </p>
                    </div>

                    {!isSelf && (
                        <button
                            onClick={() => handleFollowToggle(currentUserId, isFollowing)}
                            className={`px-4 py-2 text-sm rounded-full font-semibold transition shadow-md ${isFollowing ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                            {isFollowing ? 'Mengikuti' : 'Ikuti'}
                        </button>
                    )}
                </div>

                {/* Edit PFP Section */}
                {isEditingPFP && isSelf && (
                    <div className="mt-6 pt-4 border-t space-y-3 bg-gray-50 p-4 rounded-xl">
                        <h3 className="font-semibold text-gray-800">Ubah Foto Profil</h3>
                        {uploadError && <div className="p-2 text-sm rounded-lg bg-red-100 text-red-700 border border-red-300">{uploadError}</div>}
                        
                         {isLoadingPFP && (
                            <div className="mt-2">
                                <div className="text-sm font-semibold text-indigo-600 mb-1 flex justify-between">
                                    <span>Mengunggah PFP...</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-2">
                            <label className="flex items-center space-x-2 text-indigo-600 cursor-pointer p-3 rounded-lg bg-indigo-100 hover:bg-indigo-200 transition flex-1 w-full border border-indigo-300">
                                <Image size={20} />
                                <span>{pfpFile ? pfpFile.name : 'Unggah File Gambar'}</span>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handlePhotoFileChange} 
                                    className="hidden" 
                                    disabled={isLoadingPFP}
                                />
                            </label>
                            <span className='text-gray-500 font-medium'>ATAU</span>
                             <input
                                type="url"
                                value={newPhotoUrl}
                                onChange={(e) => {setNewPhotoUrl(e.target.value); setPfpFile(null);}}
                                placeholder="Masukkan URL Gambar"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 flex-1"
                                disabled={isLoadingPFP || !!pfpFile}
                            />
                        </div>

                        <div className="flex justify-end space-x-2 pt-2">
                            <button 
                                onClick={() => {setIsEditingPFP(false); setPfpFile(null); setNewPhotoUrl(photoURL || '');}}
                                className="flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                            >
                                <X size={20} />
                                <span>Batal</span>
                            </button>
                            <button 
                                onClick={handleSavePFP}
                                disabled={isLoadingPFP}
                                className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-indigo-300 font-medium shadow-md"
                            >
                                <Save size={20} />
                                <span>Simpan PFP</span>
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Statistik Perkenalan */}
                <div className="flex justify-around text-center mt-6 border-t pt-4">
                    <div>
                        <p className="text-2xl font-bold text-gray-800">{profile.followers?.length || 0}</p>
                        <p className="text-sm text-gray-500">Pengikut</p>
                    </div>
                     <div>
                        <p className="text-2xl font-bold text-gray-800">{profile.following?.length || 0}</p>
                        <p className="text-sm text-gray-500">Mengikuti</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-800">{userPosts.length}</p>
                        <p className="text-sm text-gray-500">Postingan</p>
                    </div>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-4">{isSelf ? 'Postingan Anda' : `Postingan ${username}`} ({userPosts.length})</h2>
            
            <div className="space-y-6">
                {userPosts.length === 0 ? (
                    <div className="text-center p-8 bg-white rounded-xl text-gray-500 shadow-md border border-gray-200">
                        <p>{isSelf ? 'Anda belum membuat postingan apa pun.' : `${username} belum memiliki postingan.`}</p>
                    </div>
                ) : (
                    userPosts.map(post => (
                        <PostItem 
                            key={post.id} 
                            post={post} 
                            currentUserId={profile.uid} 
                            currentUserEmail={profile.email}
                            profile={profile}
                            handleFollowToggle={handleFollowToggle}
                            goToProfile={() => {}} // Non-aktifkan klik di sini
                        />
                    ))
                )}
            </div>
        </div>
    );
};


// --- 11. KOMPONEN PENCARIAN (SearchScreen) ---

const SearchScreen = ({ allPosts, allUsers, profile, handleFollowToggle, goToProfile }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('posts'); 
    
    // Optimasi: Hanya memfilter jika searchTerm cukup panjang
    const isSearchable = searchTerm.length >= 2;

    const filteredPosts = useMemo(() => {
        if (!isSearchable) return [];
        const term = searchTerm.toLowerCase();
        return allPosts.filter(post => 
            post.title?.toLowerCase().includes(term) || 
            post.content?.toLowerCase().includes(term) ||
            post.user?.username?.toLowerCase().includes(term)
        );
    }, [searchTerm, allPosts, isSearchable]);

    const filteredUsers = useMemo(() => {
        if (!isSearchable) return [];
        const term = searchTerm.toLowerCase();
        return allUsers.filter(user => 
            user.username?.toLowerCase().includes(term) && user.uid !== profile.uid
        );
    }, [searchTerm, allUsers, profile.uid, isSearchable]);

    const handleUserClick = (userId) => {
        goToProfile(userId);
    };

    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-6">Pencarian Komunitas</h1>

            <div className="relative mb-6">
                <Search size={24} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari Postingan, Judul, atau Username..."
                    className="w-full pl-12 pr-4 py-3 border border-indigo-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition shadow-md text-lg"
                />
            </div>

            <div className="flex space-x-4 border-b pb-1 mb-6">
                <button 
                    onClick={() => setActiveTab('posts')}
                    className={`pb-2 font-semibold transition border-b-2 ${activeTab === 'posts' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:border-gray-300'}`}
                >
                    Postingan ({isSearchable ? filteredPosts.length : 0})
                </button>
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`pb-2 font-semibold transition border-b-2 ${activeTab === 'users' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:border-gray-300'}`}
                >
                    Pengguna ({isSearchable ? filteredUsers.length : 0})
                </button>
            </div>
            
            {!isSearchable && <div className="text-center p-8 bg-white rounded-xl text-gray-500 shadow-md border border-gray-200">Masukkan minimal 2 karakter untuk memulai pencarian.</div>}

            {isSearchable && (
                <>
                    {activeTab === 'posts' && (
                        <div className="space-y-6">
                            {filteredPosts.length > 0 ? (
                                filteredPosts.map(post => (
                                    <PostItem 
                                        key={post.id} 
                                        post={post} 
                                        currentUserId={profile.uid} 
                                        currentUserEmail={profile.email}
                                        profile={profile}
                                        handleFollowToggle={handleFollowToggle}
                                        goToProfile={goToProfile}
                                    />
                                ))
                            ) : (
                                <div className="text-center p-8 bg-white rounded-xl text-gray-500 shadow-md border border-gray-200">Tidak ada postingan yang cocok.</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-4">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <div 
                                        key={user.uid} 
                                        className="flex items-center justify-between bg-white p-4 rounded-xl shadow-md border border-gray-100 hover:bg-indigo-50 transition"
                                    >
                                        <div className='flex items-center space-x-3 cursor-pointer' onClick={() => handleUserClick(user.uid)}>
                                            {user.photoURL ? (
                                                <img 
                                                    src={user.photoURL}
                                                    alt={`${user.username} PFP`}
                                                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-gray-200"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-semibold text-gray-800 text-lg hover:text-indigo-600">{user.username}</p>
                                                <p className="text-sm text-gray-500">{user.email}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleFollowToggle(user.uid, profile.following?.includes(user.uid))}
                                            className={`px-4 py-2 text-sm rounded-full font-semibold transition shadow-sm ${profile.following?.includes(user.uid) ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                        >
                                            {profile.following?.includes(user.uid) ? 'Mengikuti' : 'Ikuti'}
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center p-8 bg-white rounded-xl text-gray-500 shadow-md border border-gray-200">Tidak ada pengguna yang cocok.</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};


// --- 12. KOMPONEN UTAMA (App) ---

const App = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [profile, setProfile] = useState(null); 
    const [targetProfileId, setTargetProfileId] = useState(null); 
    const [page, setPage] = useState('home'); 
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [allPosts, setAllPosts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [targetPostId, setTargetPostId] = useState(null); // Untuk fitur Share/Deep link

    // Cek apakah ada parameter 'post' di URL saat web dimuat (Deep Link)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const postId = params.get('post');
        if (postId) {
            console.log("Deep link terdeteksi ke post:", postId);
            setTargetPostId(postId);
            setPage('view_post');
        }
    }, []);

    // 1. Langganan perubahan otentikasi (Auth State)
    useEffect(() => {
        const handleInitialAuth = async () => {
            // PERBAIKAN: Penanganan error yang lebih aman
            if (initialAuthToken) {
                try {
                    await signInWithCustomToken(auth, initialAuthToken);
                } catch (error) {
                     console.warn("Otentikasi token kustom gagal, silakan login manual:", error.message);
                     // JANGAN mencoba signInAnonymously di sini jika menyebabkan error 'admin-restricted-operation'.
                     // Biarkan aplikasi mengalir ke state 'no user' sehingga AuthScreen muncul.
                }
            } 
            // Tidak ada 'else' untuk mencoba anonim secara otomatis untuk menghindari error di konsol.
        };

        // Panggil handleInitialAuth HANYA SEKALI
        if (!auth.currentUser) {
            handleInitialAuth();
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            // Hanya set user jika non-anonim
            if (user && !user.isAnonymous) { 
                setCurrentUser(user);
            } else {
                // Hapus state pada logout atau jika anonim
                setCurrentUser(null);
                setProfile(null); 
            }
            setIsAuthChecking(false);
        });
        
        return unsubscribe; 
    }, []);
    
    // 2. Langganan perubahan profil pengguna (Profile State)
    useEffect(() => {
        if (!currentUser || !currentUser.uid) {
            setProfile(null); // Pastikan profile clear jika user null
            return;
        }

        const profileRef = doc(db, getPublicCollection('userProfiles'), currentUser.uid);

        const unsubscribe = onSnapshot(profileRef, (snap) => {
            const userEmail = currentUser.email || 'N/A';
            if (snap.exists()) {
                // Set profile dengan data dari Firestore
                setProfile({ ...snap.data(), email: userEmail, uid: currentUser.uid });
            } else {
                // INI SEHARUSNYA TIDAK TERJADI JIKA AuthScreen bekerja
                // Tapi sebagai fallback, kita set profile minimal
                console.warn(`Profil Firestore untuk UID ${currentUser.uid} tidak ditemukan. AuthScreen seharusnya membuatnya.`);
                setProfile({ 
                    username: currentUser.email?.split('@')[0] || 'Nama Pengguna', 
                    email: userEmail, 
                    uid: currentUser.uid,
                    photoURL: '', 
                    following: [], 
                    followers: [] 
                });
            }
        }, (error) => {
            console.error("Error fetching user profile in real-time:", error);
        });

        return unsubscribe;
    }, [currentUser]); // Hanya bergantung pada currentUser


    // 3. Langganan real-time untuk semua postingan publik
    useEffect(() => {
        // Jangan muat postingan jika user belum login
        if (isAuthChecking || !currentUser) {
            setAllPosts([]);
            setIsLoadingPosts(false);
            return;
        } 
        
        setIsLoadingPosts(true);
        const postsQuery = query(collection(db, getPublicCollection('posts')));

        const unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
            const fetchedPosts = snapshot.docs.map(d => ({ 
                id: d.id, 
                ...d.data(), 
                timestamp: d.data().timestamp || new Date(0) 
            }));
            
            // Map user profiles to posts
            const uniqueUserIds = [...new Set(fetchedPosts.map(p => p.userId))];
            
            // Hindari error jika tidak ada postingan
            if (uniqueUserIds.length === 0) {
                setAllPosts([]);
                setIsLoadingPosts(false);
                return;
            }

            const profilePromises = uniqueUserIds.map(uid => 
                uid ? getDoc(doc(db, getPublicCollection('userProfiles'), uid)) : Promise.resolve(null)
            );
            const profileSnaps = await Promise.all(profilePromises);
            
            const profilesMap = profileSnaps.reduce((acc, snap) => {
                if (snap && snap.exists()) {
                    acc[snap.id] = snap.data();
                }
                return acc;
            }, {});

            const postsWithProfiles = fetchedPosts.map((post) => {
                const postUser = profilesMap[post.userId] || post.user; // Ambil dari map, fallback ke data 'user' di post
                return { 
                    ...post, 
                    commentsCount: post.commentsCount || 0, 
                    likes: post.likes || [],
                    // Pastikan 'user' adalah objek yang valid
                    user: (postUser && postUser.username) ? postUser : { username: 'Pengguna Dihapus', uid: post.userId } 
                };
            });
            
            setAllPosts(postsWithProfiles);
            setIsLoadingPosts(false);

        }, (error) => {
            console.error("Error fetching all posts:", error);
            setIsLoadingPosts(false);
        });

        return unsubscribe;
    }, [isAuthChecking, currentUser]); // Hanya bergantung pada status auth
    
    // 4. Langganan real-time untuk semua profil pengguna (untuk fitur search & following)
     useEffect(() => {
        // Jangan muat data user jika belum login
        if (isAuthChecking || !currentUser) {
            setAllUsers([]);
            return;
        } 
        
        const usersQuery = query(collection(db, getPublicCollection('userProfiles')));

        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const fetchedUsers = snapshot.docs.map(d => ({ ...d.data(), id: d.id, uid: d.id })); // Pastikan uid ada
            setAllUsers(fetchedUsers);
        }, (error) => {
            console.error("Error fetching all users:", error);
        });

        return unsubscribe;
    }, [isAuthChecking, currentUser]); // Hanya bergantung pada status auth

    // FUNGSI TOGGLE FOLLOW
    const handleFollowToggle = async (targetUid, isCurrentlyFollowing) => {
        if (!profile || !profile.uid || targetUid === profile.uid) return;
        
        const userRef = doc(db, getPublicCollection('userProfiles'), profile.uid);
        const targetRef = doc(db, getPublicCollection('userProfiles'), targetUid);

        try {
            if (isCurrentlyFollowing) {
                // Unfollow
                await updateDoc(userRef, { following: arrayRemove(targetUid) });
                await updateDoc(targetRef, { followers: arrayRemove(profile.uid) });
            } else {
                // Follow
                await updateDoc(userRef, { following: arrayUnion(targetUid) });
                await updateDoc(targetRef, { followers: arrayUnion(profile.uid) });
            }
        } catch (error) {
            console.error("Gagal mengubah status following:", error);
        }
    };
    
    // FUNGSI PINDAH KE PROFIL ORANG LAIN
    const goToProfile = (uid) => {
        if (uid === profile?.uid) {
            setPage('profile'); // Jika itu profil sendiri, buka halaman profil
            setTargetProfileId(null);
        } else {
            setTargetProfileId(uid);
            setPage('other-profile');
        }
    };


    const handleLogout = async () => {
        try {
            await signOut(auth);
            // State akan di-clear oleh onAuthStateChanged listener
            setPage('home'); 
            setTargetProfileId(null);
        } catch (error) {
            console.error("Gagal Logout:", error);
        }
    };

    if (isAuthChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 text-indigo-600">
                <Loader2 className="animate-spin" size={48} />
                <p className="ml-3 text-xl">Memeriksa status otentikasi...</p>
            </div>
        );
    }
    
    // Jika tidak sedang loading auth, dan TIDAK ADA currentUser, tampilkan AuthScreen
    if (!currentUser) {
        return <AuthScreen onLoginSuccess={() => {
            // Cek ulang apakah ada target post setelah login
            if (targetPostId) {
                setPage('view_post');
            } else {
                setPage('home');
            }
            setIsAuthChecking(true); // Set checking lagi agar profile dimuat ulang
        }} />;
    }
    
    // FIX BUG: Tampilkan loader jika currentUser ada, tapi profile belum dimuat
    if (!profile) {
        return (
             <div className="min-h-screen flex items-center justify-center bg-gray-100 text-indigo-600">
                <Loader2 className="animate-spin" size={48} />
                <p className="ml-3 text-xl">Memuat data pengguna...</p>
            </div>
        );
    }

    const renderPage = () => {
        if (page === 'other-profile' && targetProfileId) {
            const targetUser = allUsers.find(u => u.uid === targetProfileId);
            
            if (!targetUser) {
                 return (
                    <div className="text-center p-8 bg-white rounded-xl text-gray-500 max-w-2xl mx-auto shadow-md border border-gray-200">
                        <p>Memuat data profil atau profil tidak ditemukan.</p>
                        <button onClick={() => {setPage('home'); setTargetProfileId(null);}} className='mt-4 text-indigo-600 font-medium hover:underline'>Kembali ke Beranda</button>
                    </div>
                 );
            }
            
            return <ProfileScreen 
                        currentUserId={targetUser.uid} 
                        username={targetUser.username}
                        email={targetUser.email}
                        allPosts={allPosts} 
                        currentUserEmail={currentUser.email} // Ini email yang login
                        photoURL={targetUser.photoURL}
                        isSelf={false}
                        handleFollowToggle={handleFollowToggle}
                        profile={profile} // Ini profil yang login (untuk cek following)
                    />;
        }
        
        // RENDER HALAMAN KHUSUS POST (DEEP LINK)
        if (page === 'view_post' && targetPostId) {
            return <SinglePostView 
                        postId={targetPostId} 
                        allPosts={allPosts}
                        currentUserId={currentUser.uid} 
                        currentUserEmail={currentUser.email}
                        profile={profile}
                        handleFollowToggle={handleFollowToggle}
                        goToProfile={goToProfile}
                        goBack={() => {setPage('home'); setTargetPostId(null); window.history.replaceState({}, '', window.location.pathname);}}
                    />
        }
        
        // RENDER HALAMAN SHORTS
        if (page === 'shorts') {
            return <ShortsScreen 
                allPosts={allPosts}
                currentUserId={currentUser.uid}
                handleFollowToggle={handleFollowToggle}
                profile={profile}
            />
        }

        switch (page) {
            case 'home':
                return <HomeScreen 
                            currentUserId={currentUser.uid} 
                            currentUserEmail={currentUser.email}
                            profile={profile}
                            handleFollowToggle={handleFollowToggle}
                            goToProfile={goToProfile}
                            allPosts={allPosts}
                            isLoadingPosts={isLoadingPosts}
                        />; 
            case 'create':
                return <CreatePost setPage={setPage} userId={currentUser.uid} username={profile.username} />;
            case 'profile':
                return <ProfileScreen 
                            currentUserId={currentUser.uid} 
                            username={profile.username}
                            email={profile.email}
                            allPosts={allPosts} 
                            currentUserEmail={currentUser.email}
                            photoURL={profile.photoURL}
                            isSelf={true}
                            handleFollowToggle={handleFollowToggle}
                            profile={profile}
                        />;
            case 'search':
                return <SearchScreen 
                            allPosts={allPosts} 
                            allUsers={allUsers} 
                            profile={profile}
                            handleFollowToggle={handleFollowToggle}
                            goToProfile={goToProfile}
                        />;
            default:
                setPage('home'); // Fallback ke home jika page tidak valid
                return <HomeScreen 
                            currentUserId={currentUser.uid} 
                            currentUserEmail={currentUser.email}
                            profile={profile}
                            handleFollowToggle={handleFollowToggle}
                            goToProfile={goToProfile}
                            allPosts={allPosts}
                            isLoadingPosts={isLoadingPosts}
                        />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header / Navbar - Sembunyikan jika di Shorts */}
            {page !== 'shorts' && (
                <header className="sticky top-0 z-40 bg-white shadow-lg border-b border-gray-200">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-3">
                        <h1 
                            className="text-2xl font-bold text-indigo-600 cursor-pointer"
                            onClick={() => {setPage('home'); setTargetProfileId(null);}}
                        >
                            Sosial Komunitas
                        </h1>

                        {/* Navigasi Utama */}
                        <nav className="flex items-center space-x-2 sm:space-x-4">
                            <button 
                                onClick={() => {setPage('home'); setTargetProfileId(null);}}
                                className={`p-2 rounded-full transition ${page === 'home' && !targetProfileId ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'text-gray-600 hover:bg-gray-100'}`}
                                title="Beranda"
                            >
                                <Home size={24} />
                            </button>
                            
                            {/* TOMBOL SHORTS */}
                            <button 
                                onClick={() => setPage('shorts')}
                                className={`p-2 rounded-full transition ${page === 'shorts' ? 'bg-red-100 text-red-600 shadow-inner' : 'text-gray-600 hover:bg-red-50'}`}
                                title="Shorts (Video Pendek)"
                            >
                                <Film size={24} />
                            </button>
                            
                            <button 
                                onClick={() => setPage('search')}
                                className={`p-2 rounded-full transition ${page === 'search' ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'text-gray-600 hover:bg-gray-100'}`}
                                title="Cari Pengguna/Postingan"
                            >
                                <Search size={24} />
                            </button>

                            <button 
                                onClick={() => setPage('create')}
                                className={`p-2 rounded-full transition ${page === 'create' ? 'bg-green-100 text-green-600 shadow-inner' : 'text-gray-600 hover:bg-gray-100'}`}
                                title="Buat Postingan Baru"
                            >
                                <PlusCircle size={24} /> 
                            </button>

                            <button 
                                onClick={() => {setPage('profile'); setTargetProfileId(null);}}
                                className={`p-1 rounded-full transition ${page === 'profile' && !targetProfileId ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'text-gray-600 hover:bg-gray-100'}`}
                                title={`Akun Saya: ${profile.username}`}
                            >
                                {profile.photoURL ? (
                                    <img 
                                        src={profile.photoURL}
                                        alt="PFP"
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className='w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold'>
                                        {profile.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </button>
                        </nav>

                        {/* Logout */}
                        <button 
                            onClick={handleLogout}
                            className="p-2 rounded-full text-red-500 hover:bg-red-100 transition flex items-center space-x-1"
                            title="Logout"
                        >
                            <span className='hidden sm:inline text-sm font-medium'>Keluar</span>
                            <LogOut size={24} />
                        </button>
                    </div>
                </header>
            )}
            
            {/* TOMBOL KELUAR DARI SHORTS (Hanya muncul di Shorts) */}
            {page === 'shorts' && (
                <button 
                    onClick={() => setPage('home')}
                    className="fixed top-4 left-4 z-[60] bg-white/20 backdrop-blur-md text-white p-2 rounded-full hover:bg-white/40 transition"
                >
                    <ArrowLeft size={28} />
                </button>
            )}

            {/* Konten Halaman */}
            <main className={page === 'shorts' ? '' : "max-w-4xl mx-auto p-4 sm:p-6 lg:p-8"}>
                {renderPage()}
            </main>
            
            {/* Footer sederhana - Hide di shorts */}
            {page !== 'shorts' && (
                 <footer className="mt-10 p-4 text-center text-xs text-gray-500 border-t bg-white">
                    Selamat datang kembali, {profile.username}! | Sosial Komunitas
                </footer>
            )}
        </div>
    );
};

export default App;