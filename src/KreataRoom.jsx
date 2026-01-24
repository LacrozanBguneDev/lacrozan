// FILE: KreataRoom.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Loader2, Heart, MessageSquare, ExternalLink, Zap, Info } from 'lucide-react';
import { 
    collection, 
    query, 
    orderBy, 
    limit, 
    getDocs,
    getDoc,
    doc
} from 'firebase/firestore'; 

const KREATA_ROOM_IMG = "https://pps.whatsapp.net/v/t61.24694-24/589137632_699462376256774_4015928659271543310_n.jpg?ccb=11-4&oh=01_Q5Aa3gGcFo2V9Ja8zyVYcgS8UqCyLnu5EF0-CrpWr4rT4w9ACQ&oe=697BB8E2&_nc_sid=5e03e0&_nc_cat=101";

const KreataRoom = ({ setPage, db, onPostClick, postsPath, usersPath }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchKreataPosts = async () => {
            if (!db) return;
            
            // Gunakan path yang dikirim atau fallback ke path yang kamu berikan di contoh
            const finalPostsPath = postsPath || 'artifacts/default-app-id/public/data/posts';
            const finalUsersPath = usersPath || 'artifacts/default-app-id/public/data/userProfiles';

            setLoading(true);
            try {
                const postsRef = collection(db, finalPostsPath);
                // Ambil lebih banyak (100) untuk memastikan kita tidak melewatkan post ber-hashtag
                const q = query(postsRef, orderBy('timestamp', 'desc'), limit(100));
                
                const querySnapshot = await getDocs(q);
                const rawPosts = [];

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const contentText = data.content || "";
                    
                    // Filter yang lebih kuat: bersihkan spasi dan cek hashtag
                    if (contentText.toLowerCase().includes('#kreata')) {
                        rawPosts.push({ id: doc.id, ...data });
                    }
                });

                // Sinkronisasi data user (mengatasi masalah foto/nama hilang)
                const enrichedPosts = await Promise.all(rawPosts.map(async (p) => {
                    try {
                        const userRef = doc(db, finalUsersPath, p.userId);
                        const userSnap = await getDoc(userRef);
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            return { 
                                ...p, 
                                displayUser: {
                                    username: userData.username || p.user?.username || 'User',
                                    photoURL: userData.photoURL || p.user?.photoURL || ''
                                }
                            };
                        }
                    } catch (e) { console.error("User fetch error", e); }
                    
                    return { 
                        ...p, 
                        displayUser: {
                            username: p.user?.username || 'User',
                            photoURL: p.user?.photoURL || ''
                        }
                    };
                }));

                setPosts(enrichedPosts);
            } catch (error) {
                console.error("Gagal memuat Kreata feed:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchKreataPosts();
    }, [db, postsPath, usersPath]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 pb-20">
            {/* HERO */}
            <div className="relative h-64 w-full overflow-hidden">
                <button onClick={() => setPage('home')} className="absolute top-6 left-6 z-20 bg-black/30 p-2 rounded-full text-white"><ArrowLeft size={20} /></button>
                <img src={KREATA_ROOM_IMG} className="w-full h-full object-cover" alt="Hero"/>
                <div className="absolute inset-0 bg-gradient-to-t from-[#F8FAFC] dark:from-gray-900 to-transparent"></div>
                <div className="absolute bottom-6 left-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase">Kreata <span className="text-emerald-500">Room</span></h1>
                </div>
            </div>

            {/* INFO BOX */}
            <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        <strong>Kreata Community</strong> adalah wadah kolaborasi komunitas Koloxe, Amethyst, dan McCreata. 
                        Bekerja sama dengan <strong>BguneNet</strong> untuk menyediakan ruang kreatif bagi para creator digital.
                    </p>
                    
                    {/* HOW TO INFO */}
                    <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                        <Info className="text-emerald-600 shrink-0" size={20} />
                        <p className="text-xs text-emerald-800 dark:text-emerald-400">
                            Tambahkan hashtag <span className="font-bold">#kreata</span> pada postinganmu agar otomatis muncul di sini!
                        </p>
                    </div>
                </div>
            </div>

            {/* GRID POSTINGAN */}
            <div className="max-w-4xl mx-auto px-4 mt-8">
                <h3 className="font-bold flex items-center gap-2 mb-6 dark:text-white"><Zap size={18} className="text-yellow-500 fill-yellow-500"/> Postingan Komunitas</h3>
                
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">Belum ada postingan #kreata yang ditemukan.</p>
                        <p className="text-xs text-gray-400 mt-2">Pastikan kamu sudah mengetik hashtag dengan benar.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {posts.map((post) => (
                            <div key={post.id} onClick={() => onPostClick(post.id)} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-lg transition cursor-pointer">
                                <div className="p-3 flex items-center gap-2 border-b dark:border-gray-700">
                                    <img src={post.displayUser?.photoURL || "https://c.termai.cc/i150/VrL65.png"} className="w-6 h-6 rounded-full object-cover" />
                                    <span className="text-xs font-bold dark:text-white">{post.displayUser?.username}</span>
                                </div>
                                {post.mediaUrl && (
                                    <div className="aspect-video bg-gray-100 dark:bg-gray-900">
                                        <img src={post.mediaUrl} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="p-4">
                                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{post.content}</p>
                                    <div className="flex gap-4 mt-4 text-gray-400 text-xs">
                                        <div className="flex items-center gap-1"><Heart size={14} /> {post.likes?.length || 0}</div>
                                        <div className="flex items-center gap-1"><MessageSquare size={14} /> {post.commentsCount || 0}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default KreataRoom;