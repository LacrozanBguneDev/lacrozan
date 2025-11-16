import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, onAuthStateChanged, signOut, 
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInAnonymously, signInWithCustomToken 
} from 'firebase/auth';
import { 
    getFirestore, doc, collection, query, onSnapshot, 
    updateDoc, arrayUnion, arrayRemove, setDoc, 
    serverTimestamp, addDoc, getDoc, setLogLevel, deleteDoc
} from 'firebase/firestore';
import { 
    LogOut, Home, User, Send, Heart, MessageSquare, Image, Loader2, Link, 
    ListOrdered, Shuffle, Code, Calendar, Lock, Mail, UserPlus, LogIn, AlertCircle, 
    Edit, Trash2, X, Check, Save, PlusCircle, Search, UserCheck
} from 'lucide-react';

// Atur log level debug untuk melihat detail Firestore
setLogLevel('debug');

// --- KONSTANTA GLOBAL ---
const DEVELOPER_EMAIL = 'irhamdika00@gmail.com'; 

// --- 1. KONFIGURASI DAN INISIALISASI FIREBASE ---

// Menggunakan konfigurasi spesifik dari pengguna (eduku-web)
const firebaseConfig = {
  apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
  authDomain: "eduku-web.firebaseapp.com",
  projectId: "eduku-web",
  storageBucket: "eduku-web.firebasestorage.com",
  messagingSenderId: "662463693471",
  appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
  measurementId: "G-G0VWNHHVB8"
};

// Variabel lingkungan Canvas (diperlukan untuk path Firestore dan Auth Token)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Paths publik Firestore
const getPublicCollection = (collectionName) => 
    `artifacts/${appId}/public/data/${collectionName}`;

// Inisialisasi Firebase
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
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm">$1</code>');
    html = html.replace(/\n/g, '<br>');
    return <div className="text-gray-700 leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: html }} />;
};


// --- 4. LAYAR OTENTIKASI FIREBASE (AuthScreen) ---

