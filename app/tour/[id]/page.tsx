"use client";
import { useState, useEffect, useRef } from 'react';
import { useParams } from "next/navigation";
import { supabase } from "../../supabase";
import Link from "next/link";

export default function TourPage() {
  const params = useParams();

  const [lang, setLang]                         = useState<'ru' | 'en'>('ru');
  const [isReady, setIsReady]                   = useState(false);
  const [tour, setTour]                         = useState<any>(null);
  const [loading, setLoading]                   = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [ref, setRef]                           = useState<string>('');
  const [showModal, setShowModal]               = useState(false);
  const [selectedDate, setSelectedDate]         = useState('');
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [isSubmitted, setIsSubmitted]           = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchEndX   = useRef<number | null>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem('userLang');
    if (savedLang === 'en' || savedLang === 'ru') setLang(savedLang as 'ru' | 'en');
    setIsReady(true);

    // ── Telegram ref logic ─────────────────────────────────────────────────
    const initRefLogic = () => {
      const tg = (window as any).Telegram?.WebApp;
      const urlParams = new URLSearchParams(window.location.search);
      const startParam = urlParams.get('tgWebAppStartParam') || tg?.initDataUnsafe?.start_param;
      const savedRef = localStorage.getItem('referrer');
      if (startParam) { setRef(startParam); localStorage.setItem('referrer', startParam); return true; }
      else if (savedRef) { setRef(savedRef); return true; }
      return false;
    };
    initRefLogic();
    const interval = setInterval(() => { if (initRefLogic()) clearInterval(interval); }, 500);
    setTimeout(() => clearInterval(interval), 2000);

    // ── Telegram WebApp init ───────────────────────────────────────────────
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor)     tg.setHeaderColor('#060810');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#060810');
    }

    // ── Load tour ──────────────────────────────────────────────────────────
    async function loadTour() {
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .eq('id', params.id)
        .single();
      if (!error && data) setTour(data);
      setLoading(false);
    }
    if (params.id) loadTour();
    return () => clearInterval(interval);
  }, [params.id]);

  // ── Booking: одна дата тура ────────────────────────────────────────────────
  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      alert(lang === 'ru' ? 'Выберите дату' : 'Select a date');
      return;
    }
    setIsSubmitting(true);
    const tg   = (window as any).Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;

    const bookingData = {
      bike_id:         tour.id,
      bike_model:      tour.name_ru,
      start_date:      selectedDate,
      end_date:        selectedDate,
      client_username: user?.username || 'web_user',
      telegram_id:     user?.id,
      referrer:        ref,
      total_price:     (tour.price ? Number(tour.price).toLocaleString() : '—') + ' VND',
    };

    try {
      // Сохраняем в БД и получаем id записи
      const { data: newBooking, error: dbError } = await supabase
        .from('bookings').insert([bookingData]).select().single();
      if (dbError) throw dbError;

      // Отправляем уведомление боту с booking_id
      await fetch('/api/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bookingData, booking_id: newBooking?.id }),
      });

      setIsSubmitted(true);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Swipe ──────────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX; };
  const onTouchMove  = (e: React.TouchEvent) => { touchEndX.current   = e.targetTouches[0].clientX; };
  const onTouchEnd   = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const d = touchStartX.current - touchEndX.current;
    if (d >  50 && activePhotoIndex < gallery.length - 1) setActivePhotoIndex(p => p + 1);
    if (d < -50 && activePhotoIndex > 0)                  setActivePhotoIndex(p => p - 1);
    touchStartX.current = null; touchEndX.current = null;
  };

  // ── i18n ───────────────────────────────────────────────────────────────────
  const t = {
    ru: {
      back: '← Назад', btn: 'Забронировать',
      description: 'Описание', category: 'Категория',
      duration: 'Длительность', price: 'Цена тура', hours: 'ч',
      modalSub: 'Выберите дату тура', labelDate: 'Дата',
      submitBtn: 'Отправить запрос',
      successTitle: 'Запрос принят!',
      successText: 'Мы уже связываемся с организатором. Пришлём уведомление в Telegram.',
      workingHours: 'График: 09:00 — 21:00',
      close: 'Закрыть', noDesc: 'Описание скоро появится',
    },
    en: {
      back: '← Back', btn: 'Book Now',
      description: 'Description', category: 'Category',
      duration: 'Duration', price: 'Tour price', hours: 'h',
      modalSub: 'Choose tour date', labelDate: 'Date',
      submitBtn: 'Send Request',
      successTitle: 'Request Sent!',
      successText: "We're contacting the organizer. We'll notify you via Telegram.",
      workingHours: 'Hours: 9:00 AM — 9:00 PM',
      close: 'Close', noDesc: 'Description coming soon',
    },
  };

  // ── States ─────────────────────────────────────────────────────────────────
  if (!isReady || loading) return (
    <div style={{ minHeight:'100vh', background:'#060810', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid rgba(245,158,11,0.25)', borderTopColor:'#f59e0b', animation:'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!tour) return (
    <div style={{ minHeight:'100vh', background:'#060810', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.25)', fontFamily:'DM Sans,sans-serif', fontSize:12, letterSpacing:2, textTransform:'uppercase' }}>
      Tour not found
    </div>
  );

  // ── Computed ────────────────────────────────────────────────────────────────
  const gallery: string[] = [tour.image_main, ...(Array.isArray(tour.gallery) ? tour.gallery : [])].filter(Boolean);
  const tourName = lang === 'ru' ? tour.name_ru : (tour.name_en || tour.name_ru);
  const tourDesc = lang === 'ru' ? tour.desc_ru  : (tour.desc_en  || tour.desc_ru);
  const priceNum = tour.price ? Number(tour.price) : null;
  const priceUSD = priceNum ? Math.round(priceNum / 26000) : null;

  return (
    <main style={{ minHeight:'100vh', background:'#060810', color:'#fff', fontFamily:"'DM Sans',sans-serif", display:'flex', flexDirection:'column', alignItems:'center', overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700;900&display=swap');
        .bebas{ font-family:'Bebas Neue',sans-serif; }
        *{ box-sizing:border-box; }
        .no-scrollbar::-webkit-scrollbar{ display:none; }
        .no-scrollbar{ scrollbar-width:none; }
        @keyframes spin{ to{ transform:rotate(360deg); } }
        @keyframes zoomIn{ from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
        .modal-anim{ animation:zoomIn .22s ease; }
        @keyframes ping{ 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(2.2);opacity:0} }
        .ping{ animation:ping 1.5s ease-in-out infinite; }
        @keyframes fireSweep{ 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        .fire-sweep{
          background:linear-gradient(90deg,#f59e0b,#ef4444,#f59e0b,#ef4444);
          background-size:200% 100%;
          animation:fireSweep 3s linear infinite;
        }
        @keyframes fadeUp{ from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up{ animation:fadeUp .45s ease forwards; }
        .fade-up-2{ animation:fadeUp .45s ease .1s forwards; opacity:0; }
        .book-btn{ transition:transform .15s, box-shadow .15s; }
        .book-btn:active{ transform:scale(0.97) !important; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:'fixed', top:0, width:'100%', zIndex:100, background:'linear-gradient(to bottom,rgba(6,8,16,0.97) 0%,rgba(6,8,16,0) 100%)', backdropFilter:'blur(10px)', height:56, display:'flex', alignItems:'center', padding:'0 16px', justifyContent:'space-between' }}>
        <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:900, textDecoration:'none', letterSpacing:1, textTransform:'uppercase' }}>
          {t[lang].back}
        </Link>
        {tour.category && (
          <div style={{ padding:'6px 14px', borderRadius:10, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b', fontSize:10, fontWeight:900, letterSpacing:1.5, textTransform:'uppercase' }}>
            {tour.category}
          </div>
        )}
      </nav>

      <div style={{ width:'100%', maxWidth:480, padding:'56px 16px 100px' }}>

        {/* ── GALLERY ── */}
        <div
          className="fade-up"
          style={{ position:'relative', aspectRatio:'3/4', width:'100%', borderRadius:32, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)', marginBottom:16, background:'#0c0f1c', touchAction:'none' }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <div style={{ width:'100%', height:'100%', display:'flex', transition:'transform .45s cubic-bezier(.4,0,.2,1)', transform:`translateX(-${activePhotoIndex * 100}%)` }}>
            {gallery.length > 0 ? gallery.map((img, i) => (
              <img key={i} src={img} style={{ width:'100%', height:'100%', objectFit:'cover', flexShrink:0 }} alt={tourName} />
            )) : (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:64, opacity:0.08 }}>🗺️</div>
            )}
          </div>

          <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'linear-gradient(to top,rgba(6,8,16,0.95) 0%,rgba(6,8,16,0.15) 55%)' }} />

          <div style={{ position:'absolute', bottom:28, left:24, right:24, pointerEvents:'none' }}>
            <div className="fire-sweep" style={{ height:2, width:36, borderRadius:2, marginBottom:10 }} />
            <h1 className="bebas" style={{ fontSize:36, lineHeight:1.05, letterSpacing:2, textShadow:'0 2px 24px rgba(0,0,0,0.9)', marginBottom: priceNum ? 8 : 0 }}>
              {tourName}
            </h1>
            {priceNum && (
              <div style={{ display:'inline-flex', alignItems:'baseline', gap:7 }}>
                <span style={{ fontSize:24, fontWeight:900, color:'#f59e0b', letterSpacing:-0.5, textShadow:'0 2px 16px rgba(0,0,0,0.8)' }}>
                  {priceNum.toLocaleString()} ₫
                </span>
                {priceUSD && (
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:600 }}>≈ {priceUSD} $</span>
                )}
              </div>
            )}
          </div>

          {tour.hot && (
            <div style={{ position:'absolute', top:16, left:16, padding:'4px 12px', borderRadius:8, background:'linear-gradient(135deg,#92400e,#b91c1c)', fontSize:8, fontWeight:900, letterSpacing:2, textTransform:'uppercase' }}>
              🔥 ХИТ
            </div>
          )}

          {gallery.length > 1 && (
            <div style={{ position:'absolute', bottom:14, right:20, display:'flex', gap:5 }}>
              {gallery.map((_, i) => (
                <div key={i} style={{ height:4, borderRadius:2, transition:'all .3s', width:activePhotoIndex===i?16:4, background:activePhotoIndex===i?'#f59e0b':'rgba(255,255,255,0.3)' }} />
              ))}
            </div>
          )}
        </div>

        {/* ── THUMBNAILS ── */}
        {gallery.length > 1 && (
          <div className="no-scrollbar" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:20, paddingLeft:4, paddingRight:4 }}>
            {gallery.map((img, idx) => (
              <button key={idx} onClick={() => setActivePhotoIndex(idx)} style={{ width:60, height:76, borderRadius:14, overflow:'hidden', flexShrink:0, border:'none', padding:0, cursor:'pointer', outline:activePhotoIndex===idx?'2px solid #f59e0b':'2px solid transparent', opacity:activePhotoIndex===idx?1:0.38, transform:activePhotoIndex===idx?'scale(0.95)':'scale(1)', transition:'all .2s' }}>
                <img src={img} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
              </button>
            ))}
          </div>
        )}

        {/* ── DETAILS CARD ── */}
        <div className="fade-up-2" style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:28, padding:24, marginBottom:14 }}>

          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:22 }}>
            {tour.category && (
              <div style={{ padding:'9px 14px', borderRadius:12, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', display:'flex', flexDirection:'column', gap:3 }}>
                <span style={{ fontSize:7, color:'rgba(245,158,11,0.55)', fontWeight:900, textTransform:'uppercase', letterSpacing:1.5 }}>{t[lang].category}</span>
                <span style={{ fontSize:12, color:'#f59e0b', fontWeight:900, textTransform:'uppercase' }}>{tour.category}</span>
              </div>
            )}
            {tour.duration_h && (
              <div style={{ padding:'9px 14px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', gap:3 }}>
                <span style={{ fontSize:7, color:'rgba(255,255,255,0.28)', fontWeight:900, textTransform:'uppercase', letterSpacing:1.5 }}>{t[lang].duration}</span>
                <span style={{ fontSize:12, color:'#fff', fontWeight:900 }}>⏱ {tour.duration_h}{t[lang].hours}</span>
              </div>
            )}
            {priceNum && (
              <div style={{ padding:'9px 14px', borderRadius:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.18)', display:'flex', flexDirection:'column', gap:3 }}>
                <span style={{ fontSize:7, color:'rgba(245,158,11,0.5)', fontWeight:900, textTransform:'uppercase', letterSpacing:1.5 }}>{t[lang].price}</span>
                <span style={{ fontSize:12, color:'#f59e0b', fontWeight:900 }}>{priceNum.toLocaleString()} ₫</span>
              </div>
            )}
          </div>

          <div style={{ marginBottom:24 }}>
            <p style={{ fontSize:9, color:'rgba(255,255,255,0.25)', fontWeight:900, textTransform:'uppercase', letterSpacing:2.5, marginBottom:10 }}>
              {t[lang].description}
            </p>
            <p style={{ fontSize:14, color: tourDesc ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.2)', lineHeight:1.78, fontWeight:400, fontStyle: tourDesc ? 'normal' : 'italic' }}>
              {tourDesc || t[lang].noDesc}
            </p>
          </div>

          <button
            className="book-btn"
            onClick={() => { setShowModal(true); setIsSubmitted(false); setSelectedDate(''); }}
            style={{ width:'100%', padding:'17px 0', borderRadius:18, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#92400e,#b91c1c)', color:'#fff', fontSize:13, fontWeight:900, letterSpacing:2.5, textTransform:'uppercase', boxShadow:'0 8px 32px rgba(185,28,28,0.35)' }}
          >
            🐉 {t[lang].btn}
          </button>
        </div>
      </div>

      {/* ── MODAL ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.93)', backdropFilter:'blur(14px)' }} onClick={() => setShowModal(false)} />

          <div className="modal-anim" style={{ position:'relative', width:'100%', maxWidth:380, background:'#0f1320', border:'1px solid rgba(255,255,255,0.08)', borderRadius:32, padding:28, boxShadow:'0 32px 80px rgba(0,0,0,0.7)' }}>
            {!isSubmitted ? (
              <form onSubmit={handleBooking}>
                <div style={{ textAlign:'center', marginBottom:22 }}>
                  <div className="fire-sweep" style={{ height:2, width:32, borderRadius:2, margin:'0 auto 14px' }} />
                  <h2 className="bebas" style={{ fontSize:24, letterSpacing:2, lineHeight:1.1, marginBottom:4 }}>{tourName}</h2>
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.28)', fontWeight:900, letterSpacing:2.5, textTransform:'uppercase' }}>{t[lang].modalSub}</p>
                </div>

                {priceNum && (
                  <div style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.18)', borderRadius:14, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:10, color:'rgba(245,158,11,0.65)', fontWeight:900, textTransform:'uppercase', letterSpacing:1 }}>{t[lang].price}</span>
                    <div style={{ textAlign:'right' }}>
                      <span style={{ fontSize:20, fontWeight:900, color:'#f59e0b', display:'block', letterSpacing:-0.5 }}>{priceNum.toLocaleString()} ₫</span>
                      {priceUSD && <span style={{ fontSize:10, color:'rgba(255,255,255,0.28)' }}>≈ {priceUSD} $</span>}
                    </div>
                  </div>
                )}

                <div style={{ background:'rgba(0,0,0,0.3)', padding:'14px 16px', borderRadius:16, border:'1px solid rgba(255,255,255,0.07)', marginBottom:24 }}>
                  <label style={{ display:'block', fontSize:9, color:'rgba(255,255,255,0.32)', fontWeight:900, textTransform:'uppercase', letterSpacing:1.5, marginBottom:8 }}>
                    📅 {t[lang].labelDate}
                  </label>
                  <input
                    required type="date" value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{ width:'100%', background:'transparent', border:'none', color:'#fff', outline:'none', fontWeight:700, fontSize:16, fontFamily:'DM Sans,sans-serif', colorScheme:'dark' }}
                  />
                </div>

                <div style={{ display:'flex', gap:10 }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex:1, padding:'14px 0', borderRadius:14, cursor:'pointer', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.45)', fontSize:10, fontWeight:900, letterSpacing:1.5, textTransform:'uppercase' }}>
                    {t[lang].close}
                  </button>
                  <button type="submit" disabled={isSubmitting} style={{ flex:2, padding:'14px 0', borderRadius:14, cursor:isSubmitting?'not-allowed':'pointer', background:'linear-gradient(135deg,#92400e,#b91c1c)', border:'none', color:'#fff', fontSize:10, fontWeight:900, letterSpacing:1.5, textTransform:'uppercase', opacity:isSubmitting?0.6:1, boxShadow:'0 4px 20px rgba(185,28,28,0.3)' }}>
                    {isSubmitting ? '⏳...' : t[lang].submitBtn}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <div className="ping" style={{ width:10, height:10, borderRadius:'50%', background:'#f59e0b' }} />
                </div>
                <h2 className="bebas" style={{ fontSize:26, letterSpacing:2, marginBottom:10 }}>{t[lang].successTitle}</h2>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.75, marginBottom:20 }}>{t[lang].successText}</p>
                <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:14, padding:'12px 16px', marginBottom:24, border:'1px solid rgba(255,255,255,0.07)' }}>
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.28)', fontWeight:900, letterSpacing:2, textTransform:'uppercase' }}>{t[lang].workingHours}</p>
                </div>
                <button onClick={() => setShowModal(false)} style={{ width:'100%', padding:'14px 0', borderRadius:14, cursor:'pointer', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:900, letterSpacing:2, textTransform:'uppercase' }}>
                  OK
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}