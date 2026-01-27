import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    ArrowLeft, Sparkles, Volume2, VolumeX, 
    Bell, Loader2, Play, Eye, 
    MessageCircle, Share2, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';

const KREATA_LOGO = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

// --- HELPER: DETEKSI YOUTUBE ID (SUPPORT SHORTS) ---
const getYouTubeId = (url) => {
    if (!url) return null;
    // Regex support: youtu.be, watch?v=, embed/, shorts/
    const regExp = /(?:youtu\.be\/|youtube\.com\/(?:.*v\/|.*u\/\w\/|embed\/|shorts\/|watch\?v=))([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[1].length === 11) ? match[1] : null;
};

// --- KOMPONEN YOUTUBE PLAYER ---
const YouTubeEmbed = ({ url }) => {
    const videoId = getYouTubeId(url);
    if (!videoId) return null;

    return (
        <div className="w-full aspect-video bg-black relative overflow-hidden border-y border-white/5 group-hover:border-white/10">
            <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            ></iframe>
        </div>
    );
};

// --- KOMPONEN RENDER TEKS (PARSER ASLI) ---
const RichTextRenderer = ({ text }) => {
    if (!text) return null;
    const regex = /(\bhttps?:\/\/[^\s]+)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
    const parts = text.split(regex).filter(Boolean);

    return (
        <span>
            {parts.map((part, index) => {
                if (part.match(/^https?:\/\//)) {
                    return (
                        <a key={index} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                           className="text-emerald-400 font-bold hover:underline decoration-dotted truncate inline-block max-w-full align-bottom">
                            LINK TAUTAN ↗
                        </a>
                    );
                } else if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index} className="text-white font-black tracking-wide">{part.slice(2, -2)}</strong>;
                } else if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={index} className="text-emerald-200 not-italic bg-emerald-500/10 px-1 rounded">{part.slice(1, -1)}</em>;
                }
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
};

// --- KOMPONEN BACA SELENGKAPNYA ---
const ExpandableText = ({ content }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const limit = 150; 
    const isLong = content.length > limit;
    const textToShow = isExpanded || !isLong ? content : content.slice(0, limit) + "...";

    return (
        <div className="text-slate-300 text-[13px] leading-6 font-light">
            <div className="whitespace-pre-wrap break-words">
                <RichTextRenderer text={textToShow} />
            </div>
            {isLong && (
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"
                >
                    {isExpanded ? <>Tutup <ChevronUp size={12} /></> : <>Baca Selengkapnya <ChevronDown size={12} /></>}
                </button>
            )}
        </div>
    );
};

const KreataRoom = ({ setPage }) => {
    // --- STATE MANAGEMENT ---
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nextCursor, setNextCursor] = useState(null); // Cursor dari API
    const [hasMore, setHasMore] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    // Ref untuk infinite scroll
    const observer = useRef();
    
    // Audio Refs
    const audioClick = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3')); 
    const bgMusic = useRef(new Audio('https://cdn.pixabay.com/audio/2021/08/08/audio_c1c73a0c0e.mp3')); 

    // --- INFINITE SCROLL OBSERVER ---
    const lastPostElementRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                // Panggil fetch dengan cursor yang tersimpan saat ini
                fetchKreataPosts(nextCursor);
            }
        });
        
        if (node) observer.current.observe(node);
    }, [loading, hasMore, nextCursor]);

    // --- LOGIKA FETCH API (STRICT MODE) ---
    const fetchKreataPosts = async (cursorToUse = null) => {
        if (loading) return; // Prevent double fetch
        setLoading(true);

        try {
            // Base URL
            let url = 'https://app.bgunenet.my.id/api/feed?mode=search&q=#kreata&limit=10';
            
            // Aturan Pagination 2: Request berikutnya WAJIB mengirim cursor
            if (cursorToUse) {
                url += `&cursor=${cursorToUse}`;
            }

            console.log("Fetching URL:", url); // Debugging

            const res = await fetch(url);
            const data = await res.json();

            // Mapping Data
            const newPosts = (data.posts || []).map(post => {
                let finalImage = null;
                if (post.mediaUrl && post.mediaUrl.length > 5) finalImage = post.mediaUrl;
                else if (post.mediaUrls && post.mediaUrls.length > 0) finalImage = post.mediaUrls[0];

                const isYoutube = getYouTubeId(finalImage) !== null;

                return {
                    id: post.id,
                    title: post.title || "",
                    content: post.content || post.text || "",
                    author: post.authorName || post.user?.username || "Anonymous",
                    avatar: post.authorAvatar || post.user?.photoURL || null,
                    image: finalImage,
                    isYoutube: isYoutube,
                    timestamp: post.timestamp
                };
            });

            // Aturan Client: Gabungkan data lama + baru tanpa duplikasi
            setPosts(prevPosts => {
                const existingIds = new Set(prevPosts.map(p => p.id));
                const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
                return [...prevPosts, ...uniqueNewPosts];
            });

            // Aturan Pagination 5: Jika nextCursor = null, hentikan
            if (data.nextCursor) {
                setNextCursor(data.nextCursor);
                setHasMore(true);
            } else {
                setNextCursor(null);
                setHasMore(false);
            }

        } catch (e) {
            console.error("Gagal load Kreata posts", e);
        } finally {
            setLoading(false);
        }
    };

    // --- AUDIO HANDLING ---
    const playClick = () => {
        audioClick.current.currentTime = 0;
        audioClick.current.volume = 0.5;
        audioClick.current.play().catch(() => {});
    };

    const toggleMusic = () => {
        if (isMuted) {
            bgMusic.current.play().catch(e => console.log("Audio play failed:", e));
        } else {
            bgMusic.current.pause();
        }
        setIsMuted(!isMuted);
    };

    const startRoom = () => {
        // TRIGGER AUDIO PADA INTERAKSI USER AGAR TIDAK DIBLOKIR BROWSER
        playClick();
        
        bgMusic.current.loop = true;
        bgMusic.current.volume = 0.3;
        
        const playPromise = bgMusic.current.play();
        
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                // Autoplay started!
                setIsMuted(false);
            })
            .catch(error => {
                // Autoplay was prevented.
                console.log("Autoplay prevented by browser, waiting for manual interaction");
                setIsMuted(true);
            });
        }

        setHasStarted(true);
        // Request pertama TIDAK mengirim cursor (sesuai aturan 1)
        fetchKreataPosts(null);
    };

    const handleShare = async (post) => {
        playClick();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Postingan ${post.author} di Kreata`,
                    text: post.content.substring(0, 50) + '...',
                    url: `https://app.bgunenet.my.id/?post=${post.id}`
                });
            } catch (error) { console.log('Error sharing:', error); }
        } else {
            navigator.clipboard.writeText(`https://app.bgunenet.my.id/?post=${post.id}`);
            alert('Link disalin ke clipboard!');
        }
    };

    const handleViewDetail = (postId) => {
        playClick();
        window.location.href = `/?post=${postId}`;
    };

    // --- INTRO SCREEN ---
    if (!hasStarted) {
        return (
            <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                <div className="absolute w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse"></div>

                <div className="relative z-10 animate-fade-in">
                    <div className="relative mb-8 inline-block cursor-pointer group" onClick={startRoom}>
                        <div className="absolute inset-0 bg-emerald-500 rounded-[35px] blur-xl opacity-40 group-hover:opacity-60 transition duration-500"></div>
                        <img src={KREATA_LOGO} className="relative w-36 h-36 rounded-[35px] border-4 border-[#020617] shadow-2xl object-cover transform group-hover:scale-105 transition duration-500" alt="Logo" />
                    </div>

                    <h1 className="text-5xl font-black text-white italic mb-3 tracking-tighter drop-shadow-2xl">
                        KREATA <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">ROOM</span>
                    </h1>
                    <p className="text-slate-400 text-sm mb-12 font-medium tracking-widest uppercase">
                        Tempat Karya Berkumpul
                    </p>

                    <button onClick={startRoom} className="relative group bg-white text-black pl-8 pr-10 py-4 rounded-full font-black uppercase text-sm tracking-[0.2em] transition-all hover:bg-emerald-400 hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.1)] flex items-center gap-3 mx-auto overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-full -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        <Play size={20} fill="black" /> MASUK SEKARANG
                    </button>
                </div>
            </div>
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/40 pb-32">

            {/* HEADER */}
            <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 px-4 flex items-center justify-between">
                <button onClick={() => { playClick(); setPage && setPage('home'); }} className="p-2 rounded-xl active:scale-95 transition-transform hover:bg-white/5">
                    <ArrowLeft size={24} className="text-slate-100" />
                </button>
                <div className="flex flex-col items-center" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
                    <span className="font-black italic text-xl text-white uppercase tracking-tighter cursor-pointer">KREATA</span>
                </div>
                <button onClick={toggleMusic} className={`p-2 rounded-xl transition-all hover:bg-white/5 ${isMuted ? 'text-slate-500' : 'text-emerald-400'}`}>
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} className="animate-pulse" />}
                </button>
            </nav>

            <div className="max-w-md mx-auto px-4 pt-24 space-y-8">

                {/* INFO BANNER (DIKEMBALIKAN LENGKAP) */}
                <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-[24px] p-5 border border-white/10 relative overflow-hidden shadow-2xl">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <img src={KREATA_LOGO} className="w-14 h-14 rounded-2xl shadow-lg ring-2 ring-white/10" alt="Icon" />
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-wide mb-1">Official Feed</h2>
                            <div className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                Biar muncul disini posting menggunakan hastag <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">#kreata</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 text-[10px] text-slate-500 leading-4 line-clamp-2 hover:line-clamp-none transition-all cursor-pointer">
                        Kreata Community adalah wadah kolaborasi komunitas Koloxe, Amethyst, dan McCreata bersama BguneNet.
                    </div>

                    <div className="flex gap-3 mt-5">
                        <a href="https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss" target="_blank" rel="noreferrer" onClick={playClick}
                           className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-black py-2.5 rounded-xl font-bold text-[10px] uppercase shadow-lg active:scale-95 transition-all">
                            <MessageCircle size={14} fill="black" /> Grup WA
                        </a>
                        <a href="https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j" target="_blank" rel="noreferrer" onClick={playClick}
                           className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl font-bold text-[10px] uppercase border border-white/10 active:scale-95 transition-all">
                            <Bell size={14} fill="white" /> Saluran
                        </a>
                    </div>
                </div>

                {/* FEED LIST */}
                <div className="space-y-8">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-emerald-500 fill-emerald-500" />
                            <h3 className="text-sm font-black uppercase text-white tracking-widest">Karya Terbaru</h3>
                        </div>
                        {loading && posts.length > 0 && <Loader2 className="animate-spin text-emerald-500" size={18} />}
                    </div>

                    {posts.length === 0 && !loading ? (
                        <div className="text-center py-20 bg-white/5 rounded-[30px] border border-dashed border-white/10 mx-2">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Belum ada karya baru</p>
                        </div>
                    ) : (
                        posts.map((post, index) => {
                            // Cek jika ini elemen terakhir untuk Infinite Scroll
                            const isLastElement = posts.length === index + 1;
                            
                            return (
                                <div 
                                    key={post.id} 
                                    ref={isLastElement ? lastPostElementRef : null}
                                    className="group bg-[#0f111a] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl hover:border-white/10 transition-colors"
                                >
                                    {/* AUTHOR HEADER */}
                                    <div className="p-4 flex items-center gap-3 bg-[#131620]/50 backdrop-blur-sm">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-emerald-500 blur opacity-20 rounded-full"></div>
                                            <img 
                                                src={post.avatar || `https://ui-avatars.com/api/?name=${post.author}&background=random`} 
                                                onError={(e) => {
                                                    e.target.onerror = null; 
                                                    e.target.src = `https://ui-avatars.com/api/?name=${post.author}&background=10b981&color=fff&size=128`;
                                                }}
                                                className="relative w-10 h-10 rounded-full bg-slate-800 object-cover ring-2 ring-[#1e293b]" 
                                                alt="Avatar" 
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-white truncate">{post.author}</h4>
                                            <p className="text-[10px] text-emerald-500/80 uppercase tracking-wider font-bold">Creator</p>
                                        </div>
                                        <button onClick={() => handleShare(post)} className="text-slate-600 hover:text-white p-2 transition-colors">
                                            <Share2 size={18} />
                                        </button>
                                    </div>

                                    {/* CONTENT BODY */}
                                    <div>
                                        {/* LOGIKA YOUTUBE / GAMBAR */}
                                        {post.image && (
                                            post.isYoutube ? (
                                                <YouTubeEmbed url={post.image} />
                                            ) : (
                                                <div className="w-full bg-black relative border-y border-white/5 group-hover:border-white/10 transition-colors">
                                                    <img 
                                                        src={post.image} 
                                                        className="w-full h-auto max-h-[500px] object-contain mx-auto" 
                                                        alt="Content" 
                                                        loading="lazy" 
                                                    />
                                                </div>
                                            )
                                        )}

                                        {/* Text Area dengan Parser Asli */}
                                        <div className="p-5 bg-gradient-to-b from-[#0f111a] to-[#0a0c12]">
                                            <ExpandableText content={post.content} />
                                        </div>
                                    </div>

                                    {/* ACTION BUTTONS */}
                                    <div className="p-4 pt-0 flex gap-3">
                                        <button 
                                            onClick={() => handleShare(post)}
                                            className="flex-1 bg-slate-800/50 hover:bg-slate-800 text-slate-300 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-wide flex items-center justify-center gap-2 transition-all border border-white/5 hover:border-white/20"
                                        >
                                            <Share2 size={16} /> Share
                                        </button>
                                        <button 
                                            onClick={() => handleViewDetail(post.id)}
                                            className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
                                        >
                                            <ExternalLink size={16} /> Buka Postingan
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* LOADER BOTTOM & END OF FEED */}
                {loading && posts.length > 0 && (
                     <div className="pb-10 pt-4 flex justify-center">
                        <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                            <Loader2 className="animate-spin text-emerald-500" size={16} />
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Memuat karya...</span>
                        </div>
                    </div>
                )}
                
                {!hasMore && posts.length > 0 && (
                    <div className="pb-10 pt-4 flex justify-center opacity-20">
                         <div className="w-16 h-1.5 bg-slate-700 rounded-full"></div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default KreataRoom;