const AuthScreen = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Fungsi ini dipastikan di-await sebelum onLoginSuccess
    const saveUserProfile = async (uid, uname, uemail) => {
        const profileRef = doc(db, getPublicCollection('userProfiles'), uid);
        await setDoc(profileRef, {
            username: uname,
            email: uemail,
            createdAt: serverTimestamp(),
            uid: uid,
            photoURL: '', // Default PFP
            following: [], // Fitur Pertemanan
            followers: []
        }, { merge: true }); // Gunakan merge untuk akun lama
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isLogin) {
                // Proses Masuk
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                // Pastikan profil ada untuk konsistensi data
                await saveUserProfile(userCredential.user.uid, null, email);
                onLoginSuccess(); 
            } else {
                // Proses Daftar
                if (!username.trim()) {
                    setError('Username harus diisi.');
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Simpan username ke Firestore dan DITUNGGU SELESAI
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl border border-indigo-100">
                <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">
                    {isLogin ? 'Masuk ke Komunitas' : 'Daftar Akun Baru'}
                </h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-start space-x-2" role="alert">
                        <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                        <p>{error}</p>
                    </div>
                )}
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-xl mb-4 text-sm">
                    <p className='font-semibold'>Gunakan email & password untuk autentikasi.</p>
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
                        className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:bg-indigo-300 shadow-md hover:shadow-lg"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
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
        <div className="bg-white p-4 rounded-xl shadow-lg mb-6 border border-gray-100 transition-all duration-300 hover:shadow-xl">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                    {post.user?.photoURL ? (
                         <img 
                            src={post.user.photoURL}
                            alt={`${displayedUsername} PFP`}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 cursor-pointer"
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

                {/* Kontrol Postingan (Edit/Hapus) dan Follow */}
                <div className='flex space-x-2 items-center'>
                    {!isOwner && post.userId !== currentUserId && (
                        <button
                            onClick={() => handleFollowToggle(post.userId, isFollowing)}
                            className={`px-3 py-1 text-sm rounded-full transition ${isFollowing ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
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
                                className={`p-2 rounded-full transition ${isDeleting ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-100'}`}
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
                        className="w-full text-xl font-bold p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
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
                            className="flex items-center space-x-1 p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                        >
                            <X size={20} />
                            <span>Batal</span>
                        </button>
                        <button 
                            onClick={handleUpdatePost}
                            className="flex items-center space-x-1 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
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
                                className="text-indigo-600 font-medium text-sm mt-1 hover:underline"
                            >
                                {showFullContent ? 'Sembunyikan' : 'Baca Selengkapnya'}
                            </button>
                        )}
                    </div>

                    {(isImage || isVideo || mediaEmbed) && (
                        <div className="mb-4">
                             {isImage && (
                                <img 
                                    src={post.mediaUrl} 
                                    alt="Post Media" 
                                    className="w-full max-h-[50vh] object-cover rounded-lg mb-4 border border-gray-200" 
                                    onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/600x400/CCCCCC/000000?text=Gambar+Gagal+Dimuat"; }}
                                />
                            )}
                            
                            {isVideo && (
                                <video controls className="w-full max-h-[50vh] object-cover rounded-lg mb-4 border border-gray-200">
                                    <source src={post.mediaUrl} type="video/mp4" />
                                    Browser Anda tidak mendukung tag video.
                                </video>
                            )}
                            
                            {mediaEmbed && mediaEmbed.type === 'youtube' && (
                                <div className="relative pt-[56.25%] rounded-lg overflow-hidden shadow-lg">
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
                                    className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-2 bg-indigo-50 p-3 rounded-lg border border-indigo-200"
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
                        className={`flex items-center space-x-1 p-2 rounded-full transition ${isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                        disabled={!currentUserId}
                    >
                        <Heart size={20} fill={isLiked ? '#ef4444' : 'none'} />
                        <span className="text-sm font-medium">{post.likes?.length || 0} Suka</span>
                    </button>
                    <button 
                        onClick={() => setShowComments(!showComments)} 
                        className="flex items-center space-x-1 p-2 rounded-full hover:text-indigo-500 transition"
                    >
                        <MessageSquare size={20} />
                        <span className="text-sm font-medium">{post.commentsCount || 0} Komentar</span>
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
                            className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={!currentUserId}
                        />
                        <button 
                            type="submit"
                            className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition disabled:bg-indigo-300"
                            disabled={!currentUserId || !newComment.trim()}
                        >
                            <Send size={20} />
                        </button>
                    </form>

                    {isLoadingComments ? (
                        <div className="flex justify-center p-4 text-indigo-600"><Loader2 className="animate-spin" size={24} /></div>
                    ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {comments.map((comment) => (
                                <div key={comment.id} className="text-sm bg-gray-50 p-2 rounded-lg">
                                    <p className="font-medium text-gray-800">
                                        {comment.username || 'Anonim'} 
                                        <span className="text-xs text-gray-500 ml-2">
                                            {formatTimeAgo(comment.timestamp).relative}
                                        </span>
                                    </p>
                                    <p className="text-gray-700">{comment.text}</p>
                                </div>
                            ))}
                            {comments.length === 0 && <p className="text-center text-gray-500 text-sm">Belum ada komentar.</p>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


// --- 6. KOMPONEN BUAT POSTINGAN (CreatePost) (Sama) ---

const CreatePost = ({ setPage, userId, username }) => {
    const [title, setTitle] = useState(''); 
    const [content, setContent] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaType, setMediaType] = useState('text'); 
    const [isLoading, setIsLoading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [progress, setProgress] = useState(0); 

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setMediaFile(file);
            setMediaUrl(''); 
            if (file.type.startsWith('image/')) {
                setMediaType('image');
            } else if (file.type.startsWith('video/')) {
                 setMediaType('video');
            } else {
                setMediaType('media');
            }
        }
    };

    const handleUrlChange = (e) => {
        setMediaUrl(e.target.value);
        setMediaFile(null); 
        setMediaType('link');
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
                // Embed user data in post
                user: { username: username, uid: userId } 
            });
            
            setProgress(100);
            await new Promise(resolve => setTimeout(resolve, 300));

            setTitle('');
            setContent('');
            setMediaFile(null);
            setMediaUrl('');
            setMediaType('text');
            setPage('home');
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
        <div className="max-w-xl mx-auto p-4 bg-white rounded-xl shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">Buat Postingan Baru</h2>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-4 text-sm text-indigo-700">
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
                    placeholder="Konten Anda (gunakan **tebal** atau *miring*)"
                    rows="6"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    disabled={isLoading}
                />

                <div className="flex items-center text-sm text-gray-500 bg-gray-100 p-2 rounded-lg">
                    <Code size={16} className="mr-1 text-gray-600"/>
                    <span className='mr-4'>Format: **tebal**, *miring*, `kode`</span>
                    <span className='hidden sm:block'> (tekan Enter untuk baris baru)</span>
                </div>


                <div className="flex items-center space-x-4">
                    <div className="flex-1">
                        <label className={`flex items-center space-x-2 text-indigo-600 cursor-pointer p-3 rounded-lg transition ${isLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 hover:bg-indigo-100'}`}>
                            <Image size={20} />
                            <span>{mediaFile ? mediaFile.name : 'Unggah Gambar/Video'}</span>
                            <input 
                                type="file" 
                                accept="image/*,video/*"
                                onChange={handleFileChange} 
                                className="hidden" 
                                disabled={isLoading || !!mediaUrl} // Nonaktifkan jika URL sudah ada
                            />
                        </label>
                    </div>

                    <div className="flex-1">
                        <label className={`flex items-center space-x-2 text-green-600 p-3 rounded-lg border transition ${isLoading ? 'bg-gray-100 text-gray-400 border-gray-300' : 'bg-green-50 border-green-200'}`}>
                            <Link size={20} />
                            <input 
                                type="url" 
                                value={mediaUrl}
                                onChange={handleUrlChange} 
                                placeholder="Link YouTube/Media Eksternal" 
                                className="w-full bg-transparent outline-none placeholder-gray-500"
                                disabled={isLoading || !!mediaFile} // Nonaktifkan jika file sudah dipilih
                            />
                        </label>
                    </div>
                </div>

                <p className="text-sm text-gray-500">
                    {mediaFile ? `File: ${mediaFile.name} akan diunggah.` : mediaUrl ? `Link: ${mediaUrl} akan di-embed.` : 'Anda bisa mengunggah file media ATAU menyertakan link video.'}
                </p>

                <button
                    type="submit"
                    disabled={isLoading || (!content.trim() && !mediaFile && !mediaUrl)}
                    className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:bg-indigo-300"
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

const HomeScreen = ({ currentUserId, currentUserEmail, profile, handleFollowToggle, goToProfile }) => {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [feedType, setFeedType] = useState('latest'); 

    useEffect(() => {
        setIsLoading(true);
        const postsQuery = query(collection(db, getPublicCollection('posts')));

        const unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
            let fetchedPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Ambil semua ID pengguna unik
            const uniqueUserIds = [...new Set(fetchedPosts.map(p => p.userId))];
            const profilePromises = uniqueUserIds.map(uid => 
                uid ? getDoc(doc(db, getPublicCollection('userProfiles'), uid)) : Promise.resolve(null)
            );
            const profileSnaps = await Promise.all(profilePromises);
            
            // Map profil ke UID
            const profilesMap = profileSnaps.reduce((acc, snap) => {
                if (snap && snap.exists()) {
                    acc[snap.id] = snap.data();
                }
                return acc;
            }, {});

            const postsWithProfiles = fetchedPosts.map((post) => {
                const postUser = profilesMap[post.userId] || post.user;
                return { 
                    ...post, 
                    commentsCount: post.commentsCount || 0, 
                    likes: post.likes || [],
                    user: postUser || { username: 'Pengguna Dihapus', uid: post.userId } 
                };
            });
            
            postsWithProfiles.sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
                return timeB - timeA; 
            });

            setPosts(postsWithProfiles);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching posts:", error);
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    const shuffledPosts = useMemo(() => {
        if (feedType === 'latest') return posts;
        return [...posts].sort(() => Math.random() - 0.5);
    }, [posts, feedType]);


    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-6">Beranda Komunitas</h1>
            
            <div className="flex space-x-4 border-b pb-3 mb-6">
                <button 
                    onClick={() => setFeedType('latest')}
                    className={`flex items-center space-x-2 p-2 rounded-full font-semibold transition ${feedType === 'latest' ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <ListOrdered size={20} />
                    <span>Terbaru</span>
                </button>
                <button 
                    onClick={() => setFeedType('foryou')}
                    className={`flex items-center space-x-2 p-2 rounded-full font-semibold transition ${feedType === 'foryou' ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <Shuffle size={20} />
                    <span>Untukmu (Acak)</span>
                </button>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-indigo-600">
                    <Loader2 className="animate-spin" size={32} />
                    <p className="mt-2 text-lg">Memuat Postingan...</p>
                </div>
            ) : shuffledPosts.length === 0 ? (
                <div className="text-center p-8 bg-gray-50 rounded-xl text-gray-500">
                    <p>Belum ada postingan. Ayo buat yang pertama!</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {shuffledPosts.map(post => (
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


// --- 8. KOMPONEN AKUN (ProfileScreen) ---

const ProfileScreen = ({ currentUserId, username, email, allPosts, currentUserEmail, photoURL, isSelf, setPage, handleFollowToggle, profile }) => {
    const [userPosts, setUserPosts] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [newPhotoUrl, setNewPhotoUrl] = useState(photoURL || '');
    const [pfpFile, setPfpFile] = useState(null);
    const [isLoadingPFP, setIsLoadingPFP] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [progress, setProgress] = useState(0); 

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

            setIsEditing(false);
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

    const isDeveloper = currentUserEmail === DEVELOPER_EMAIL;
    const initialLetter = username.charAt(0).toUpperCase();
    const isFollowing = profile.following?.includes(currentUserId);


    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-2xl mb-8">
                <div className="flex items-start space-x-4">
                    {/* FOTO PROFIL */}
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
                    
                    <div className='flex-grow'>
                        <h1 className="text-3xl font-extrabold text-gray-900">{username}</h1>
                        <p className="text-gray-500 text-sm flex items-center mt-1">
                             <Mail size={14} className="mr-1 text-gray-400"/> {email} {isDeveloper && <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full ml-2">DEVELOPER</span>}
                        </p>
                        <p className="text-gray-400 text-xs break-all flex items-center mt-1">
                            <Code size={14} className="mr-1 text-gray-400"/>
                            <span className='font-medium'>ID Pengguna:</span> {currentUserId}
                        </p>
                    </div>

                    {isSelf ? (
                        <button 
                            onClick={() => setIsEditing(!isEditing)}
                            className="p-2 rounded-full text-indigo-600 hover:bg-indigo-50 transition"
                            title="Edit Foto Profil"
                        >
                            <Edit size={20} />
                        </button>
                    ) : (
                        <button
                            onClick={() => handleFollowToggle(currentUserId, isFollowing)}
                            className={`px-4 py-2 text-sm rounded-full font-semibold transition ${isFollowing ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            title={isFollowing ? 'Berhenti Mengikuti' : 'Ikuti Pengguna Ini'}
                        >
                            {isFollowing ? 'Mengikuti' : 'Ikuti'}
                        </button>
                    )}
                </div>

                {/* Edit PFP Section */}
                {isEditing && isSelf && (
                    <div className="mt-6 pt-4 border-t space-y-3">
                        <h3 className="font-semibold text-gray-800">Ubah Foto Profil</h3>
                        {uploadError && <div className="p-2 text-sm rounded-lg bg-red-100 text-red-700">{uploadError}</div>}
                        
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
                        
                        <div className="flex items-center space-x-2">
                            <label className="flex items-center space-x-2 text-indigo-600 cursor-pointer p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition flex-grow">
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
                             <input
                                type="url"
                                value={newPhotoUrl}
                                onChange={(e) => {setNewPhotoUrl(e.target.value); setPfpFile(null);}}
                                placeholder="ATAU masukkan URL Gambar"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={isLoadingPFP || !!pfpFile}
                            />
                        </div>

                        <div className="flex justify-end space-x-2">
                            <button 
                                onClick={() => setIsEditing(false)}
                                className="flex items-center space-x-1 p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                            >
                                <X size={20} />
                                <span>Batal</span>
                            </button>
                            <button 
                                onClick={handleSavePFP}
                                disabled={isLoadingPFP}
                                className="flex items-center space-x-1 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-indigo-300"
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
                        <p className="text-xl font-bold text-gray-800">{profile.followers?.length || 0}</p>
                        <p className="text-sm text-gray-500">Pengikut</p>
                    </div>
                     <div>
                        <p className="text-xl font-bold text-gray-800">{profile.following?.length || 0}</p>
                        <p className="text-sm text-gray-500">Mengikuti</p>
                    </div>
                    <div>
                        <p className="text-xl font-bold text-gray-800">{userPosts.length}</p>
                        <p className="text-sm text-gray-500">Postingan</p>
                    </div>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-4">{isSelf ? 'Postingan Saya' : `Postingan ${username}`} ({userPosts.length})</h2>
            
            <div className="space-y-6">
                {userPosts.length === 0 ? (
                    <div className="text-center p-8 bg-gray-50 rounded-xl text-gray-500">
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
                            goToProfile={setPage}
                        />
                    ))
                )}
            </div>
        </div>
    );
};


// --- 9. KOMPONEN PENCARIAN (SearchScreen) ---

const SearchScreen = ({ allPosts, allUsers, profile, handleFollowToggle, goToProfile }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'users'

    const filteredPosts = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        return allPosts.filter(post => 
            post.title?.toLowerCase().includes(term) || 
            post.content?.toLowerCase().includes(term) ||
            post.user?.username?.toLowerCase().includes(term)
        );
    }, [searchTerm, allPosts]);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        return allUsers.filter(user => 
            user.username?.toLowerCase().includes(term) && user.uid !== profile.uid
        );
    }, [searchTerm, allUsers, profile.uid]);

    const handleUserClick = (userId) => {
        goToProfile(userId);
    };

    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-6">Pencarian Komunitas</h1>

            <div className="relative mb-6">
                <Search size={24} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari Postingan, Judul, atau Username..."
                    className="w-full pl-12 pr-4 py-3 border border-indigo-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition shadow-md text-lg"
                />
            </div>

            <div className="flex space-x-4 border-b pb-1 mb-4">
                <button 
                    onClick={() => setActiveTab('posts')}
                    className={`pb-2 font-semibold transition border-b-2 ${activeTab === 'posts' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:border-gray-300'}`}
                >
                    Postingan ({filteredPosts.length})
                </button>
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`pb-2 font-semibold transition border-b-2 ${activeTab === 'users' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:border-gray-300'}`}
                >
                    Pengguna ({filteredUsers.length})
                </button>
            </div>
            
            {searchTerm.length < 3 && <div className="text-center p-8 bg-gray-50 rounded-xl text-gray-500">Masukkan minimal 3 karakter untuk memulai pencarian.</div>}

            {searchTerm.length >= 3 && (
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
                                <div className="text-center p-8 bg-gray-50 rounded-xl text-gray-500">Tidak ada postingan yang cocok.</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-3">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <div 
                                        key={user.uid} 
                                        className="flex items-center justify-between bg-white p-4 rounded-xl shadow-md border border-gray-100 hover:bg-gray-50 transition"
                                    >
                                        <div className='flex items-center space-x-3 cursor-pointer' onClick={() => handleUserClick(user.uid)}>
                                            {user.photoURL ? (
                                                <img 
                                                    src={user.photoURL}
                                                    alt={`${user.username} PFP`}
                                                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
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
                                            className={`px-3 py-1 text-sm rounded-full font-semibold transition ${profile.following?.includes(user.uid) ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                        >
                                            {profile.following?.includes(user.uid) ? 'Mengikuti' : 'Ikuti'}
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center p-8 bg-gray-50 rounded-xl text-gray-500">Tidak ada pengguna yang cocok.</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};


// --- 10. KOMPONEN UTAMA (App) ---

const App = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [profile, setProfile] = useState(null); 
    const [targetProfileId, setTargetProfileId] = useState(null); // Untuk menampilkan profil orang lain
    const [page, setPage] = useState('home'); 
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [allPosts, setAllPosts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);


    // 1. Langganan perubahan profil pengguna
    useEffect(() => {
        if (!currentUser || !currentUser.uid) {
            setProfile(null);
            return;
        }

        const profileRef = doc(db, getPublicCollection('userProfiles'), currentUser.uid);

        const unsubscribe = onSnapshot(profileRef, (snap) => {
            const userEmail = currentUser.email || 'N/A';
            if (snap.exists()) {
                setProfile({ ...snap.data(), email: userEmail, uid: currentUser.uid });
            } else {
                // Fallback kuat untuk akun lama tanpa dokumen profil (JANGAN gunakan 'Pengguna Baru' di sini)
                setProfile({ 
                    username: currentUser.email?.split('@')[0] || 'Nama Pengguna', 
                    email: userEmail, 
                    uid: currentUser.uid,
                    photoURL: '', following: [], followers: [] 
                });
            }
        }, (error) => {
            console.error("Error fetching user profile in real-time:", error);
        });

        return unsubscribe;
    }, [currentUser]);


    // 2. Langganan perubahan otentikasi
    useEffect(() => {
        const handleInitialAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                 console.error("Initial Auth (Custom Token/Anonim) Gagal:", error);
            }
        };

        handleInitialAuth();

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && !user.isAnonymous) { 
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
            }
            setIsAuthChecking(false);
        });
        
        return unsubscribe; 
    }, []);

    // 3. Langganan real-time untuk semua postingan publik
    useEffect(() => {
        if (isAuthChecking || !currentUser) return; 
        
        const postsQuery = query(collection(db, getPublicCollection('posts')));

        const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(d => ({ 
                id: d.id, 
                ...d.data(), 
                timestamp: d.data().timestamp || new Date(0) 
            }));
            setAllPosts(fetchedPosts);
        }, (error) => {
            console.error("Error fetching all posts:", error);
        });

        return unsubscribe;
    }, [isAuthChecking, currentUser]);
    
    // 4. Langganan real-time untuk semua profil pengguna (untuk fitur search & following)
     useEffect(() => {
        if (isAuthChecking || !currentUser) return; 
        
        const usersQuery = query(collection(db, getPublicCollection('userProfiles')));

        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const fetchedUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllUsers(fetchedUsers);
        }, (error) => {
            console.error("Error fetching all users:", error);
        });

        return unsubscribe;
    }, [isAuthChecking, currentUser]);

    // FUNGSI TOGGLE FOLLOW
    const handleFollowToggle = async (targetUid, isCurrentlyFollowing) => {
        if (!profile || targetUid === profile.uid) return;
        
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
        setTargetProfileId(uid);
        setPage('other-profile');
    };


    const handleLogout = async () => {
        try {
            await signOut(auth);
            setCurrentUser(null);
            setProfile(null);
            setPage('home'); 
        } catch (error) {
            console.error("Gagal Logout:", error);
        }
    };

    if (isAuthChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-600">
                <Loader2 className="animate-spin" size={48} />
                <p className="ml-3 text-xl">Memeriksa status otentikasi...</p>
            </div>
        );
    }
    
    if (!currentUser) {
        return <AuthScreen onLoginSuccess={() => setPage('home')} />;
    }
    
    if (!profile) {
        return (
             <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-600">
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
                    <div className="text-center p-8 bg-gray-50 rounded-xl text-gray-500 max-w-2xl mx-auto">
                        <p>Memuat data profil atau profil tidak ditemukan.</p>
                        <button onClick={() => setPage('home')} className='mt-4 text-indigo-600 font-medium hover:underline'>Kembali ke Beranda</button>
                    </div>
                 );
            }
            
            return <ProfileScreen 
                        currentUserId={targetUser.uid} 
                        username={targetUser.username}
                        email={targetUser.email}
                        allPosts={allPosts} 
                        currentUserEmail={currentUser.email}
                        photoURL={targetUser.photoURL}
                        isSelf={false}
                        setPage={setPage} // Tidak terpakai, hanya untuk konsistensi prop
                        handleFollowToggle={handleFollowToggle}
                        profile={profile} // Profile pengguna saat ini
                    />;
        }

        switch (page) {
            case 'home':
                return <HomeScreen 
                            currentUserId={currentUser.uid} 
                            currentUserEmail={currentUser.email}
                            profile={profile}
                            handleFollowToggle={handleFollowToggle}
                            goToProfile={goToProfile}
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
                            setPage={setPage}
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
                return <HomeScreen 
                            currentUserId={currentUser.uid} 
                            currentUserEmail={currentUser.email}
                            profile={profile}
                            handleFollowToggle={handleFollowToggle}
                            goToProfile={goToProfile}
                        />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header / Navbar */}
            <header className="sticky top-0 z-10 bg-white shadow-lg">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-4">
                    <h1 
                        className="text-2xl font-bold text-indigo-600 cursor-pointer"
                        onClick={() => {setPage('home'); setTargetProfileId(null);}}
                    >
                        Sosial Komunitas
                    </h1>

                    {/* Navigasi Utama */}
                    <nav className="flex items-center space-x-4">
                        <button 
                            onClick={() => {setPage('home'); setTargetProfileId(null);}}
                            className={`p-2 rounded-full transition ${page === 'home' ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'text-gray-600 hover:bg-gray-100'}`}
                            title="Beranda"
                        >
                            <Home size={24} />
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
                            className="bg-green-500 text-white p-2 rounded-full shadow-lg hover:bg-green-600 transition flex items-center justify-center font-semibold"
                            title="Buat Postingan Baru"
                        >
                            <PlusCircle size={24} /> {/* ICON PLUS LINGKARAN */}
                        </button>

                        <button 
                            onClick={() => {setPage('profile'); setTargetProfileId(null);}}
                            className={`p-1 rounded-full transition ${page === 'profile' ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'text-gray-600 hover:bg-gray-100'}`}
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

            {/* Konten Halaman */}
            <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                {renderPage()}
            </main>
            
            {/* Footer sederhana */}
            <footer className="mt-10 p-4 text-center text-xs text-gray-500 border-t">
                Aplikasi Komunitas Sederhana | Masuk sebagai **{profile.username}**
            </footer>
        </div>
    );
};

export default App;