// FILE: KreataRoom.jsx (FINAL ULTIMATE VERSION)
import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Users, Zap, MessageCircle, Gamepad2, Trophy, Sparkles, 
    Rocket, Star, Heart, ShieldCheck, Fingerprint, Volume2, UserPlus, 
    Check, Activity, Target, Share2, Info, Bell, ShieldAlert
} from 'lucide-react';

// URL Logo dan Background (Pastikan URL ini valid)
const KREATA_LOGO = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

const KreataRoom = ({ setPage }) => {
    const [isFollowed, setIsFollowed] = useState(false);
    const [activeTab, setActiveTab] = useState('info');
    const [gameClicks, setGameClicks] = useState(0);
    const [isMuted, setIsMuted] = useState(false);

    // Audio Engine
    const audioClick = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'));
    const audioSuccess = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'));
    const audioPop = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'));

    useEffect(() => {
        // Cek status join di memori HP (Local Storage)
        const status = localStorage.getItem('kreata_member_status');
        if (status === 'joined') setIsFollowed(true);
    }, []);

    const playSound = (sound) => {
        if (isMuted) return;
        sound.current.currentTime = 0;
        sound.current.play().catch(() => {});
    };

    const handleJoin = () => {
        if (isFollowed) return;
        playSound(audioSuccess);
        setIsFollowed(true);
        localStorage.setItem('kreata_member_status', 'joined');
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 pb-20 font-sans selection:bg-emerald-500/30">
            
            {/* --- TOP BRANDING --- */}
            <div className="relative h-80 w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent z-10" />
                <div className="absolute inset-0 bg-[#020617]/40 backdrop-blur-[2px] z-10" />
                
                {/* Back Button */}
                <button onClick={() => { playSound(audioClick); setPage('home'); }} 
                    className="absolute top-6 left-6 z-50 bg-white/5 backdrop-blur-2xl p-4 rounded-3xl border border-white/10 hover:bg-emerald-500 transition-all">
                    <ArrowLeft size={20} />
                </button>

                {/* Sound Toggle */}
                <button onClick={() => setIsMuted(!isMuted)} 
                    className="absolute top-6 right-6 z-50 bg-white/5 backdrop-blur-2xl p-4 rounded-3xl border border-white/10">
                    {isMuted ? <Volume2 className="opacity-20" size={20} /> : <Volume2 className="text-emerald-400 animate-pulse" size={20} />}
                </button>

                {/* LOGO AREA */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pt-10">
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-emerald-500/30 rounded-full blur-2xl group-hover:bg-emerald-500/50 transition-all duration-700" />
                        <img src={KREATA_LOGO} className="relative w-32 h-32 rounded-[40px] border-4 border-emerald-500 shadow-2xl object-cover transform transition-transform group-hover:scale-105" alt="Logo" />
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-xl shadow-lg border-2 border-[#020617]">
                            <ShieldCheck size={16} className="text-black" />
                        </div>
                    </div>
                    <h1 className="mt-6 text-4xl font-black italic tracking-tighter text-white">KREATA <span className="text-emerald-500">ROOM</span></h1>
                    <p className="text-[10px] font-black tracking-[0.4em] text-emerald-400/60 uppercase">Ecosystem Hub v5.0</p>
                </div>
            </div>

            <div className="max-w-xl mx-auto px-6">
                
                {/* --- NAVIGATION TABS --- */}
                <div className="flex gap-2 p-1.5 bg-slate-900/80 backdrop-blur-3xl rounded-[28px] border border-white/5 mb-8 sticky top-6 z-50 shadow-2xl">
                    {[
                        { id: 'info', icon: <Info size={16}/>, label: 'HUB' },
                        { id: 'game', icon: <Gamepad2 size={16}/>, label: 'GAMES' },
                        { id: 'safety', icon: <ShieldAlert size={16}/>, label: 'SAFETY' }
                    ].map((tab) => (
                        <button key={tab.id} onClick={() => { playSound(audioClick); setActiveTab(tab.id); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === tab.id ? 'bg-emerald-500 text-black' : 'text-slate-500 hover:text-slate-300'
                            }`}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* --- CONTENT: HUB INFO --- */}
                {activeTab === 'info' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Status Join (Static Simulation) */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden">
                            <Sparkles className="absolute top-4 right-4 text-emerald-500/20" />
                            <h3 className="text-xl font-black italic mb-2 tracking-tight">COMMUNITY ACCESS</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">Status: {isFollowed ? 'Verified Member' : 'Guest'}</p>
                            
                            <button onClick={handleJoin}
                                className={`w-full py-5 rounded-[22px] font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 ${
                                    isFollowed 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default' 
                                    : 'bg-white text-black hover:scale-[1.02] active:scale-95 shadow-xl'
                                }`}>
                                {isFollowed ? <><Check size={18}/> Joined Today</> : <><UserPlus size={18}/> Join Room Now</>}
                            </button>
                        </div>

                        {/* WA Group & Channel */}
                        <div className="grid grid-cols-1 gap-4">
                            <a href="https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss" target="_blank" rel="noreferrer"
                                className="group p-6 bg-slate-900/50 rounded-[35px] border border-white/5 flex items-center justify-between hover:border-emerald-500/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-500 group-hover:scale-110 transition-transform">
                                        <MessageCircle size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-black italic uppercase text-sm tracking-tight">Main Group</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">Diskusi & Kolaborasi</p>
                                    </div>
                                </div>
                                <Zap size={18} className="text-slate-700 group-hover:text-emerald-500" />
                            </a>

                            <a href="https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j" target="_blank" rel="noreferrer"
                                className="group p-6 bg-slate-900/50 rounded-[35px] border border-white/5 flex items-center justify-between hover:border-blue-500/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-500/10 p-4 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform">
                                        <Bell size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-black italic uppercase text-sm tracking-tight">Official Channel</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">Informasi & Update</p>
                                    </div>
                                </div>
                                <Zap size={18} className="text-slate-700 group-hover:text-blue-500" />
                            </a>
                        </div>
                    </div>
                )}

                {/* --- CONTENT: GAMES --- */}
                {activeTab === 'game' && (
                    <div className="space-y-6 animate-in zoom-in duration-500">
                        <div className="bg-slate-900/50 p-10 rounded-[45px] border border-white/5 text-center">
                            <div className="inline-block p-4 bg-emerald-500/10 rounded-full mb-6">
                                <Target className="text-emerald-400 animate-pulse" size={40} />
                            </div>
                            <h3 className="text-2xl font-black italic uppercase mb-2 tracking-tighter">REFLEX TRAINER</h3>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-8">Buktikan kecepatan jarimu!</p>
                            
                            <div className="text-7xl font-black text-white italic mb-10 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                {gameClicks}
                            </div>

                            <button onClick={() => { playSound(audioPop); setGameClicks(c => c + 1); }}
                                className="w-28 h-28 bg-emerald-500 rounded-full mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)] active:scale-90 transition-all border-8 border-[#020617]">
                                <Zap size={32} fill="black" />
                            </button>
                        </div>
                        
                        <div className="p-6 bg-slate-900/50 rounded-[35px] border border-white/5 flex items-center gap-4">
                            <Trophy className="text-yellow-500" size={24} />
                            <p className="text-[10px] font-black uppercase text-slate-400">Mainkan game untuk menghilangkan bosan saat menunggu update!</p>
                        </div>
                    </div>
                )}

                {/* --- CONTENT: SAFETY --- */}
                {activeTab === 'safety' && (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                        <div className="bg-emerald-500/5 p-8 rounded-[40px] border border-emerald-500/20">
                            <h3 className="text-xl font-black italic uppercase mb-6 tracking-tight flex items-center gap-3 text-emerald-400">
                                <ShieldCheck size={24}/> SAFETY ANALYSIS
                            </h3>
                            
                            <div className="space-y-6">
                                <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex justify-between text-[9px] font-black uppercase mb-3 text-slate-400 tracking-widest">
                                        <span>Spam Protection</span>
                                        <span className="text-emerald-400 font-black">99.9% ACTIVE</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-[99%] animate-pulse"></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {[
                                        { icon: <Fingerprint size={18}/>, text: 'No Account Data Required' },
                                        { icon: <Activity size={18}/>, text: 'Local Membership System' },
                                        { icon: <Share2 size={18}/>, text: 'Safe Collaborative Bridge' }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl">
                                            <div className="text-emerald-500">{item.icon}</div>
                                            <span className="text-[10px] font-black uppercase text-slate-300">{item.text}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 border-l-4 border-emerald-500 bg-emerald-500/5 rounded-r-2xl">
                                    <p className="text-[10px] font-bold leading-relaxed text-slate-400">
                                        Selalu gunakan hashtag <span className="text-emerald-400">#kreata</span> untuk setiap postingan karya agar sistem kolaborator dapat mendeteksi konten kamu secara sehat.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- FOOTER MANTRA --- */}
                <div className="mt-20 text-center opacity-40 group">
                    <Heart size={20} className="mx-auto text-emerald-500 mb-4 group-hover:scale-125 transition-transform" fill="currentColor" />
                    <h4 className="text-[10px] font-black italic tracking-[0.5em] uppercase text-slate-500">
                        Creative • Collaborative • Secure
                    </h4>
                    <p className="text-[8px] font-bold text-slate-600 mt-2 uppercase tracking-widest">Powered by BguneNet Engine</p>
                </div>
            </div>
        </div>
    );
};

export default KreataRoom;