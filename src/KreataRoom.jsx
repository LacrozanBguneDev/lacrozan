// FILE: KreataRoom.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Loader2, Heart, MessageSquare, Zap, Info, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';

const FIXED_POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const FIXED_USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";
const KREATA_ROOM_IMG = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

const KreataRoom = ({ setPage, db, onPostClick }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFullInfo, setShowFullInfo] = useState(false);

    useEffect(() => {
        const fetchKreataPosts = async () => {
            if (!db) return;
            setLoading(true);
            
            try {
                // Trik: Ambil koleksi tanpa limit & tanpa query kompleks agar tidak error index
                const postsRef = collection(db, FIXED_POSTS_PATH);
                const querySnapshot = await getDocs(postsRef);
                
                console.log("Total postingan di DB:", querySnapshot.size); // Cek angka ini di konsol!

                const filtered = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Gabungkan semua field jadi satu string panjang agar pencarian luas
                    const allText = `${data.content} ${data.title} ${data.category}`.toLowerCase();

                    if (allText.includes('kreata')) {
                        filtered.push({ id: doc.id, ...data });
                    }
                });

                // Urutkan manual terbaru ke terlama
                filtered.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

                // Ambil data user
                const enriched = await Promise.all(filtered.map(async (p) => {
                    if (p.user?.username) return p;
                    try {
                        const uSnap = await getDoc(doc(db, FIXED_USERS_PATH, p.userId));
                        return uSnap.exists() ? { ...p, user: uSnap.data() } : p;
                    } catch { return p; }
                }));

                setPosts(enriched);
            } catch (err) {
                console.error("Error fatal:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchKreataPosts();
    }, [db]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gray-900 pb-20">
            {/* Header / Hero */}
            <div className="relative h-64 overflow-hidden">
                <button onClick={() => setPage('home')} className="absolute top-5 left-5 z-20 bg-black/20 p-2 rounded-full text-white"><ArrowLeft /></button>
                <img src={KREATA_ROOM_IMG} className="w-full h-full object-cover" alt="Hero" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-gray-900 via-transparent" />
                <div className="absolute bottom-5 left-5 text-gray-900 dark:text-white">
                    <h1 className="text-3xl font-black">KREATA <span className="text-emerald-500">ROOM</span></h1>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 mt-4">
                {/* Info Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm mb-8 border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        <strong>Kreata Room</strong> adalah tempat berkumpulnya komunitas Koloxe, Amethyst, dan McCreata.
                    </p>
                    <div className="flex gap-3 mt-4">
                        <a href="https://whatsapp.com/channel/0029VaJi0RuHFxOubage052j" target="_blank" className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-center text-xs font-bold">Saluran WA</a>
                        <a href="https://chat.whatsapp.com/FFrhElhRj4bFLCy0HZszss" target="_blank" className="flex-1 border-2 border-emerald-500 text-emerald-500 py-2 rounded-xl text-center text-xs font-bold">Grup WA</a>
                    </div>
                </div>

                {/* Feed */}
                <h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><Zap className="text-yellow-500" size={18} /> Sorotan Komunitas</h3>
                
                {loading ? (
                    <div className="flex flex-col items-center py-10"><Loader2 className="animate-spin text-emerald-500" /></div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-200">
                        <Info className="mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">Postingan #kreata belum ditemukan.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {posts.map(post => (
                            <div key={post.id} onClick={() => onPostClick(post.id)} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer">
                                <div className="flex items-center gap-2 mb-3">
                                    <img src={post.user?.photoURL || "https://c.termai.cc/i150/VrL65.png"} className="w-7 h-7 rounded-full object-cover" />
                                    <span className="text-xs font-bold dark:text-white">{post.user?.username || 'User'}</span>
                                </div>
                                {post.mediaUrl && <img src={post.mediaUrl} className="w-full aspect-video object-cover rounded-lg mb-3" />}
                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{post.content}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default KreataRoom;