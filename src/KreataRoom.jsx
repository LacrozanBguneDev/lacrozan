import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, MessageCircle, Sparkles, Check, 
    Volume2, VolumeX, Bell, ExternalLink, 
    Heart, MessageSquare, Loader2, Play
} from 'lucide-react';

const KREATA_LOGO = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

const KreataRoom = ({ setPage, user, onLike, onComment }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    // Audio Refs
    const audioClick = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'));
    const bgMusic = useRef(new Audio('https://www.bensound.com/bensound-music/bensound-evolution.mp3')); // Ganti dengan URL lagu santai yang valid

    useEffect(() => {
        fetchKreataPosts();
        bgMusic.current.loop = true;
        bgMusic.current.volume = 0.2;

        return () => {
            bgMusic.current.pause();
        };
    }, []);

    const fetchKreataPosts = async () => {
        try {
            setLoading(true);
            // Menggunakan API Search yang baru dibuat
            const res = await fetch('https://app.bgunenet.my.id/api/feed?mode=search&q=#kreata&limit=20');
            const data = await res.json();
            setPosts(data.posts || []);
        } catch (e) {
            console.error("Gagal load Kreata posts", e);
        } finally {
            setLoading(false);
        }
    };

    const playClick = () => {
        audioClick.current.currentTime = 0;
        audioClick.current.play().catch(() => {});
    };

    const toggleMusic = () => {
        if (isMuted) {
            bgMusic.current.play();
        } else {
            bgMusic.current.pause();
        }
        setIsMuted(!isMuted);
    };

    const startRoom = () => {
        setHasStarted(true);
        bgMusic.current.play().catch(() => {});
    };

    if (!hasStarted) {
        return (
            <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse"></div>
                    <img src={KREATA_LOGO} className="w-32 h-32 rounded-[40px] relative z-10 border-2 border-emerald-500/50" alt="Logo" />
                </div>
                <h1 className="text-3xl font-black text-white italic mb-2 uppercase tracking-tighter">KREATA <span className="text-emerald-500">ROOM</span></h1>
                <p className="text-slate-400 text-sm mb-8 max-w-xs font-medium">Masuki ekosistem kreatif editor masa depan.</p>
                <button 
                    onClick={startRoom}
                    className="group relative flex items-center gap-3 bg-white text-black px-10 py-4 rounded-full font-black uppercase text-sm tracking-widest hover:scale-105 active:scale-95 transition-all"
                >
                    <Play size={18} fill="black" /> Masuk Room
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pb-24 font-sans selection:bg-emerald-500/30">
            
            {/* STICKY HEADER */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 px-4 h-16 flex items-center justify-between">
                <button onClick={() => { playClick(); setPage('home'); }} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-emerald-500 tracking-[0.3em] uppercase leading-none">Official</span>
                    <span className="font-black italic text-lg uppercase leading-none">KREATA</span>
                </div>
                <button onClick={toggleMusic} className="p-2 hover:bg-white/5 rounded-full transition-colors text-emerald-400">
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} className="animate-bounce" />}
                </button>
            </nav>

            <div className="max-w-xl mx-auto px-4 pt-24 space-y-6">
                
                {/* HERO & BRANDING GABUNGAN */}
                <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600/20 to-blue-600/10 rounded-[45px] border border-white/10 p-8 shadow-2xl">
                    <Sparkles className="absolute top-4 right-4 text-emerald-500/20" size={60} />
                    
                    <div className="flex items-start gap-5 mb-8">
                        <img src={KREATA_LOGO} className="w-20 h-20 rounded-[28px] border-2 border-emerald-500 shadow-lg" alt="Logo" />
                        <div>
                            <h2 className="text-2xl font-black italic uppercase tracking-tighter">The Ecosystem</h2>
                            <p className="text-xs text-emerald-400/80 font-bold uppercase tracking-widest mt-1">Partner Official BguneNet</p>
                            <div className="flex gap-2 mt-3">
                                <span className="px-3 py-1 bg-emerald-500/10 rounded-full text-[10px] font-black uppercase text-emerald-400 border border-emerald-500/20">Verified Room</span>
                                <span className="px-3 py-1 bg-blue-500/10 rounded-full text-[10px] font-black uppercase text-blue-400 border border-blue-500/20">Creative Hub</span>
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed font-medium mb-8">
                        Ekosistem kolaborasi kreatif untuk para editor. Gunakan perlindungan sistem BguneNet untuk berkarya tanpa batas.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <a href="https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss" target="_blank" rel="noreferrer" onClick={playClick}
                           className="flex items-center justify-center gap-2 bg-[#25D366] text-black py-4 rounded-3xl font-black text-[10px] uppercase tracking-tighter hover:scale-105 transition-transform">
                            <MessageCircle size={18} fill="black" /> Grup WA
                        </a>
                        <a href="https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j" target="_blank" rel="noreferrer" onClick={playClick}
                           className="flex items-center justify-center gap-2 bg-white text-black py-4 rounded-3xl font-black text-[10px] uppercase tracking-tighter hover:scale-105 transition-transform">
                            <Bell size={18} fill="black" /> Saluran
                        </a>
                    </div>
                </section>

                {/* INFO HASTAG */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shrink-0">
                        <Check size={24} />
                    </div>
                    <div>
                        <h4 className="text-xs font-black uppercase italic">Ingin masuk ke halaman ini?</h4>
                        <p className="text-[11px] text-slate-400">Gunakan hashtag <span className="text-emerald-400 font-bold">#kreata</span> di setiap postinganmu agar muncul secara otomatis di feed komunitas.</p>
                    </div>
                </div>

                {/* FEED KOMUNITAS */}
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="font-black italic uppercase text-sm tracking-widest text-emerald-500">Highlights Feed</h3>
                        {loading && <Loader2 className="animate-spin text-emerald-500" size={18} />}
                    </div>

                    {posts.length === 0 && !loading ? (
                        <div className="text-center py-20 opacity-40">
                            <p className="text-sm italic font-bold">Belum ada karya dengan #kreata</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {posts.map((post) => (
                                <div key={post.id} className="bg-slate-900/50 border border-white/5 rounded-[32px] overflow-hidden group">
                                    {/* Post Header */}
                                    <div className="p-4 flex items-center gap-3">
                                        <img src={post.authorAvatar || post.userAvatar} className="w-10 h-10 rounded-full border border-white/10" alt="Avatar" />
                                        <div>
                                            <h4 className="text-xs font-black uppercase italic leading-none">{post.authorName}</h4>
                                            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Post via Kreata Room</span>
                                        </div>
                                    </div>
                                    
                                    {/* Post Content */}
                                    {post.image && (
                                        <img src={post.image} className="w-full aspect-square object-cover" alt="Karya" />
                                    )}
                                    
                                    <div className="p-5">
                                        <p className="text-xs text-slate-300 leading-relaxed mb-4 line-clamp-3">
                                            {post.text || post.caption}
                                        </p>
                                        
                                        {/* Actions terintegrasi dengan App.jsx */}
                                        <div className="flex items-center gap-6">
                                            <button 
                                                onClick={() => { playClick(); onLike(post.id); }}
                                                className={`flex items-center gap-2 transition-colors ${post.likes?.includes(user?.uid) ? 'text-rose-500' : 'text-slate-500'}`}
                                            >
                                                <Heart size={20} fill={post.likes?.includes(user?.uid) ? "currentColor" : "none"} />
                                                <span className="text-xs font-black">{post.likeCount || 0}</span>
                                            </button>
                                            <button 
                                                onClick={() => { playClick(); onComment(post); }}
                                                className="flex items-center gap-2 text-slate-500"
                                            >
                                                <MessageSquare size={20} />
                                                <span className="text-xs font-black">{post.commentCount || 0}</span>
                                            </button>
                                            <button className="ml-auto text-slate-500">
                                                <ExternalLink size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="py-10 text-center">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Secure Creative Connection</p>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;