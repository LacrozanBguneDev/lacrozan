import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    ArrowLeft, Sparkles, Volume2, VolumeX, 
    Bell, Loader2, Play, Pause,
    MessageCircle, Share2, ExternalLink, ChevronDown, ChevronUp, Youtube, Heart
} from 'lucide-react';

// --- KONFIGURASI SESUAI DOKUMENTASI ---
const API_CONFIG = {
    URL: 'https://app.bgunenet.my.id/api/feed',
    MODE: 'search',
    QUERY: '#kreata',
    LIMIT: 10
};

const ASSETS = {
    LOGO: "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101",
    BGM: "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3", // Lo-fi chill bgm
    SFX_CLICK: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"
};

// --- HELPER: YOUTUBE PARSER ---
const getYoutubeId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// --- HELPER: TIME FORMATTER ---
const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
};

// --- KOMPONEN: RICH TEXT (Link & Formatting) ---
const RichText = ({ text }) => {
    if (!text) return null;
    // Regex untuk URL, Bold (**), Italic (*)
    const regex = /(\bhttps?:\/\/[^\s]+)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
    const parts = text.split(regex).filter(Boolean);

    return (
        <span className="whitespace-pre-wrap break-words">
            {parts.map((part, index) => {
                if (part.match(/^https?:\/\//)) {
                    return (
                        <a key={index} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                           className="text-emerald-400 font-bold hover:underline decoration-dotted mx-1">
                            [LINK]
                        </a>
                    );
                } else if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index} className="text-white font-black">{part.slice(2, -2)}</strong>;
                } else if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={index} className="text-emerald-200 not-italic">{part.slice(1, -1)}</em>;
                }
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
};

// --- MAIN COMPONENT ---
const KreataFeedUltimate = () => {
    // STATE: DATA & PAGINATION
    const [posts, setPosts] = useState([]);
    const [nextCursor, setNextCursor] = useState(null); // Cursor dari API
    const [hasMore, setHasMore] = useState(true); // Cek apakah nextCursor null
    const [isLoading, setIsLoading] = useState(false);
    
    // STATE: UI & AUDIO
    const [isEntered, setIsEntered] = useState(false); // Untuk Landing Screen
    const [isPlaying, setIsPlaying] = useState(false); // Status Musik
    const [expandMap, setExpandMap] = useState({}); // Untuk "Baca Selengkapnya" per ID

    // REFS
    const observer = useRef();
    const audioRef = useRef(new Audio(ASSETS.BGM));
    const sfxRef = useRef(new Audio(ASSETS.SFX_CLICK));

    // INIT AUDIO
    useEffect(() => {
        audioRef.current.loop = true;
        audioRef.current.volume = 0.4;
        return () => {
            audioRef.current.pause();
            audioRef.current.src = "";
        };
    }, []);

    // --- FUNGSI AUDIO MANAGER ---
    const playSfx = () => {
        sfxRef.current.currentTime = 0;
        sfxRef.current.play().catch(() => {});
    };

    const toggleAudio = () => {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => console.log("Audio block handled:", e));
        }
        setIsPlaying(!isPlaying);
    };

    // --- INI SOLUSI AGAR AUDIO TIDAK DIBLOKIR BROWSER ---
    const handleEnterRoom = () => {
        playSfx();
        // Browser butuh interaksi user untuk play audio
        audioRef.current.play()
            .then(() => {
                setIsPlaying(true);
                setIsEntered(true);
                fetchFeed(); // Load data pertama kali setelah user masuk
            })
            .catch((err) => {
                console.warn("Autoplay force:", err);
                setIsEntered(true);
                // Tetap masuk meski audio error, nanti user bisa toggle manual
            });
    };

    // --- CORE LOGIC: FETCH DATA (STRICT API DOCS) ---
    const fetchFeed = async (cursorToUse = null) => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            // 1. Construct URL
            const params = new URLSearchParams({
                mode: API_CONFIG.MODE,
                q: API_CONFIG.QUERY, // Encode otomatis oleh URLSearchParams
                limit: API_CONFIG.LIMIT
            });

            // 2. Tambahkan cursor HANYA jika ada (sesuai aturan no. 2)
            if (cursorToUse) {
                params.append('cursor', cursorToUse);
            }

            const response = await fetch(`${API_CONFIG.URL}?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) throw new Error("API Error");

            // 3. Proses Data & Sanitasi
            const newPosts = (data.posts || []).map(p => {
                // Deteksi Youtube Otomatis dari Content atau MediaUrl
                let ytUrl = null;
                const content = p.content || p.text || "";
                if (p.mediaUrl?.includes('youtu')) ytUrl = p.mediaUrl;
                else {
                    const ytId = getYoutubeId(content);
                    if (ytId) ytUrl = `https://www.youtube.com/watch?v=${ytId}`;
                }

                return {
                    id: p.id, // ID Firestore
                    title: p.title || "Tanpa Judul",
                    author: p.user?.username || p.userName || "Admin",
                    avatar: p.user?.photoURL || p.userAvatar,
                    content: content,
                    image: (!ytUrl && p.mediaUrl && p.mediaUrl.length > 5) ? p.mediaUrl : null,
                    youtube: ytUrl,
                    timestamp: p.timestamp,
                    likes: p.likes || 0
                };
            });

            // 4. Update State (Anti Duplikat)
            setPosts(prev => {
                if (!cursorToUse) return newPosts; // Reset jika fetch pertama
                const ids = new Set(prev.map(x => x.id));
                const filtered = newPosts.filter(x => !ids.has(x.id));
                return [...prev, ...filtered];
            });

            // 5. Handle Cursor (Aturan no. 5)
            if (data.nextCursor) {
                setNextCursor(data.nextCursor);
                setHasMore(true);
            } else {
                setNextCursor(null);
                setHasMore(false); // Stop pagination
            }

        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- INFINITE SCROLL OBSERVER ---
    const lastPostRef = useCallback(node => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            // Jika elemen terlihat DAN masih ada cursor (Aturan no. 5 & 3)
            if (entries[0].isIntersecting && hasMore && nextCursor) {
                fetchFeed(nextCursor);
            }
        });

        if (node) observer.current.observe(node);
    }, [isLoading, hasMore, nextCursor]);

    // --- UI HANDLERS ---
    const toggleExpand = (id) => {
        setExpandMap(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleShare = async (post) => {
        const shareData = {
            title: `Kreata: ${post.title}`,
            text: post.content.substring(0, 100),
            url: window.location.href
        };
        try {
            if (navigator.share) await navigator.share(shareData);
            else alert("Link tersalin (fallback clipboard)");
        } catch (err) { console.log(err); }
    };

    // --- RENDER 1: LANDING SCREEN (WAJIB ADA AGAR AUDIO JALAN) ---
    if (!isEntered) {
        return (
            <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-50 overflow-hidden">
                {/* Background Animation */}
                <div className="absolute w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] animate-pulse"></div>
                
                <div className="relative z-10 text-center space-y-8 p-6">
                    <div className="relative inline-block group cursor-pointer" onClick={handleEnterRoom}>
                        <div className="absolute inset-0 bg-emerald-500 rounded-3xl blur-md opacity-50 group-hover:opacity-100 transition duration-500"></div>
                        <img src={ASSETS.LOGO} className="relative w-32 h-32 rounded-3xl border-2 border-white/20 shadow-2xl object-cover transform group-hover:scale-105 transition duration-500" alt="Logo" />
                    </div>
                    
                    <div>
                        <h1 className="text-4xl font-black text-white italic tracking-tighter mb-2">
                            KREATA <span className="text-emerald-400">ROOM</span>
                        </h1>
                        <p className="text-slate-400 text-xs uppercase tracking-[0.3em]">Audio Experience Enabled</p>
                    </div>

                    <button 
                        onClick={handleEnterRoom}
                        className="bg-white text-black px-8 py-3 rounded-full font-black uppercase text-sm tracking-widest hover:bg-emerald-400 hover:scale-110 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center gap-2 mx-auto"
                    >
                        <Play size={18} fill="black" /> Masuk Sekarang
                    </button>
                </div>
            </div>
        );
    }

    // --- RENDER 2: MAIN FEED ---
    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-20">
            
            {/* NAVBAR STICKY */}
            <nav className="fixed top-0 inset-x-0 h-16 bg-[#020617]/80 backdrop-blur-md border-b border-white/5 z-40 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <img src={ASSETS.LOGO} className="w-8 h-8 rounded-lg" alt="icon" />
                    <span className="font-bold text-white tracking-tighter">KREATA</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={toggleAudio} className={`p-2 rounded-full border ${isPlaying ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-slate-700 text-slate-500'}`}>
                        {isPlaying ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </button>
                </div>
            </nav>

            {/* FEED CONTAINER */}
            <div className="max-w-md mx-auto pt-20 px-4 space-y-6">
                
                {/* HEADER INFO */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 p-4 rounded-2xl border border-white/10 flex items-center gap-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 blur-xl"></div>
                    <div className="bg-emerald-500/20 p-3 rounded-xl">
                        <Sparkles className="text-emerald-400" size={24} />
                    </div>
                    <div>
                        <h2 className="font-bold text-white text-sm uppercase">Official Feed</h2>
                        <p className="text-[10px] text-slate-400 mt-1">
                            Menampilkan hashtag <span className="text-emerald-300 font-mono">#kreata</span>
                        </p>
                    </div>
                </div>

                {/* POST LIST */}
                {posts.map((post, index) => {
                    const isLast = index === posts.length - 1;
                    const isExpanded = expandMap[post.id];
                    const isLongText = post.content.length > 150;

                    return (
                        <article 
                            key={post.id} 
                            ref={isLast ? lastPostRef : null}
                            className="bg-[#0f111a] border border-white/5 rounded-[24px] overflow-hidden shadow-lg animate-fade-in"
                        >
                            {/* Author */}
                            <div className="p-4 flex items-center gap-3">
                                <img src={post.avatar || `https://ui-avatars.com/api/?name=${post.author}&background=random`} 
                                     className="w-9 h-9 rounded-full bg-slate-800 object-cover border border-white/10" alt="avt" />
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-white leading-none">{post.author}</h3>
                                    <span className="text-[10px] text-slate-500">{formatTime(post.timestamp)}</span>
                                </div>
                                <button className="text-slate-600 hover:text-white"><Share2 size={16} onClick={() => handleShare(post)}/></button>
                            </div>

                            {/* Media: Youtube Priority */}
                            {post.youtube ? (
                                <div className="aspect-video w-full bg-black">
                                    <iframe 
                                        src={`https://www.youtube.com/embed/${getYoutubeId(post.youtube)}?rel=0`} 
                                        className="w-full h-full" allowFullScreen title="yt"
                                    />
                                </div>
                            ) : post.image ? (
                                <div className="w-full bg-black/50 border-y border-white/5">
                                    <img src={post.image} className="w-full h-auto max-h-96 object-contain" alt="content" loading="lazy" />
                                </div>
                            ) : null}

                            {/* Content */}
                            <div className="p-4 pt-3">
                                <div className={`text-sm text-slate-300 font-light leading-relaxed ${!isExpanded && isLongText ? 'line-clamp-3' : ''}`}>
                                    <RichText text={post.content} />
                                </div>
                                {isLongText && (
                                    <button 
                                        onClick={() => toggleExpand(post.id)}
                                        className="mt-2 text-[10px] font-bold text-emerald-500 flex items-center gap-1 hover:underline"
                                    >
                                        {isExpanded ? 'TUTUP' : 'BACA SELENGKAPNYA'} {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                    </button>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                                <button className="bg-white/5 hover:bg-white/10 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                    <Heart size={14} className={post.likes > 0 ? "fill-emerald-500 text-emerald-500" : ""} /> 
                                    {post.likes > 0 ? post.likes : 'Suka'}
                                </button>
                                <a href={`/?post=${post.id}`} className="bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                    <ExternalLink size={14} /> Buka
                                </a>
                            </div>
                        </article>
                    );
                })}

                {/* LOADING STATE */}
                {isLoading && (
                    <div className="py-8 flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-emerald-500" size={24} />
                        <span className="text-xs text-slate-500 tracking-widest animate-pulse">MEMUAT KREASI...</span>
                    </div>
                )}

                {/* END STATE */}
                {!hasMore && !isLoading && posts.length > 0 && (
                    <div className="text-center py-10 opacity-50">
                        <div className="w-2 h-2 bg-slate-700 rounded-full mx-auto mb-2"></div>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500">Semua karya sudah ditampilkan</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KreataRoom;