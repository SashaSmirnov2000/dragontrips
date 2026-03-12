"use client";
import { useState, useRef, useEffect } from 'react';
import { useParams } from "next/navigation";
import { supabase } from "../../supabase";
import Link from "next/link";

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function BookingCalendar({
  availableDates,
  selected,
  onSelect,
}: {
  availableDates: string[];
  selected: string;
  onSelect: (d: string) => void;
}) {
  const today = new Date();
  const firstAvail = availableDates.length
    ? new Date(availableDates[0] + 'T00:00:00')
    : today;

  const [viewYear, setViewYear]   = useState(firstAvail.getFullYear());
  const [viewMonth, setViewMonth] = useState(firstAvail.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Month nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={prevMonth} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:22, padding:'0 4px', lineHeight:1 }}>‹</button>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:14, fontWeight:900, color:'#fff', letterSpacing:'0.05em' }}>{MONTHS[viewMonth]}</p>
          <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:'0.15em', marginTop:1 }}>{viewYear}</p>
        </div>
        <button onClick={nextMonth} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:22, padding:'0 4px', lineHeight:1 }}>›</button>
      </div>

      {/* Day names */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginBottom:8 }}>
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d, i) => (
          <div key={d} style={{ textAlign:'center', fontSize:9, fontWeight:900, letterSpacing:'0.1em', color: i >= 5 ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.2)', paddingBottom:4 }}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;

          const dateStr     = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isAvailable = availableDates.includes(dateStr);
          const isSelected  = selected === dateStr;
          const isPast      = new Date(dateStr) < new Date(today.toDateString());
          const isWeekend   = idx % 7 >= 5;

          let bg     = 'transparent';
          let color  = isPast ? 'rgba(255,255,255,0.12)' : isWeekend ? 'rgba(255,200,100,0.4)' : 'rgba(255,255,255,0.4)';
          let border = '1px solid transparent';
          let fw: number = 400;
          let cursor = 'default';

          if (isSelected) {
            bg = '#f59e0b'; color = '#000'; fw = 900;
            border = '1px solid #f59e0b'; cursor = 'pointer';
          } else if (isAvailable && !isPast) {
            bg = 'rgba(245,158,11,0.1)'; color = '#f59e0b';
            border = '1px solid rgba(245,158,11,0.3)'; fw = 800; cursor = 'pointer';
          } else if (!isPast && !isAvailable) {
            color = 'rgba(255,255,255,0.16)';
          }

          return (
            <button key={idx}
              onClick={() => isAvailable && !isPast && onSelect(dateStr)}
              style={{ padding:'8px 0', border, background:bg, color, fontSize:12, fontWeight:fw, cursor, textAlign:'center', transition:'all .15s', position:'relative' }}
            >
              {day}
              {isAvailable && !isPast && !isSelected && (
                <span style={{ position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)', width:3, height:3, borderRadius:'50%', background:'#f59e0b', display:'block' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginTop:16, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:12, height:12, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.35)' }} />
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Доступно</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:12, height:12, background:'#f59e0b' }} />
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Выбрано</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
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

    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready(); tg.expand();
      if (tg.setHeaderColor)     tg.setHeaderColor('#0d1117');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0d1117');
    }

    async function loadTour() {
      const { data, error } = await supabase.from('tours').select('*').eq('id', params.id).single();
      if (!error && data) setTour(data);
      setLoading(false);
    }
    if (params.id) loadTour();
    return () => clearInterval(interval);
  }, [params.id]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) { alert(lang === 'ru' ? 'Выберите дату' : 'Select a date'); return; }
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
      const { data: newBooking, error: dbError } = await supabase
        .from('bookings').insert([bookingData]).select().single();
      if (dbError) throw dbError;

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

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX; };
  const onTouchMove  = (e: React.TouchEvent) => { touchEndX.current   = e.targetTouches[0].clientX; };
  const onTouchEnd   = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const d = touchStartX.current - touchEndX.current;
    if (d >  50 && activePhotoIndex < gallery.length - 1) setActivePhotoIndex(p => p + 1);
    if (d < -50 && activePhotoIndex > 0)                  setActivePhotoIndex(p => p - 1);
    touchStartX.current = null; touchEndX.current = null;
  };

  const t = {
    ru: {
      back: '← Назад', btn: 'Забронировать',
      description: 'Описание', category: 'Категория',
      duration: 'Длительность', price: 'Цена тура', hours: 'ч',
      bookSub: 'Доступные даты выделены',
      submitBtn: 'Подтвердить бронь',
      successTitle: 'Запрос принят!',
      successText: 'Свяжемся в Telegram для подтверждения.',
      workingHours: 'График: 09:00 — 21:00',
      close: 'Закрыть', noDesc: 'Описание скоро появится',
      noDates: 'Уточняйте даты у организатора',
      availableLabel: 'Доступные даты',
      nearestDate: 'Ближайшая дата',
    },
    en: {
      back: '← Back', btn: 'Book Now',
      description: 'Description', category: 'Category',
      duration: 'Duration', price: 'Tour price', hours: 'h',
      bookSub: 'Available dates are highlighted',
      submitBtn: 'Confirm Booking',
      successTitle: 'Request Sent!',
      successText: "We'll contact you via Telegram to confirm.",
      workingHours: 'Hours: 9:00 AM — 9:00 PM',
      close: 'Close', noDesc: 'Description coming soon',
      noDates: 'Contact organizer for available dates',
      availableLabel: 'Available dates',
      nearestDate: 'Nearest date',
    },
  };

  if (!isReady || loading) return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'2px solid rgba(245,158,11,0.2)', borderTopColor:'#f59e0b', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!tour) return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.2)', fontFamily:'DM Sans,sans-serif', fontSize:11, letterSpacing:3, textTransform:'uppercase' }}>
      Tour not found
    </div>
  );

  const gallery: string[] = [tour.image_main, ...(Array.isArray(tour.gallery) ? tour.gallery : [])].filter(Boolean);
  const tourName = lang === 'ru' ? tour.name_ru : (tour.name_en || tour.name_ru);
  const tourDesc = lang === 'ru' ? tour.desc_ru : (tour.desc_en || tour.desc_ru);
  const priceNum = tour.price ? Number(tour.price) : null;
  const priceUSD = priceNum ? Math.round(priceNum / 26000) : null;
  const availableDates: string[] = Array.isArray(tour.available_dates)
    ? tour.available_dates.filter(Boolean).sort()
    : [];
  const nextAvail = availableDates.find(d => new Date(d + 'T00:00:00') >= new Date(new Date().toDateString()));

  return (
    <main style={{ minHeight:'100vh', background:'#0d1117', color:'#fff', fontFamily:"'DM Sans',sans-serif", display:'flex', flexDirection:'column', alignItems:'center', overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700;900&display=swap');
        .bebas { font-family:'Bebas Neue',sans-serif; }
        * { box-sizing:border-box; }
        .no-scrollbar::-webkit-scrollbar { display:none; }
        .no-scrollbar { scrollbar-width:none; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes zoomIn { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        .modal-anim { animation:zoomIn .25s cubic-bezier(.4,0,.2,1); }
        @keyframes fireSweep { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        .fire-sweep { background:linear-gradient(90deg,#f59e0b,#ef4444,#f59e0b,#ef4444); background-size:200% 100%; animation:fireSweep 3s linear infinite; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up   { animation:fadeUp .4s ease forwards; }
        .fade-up-2 { animation:fadeUp .4s ease .08s forwards; opacity:0; }
        .fade-up-3 { animation:fadeUp .4s ease .16s forwards; opacity:0; }
        .book-btn  { transition:transform .15s, opacity .15s, background .3s, box-shadow .3s; }
        .book-btn:active { transform:scale(0.98); }
        @keyframes ping { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(2.2);opacity:0} }
        .ping { animation:ping 1.5s ease-in-out infinite; }
        .cal-btn { transition:all .12s; }
        .cal-btn:hover { filter:brightness(1.15); }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:'fixed', top:0, width:'100%', zIndex:100, height:52, display:'flex', alignItems:'center', padding:'0 16px', justifyContent:'space-between', background:'linear-gradient(to bottom,rgba(13,17,23,0.98) 0%,rgba(13,17,23,0) 100%)', backdropFilter:'blur(10px)' }}>
        <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.55)', fontSize:10, fontWeight:900, textDecoration:'none', letterSpacing:'0.2em', textTransform:'uppercase' }}>
          {t[lang].back}
        </Link>
        {tour.category && (
          <div style={{ padding:'6px 12px', border:'1px solid rgba(245,158,11,0.2)', color:'rgba(245,158,11,0.75)', fontSize:9, fontWeight:900, letterSpacing:'0.25em', textTransform:'uppercase' }}>
            {tour.category}
          </div>
        )}
      </nav>

      <div style={{ width:'100%', maxWidth:480, paddingBottom:100 }}>

        {/* ── GALLERY край в край ── */}
        <div className="fade-up"
          style={{ position:'relative', aspectRatio:'3/4', width:'100%', overflow:'hidden', background:'#0c0f1c', touchAction:'pan-y' }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <div style={{ width:'100%', height:'100%', display:'flex', transition:'transform .4s cubic-bezier(.4,0,.2,1)', transform:`translateX(-${activePhotoIndex * 100}%)` }}>
            {gallery.length > 0 ? gallery.map((img, i) => (
              <img key={i} src={img} style={{ width:'100%', height:'100%', objectFit:'cover', flexShrink:0 }} alt={tourName} />
            )) : (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:64, opacity:0.06 }}>🗺️</div>
            )}
          </div>

          <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'linear-gradient(to top,rgba(13,17,23,1) 0%,rgba(13,17,23,0.05) 50%,transparent 100%)' }} />

          {tour.hot && (
            <div style={{ position:'absolute', top:0, left:0, background:'#b91c1c', padding:'5px 12px' }}>
              <span style={{ fontSize:8, fontWeight:900, letterSpacing:'0.3em', textTransform:'uppercase', color:'#fff' }}>ХИТ СЕЗОНА</span>
            </div>
          )}

          {tour.duration_h && (
            <div style={{ position:'absolute', top: tour.hot ? 32 : 12, right:0, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(10px)', padding:'8px 14px', borderLeft:'2px solid rgba(245,158,11,0.5)' }}>
              <span style={{ fontSize:22, fontWeight:900, color:'#fff', lineHeight:1 }}>{tour.duration_h}</span>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginLeft:3, letterSpacing:'0.1em' }}>ЧАС</span>
            </div>
          )}

          <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'0 20px 24px' }}>
            <div className="fire-sweep" style={{ height:2, width:32, marginBottom:10 }} />
            <h1 className="bebas" style={{ fontSize:38, lineHeight:1.05, letterSpacing:2, textShadow:'0 2px 24px rgba(0,0,0,0.9)', marginBottom: priceNum ? 10 : 0 }}>
              {tourName}
            </h1>
            {priceNum && (
              <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                <span style={{ fontSize:26, fontWeight:900, color:'#f59e0b', letterSpacing:-0.5, textShadow:'0 2px 16px rgba(0,0,0,0.8)' }}>
                  {priceNum.toLocaleString()} ₫
                </span>
                {priceUSD && (
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.35)', fontWeight:600 }}>/ {priceUSD} $</span>
                )}
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div style={{ position:'absolute', bottom:14, right:20, display:'flex', gap:4 }}>
              {gallery.map((_, i) => (
                <div key={i} style={{ height:2, transition:'all .3s', width:i===activePhotoIndex?16:5, background:i===activePhotoIndex?'#f59e0b':'rgba(255,255,255,0.3)' }} />
              ))}
            </div>
          )}
        </div>

        {/* ── THUMBNAILS ── */}
        {gallery.length > 1 && (
          <div className="no-scrollbar" style={{ display:'flex', gap:2, overflowX:'auto', padding:'2px 0 0' }}>
            {gallery.map((img, idx) => (
              <button key={idx} onClick={() => setActivePhotoIndex(idx)}
                style={{ width:56, height:42, overflow:'hidden', flexShrink:0, border:'none', padding:0, cursor:'pointer', opacity:activePhotoIndex===idx?1:0.3, outline:activePhotoIndex===idx?'2px solid #f59e0b':'none', outlineOffset:-2, transition:'all .2s' }}>
                <img src={img} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
              </button>
            ))}
          </div>
        )}

        {/* ── CONTENT ── */}
        <div className="fade-up-2" style={{ padding:'0 16px' }}>

          {/* Stats row — edge to edge divider style */}
          <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.07)', borderBottom:'1px solid rgba(255,255,255,0.07)', marginTop: gallery.length > 1 ? 0 : 0, marginBottom:24 }}>
            {[
              tour.category  && { label: t[lang].category,  value: tour.category,                          color: '#f59e0b' },
              tour.duration_h && { label: t[lang].duration,  value: `${tour.duration_h} ${t[lang].hours}`,  color: '#fff'    },
              priceNum        && { label: t[lang].price,      value: `${priceNum.toLocaleString()} ₫`,       color: '#f59e0b' },
            ].filter(Boolean).map((item: any, i, arr) => (
              <div key={i} style={{ flex:1, padding:'14px 14px', borderRight: i < arr.length-1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                <p style={{ fontSize:7, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.25em', color:'rgba(255,255,255,0.22)', marginBottom:5 }}>{item.label}</p>
                <p style={{ fontSize:12, fontWeight:900, color:item.color, textTransform: i===0 ? 'uppercase' : 'none', letterSpacing: i===0 ? '0.08em' : 'normal' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {tourDesc && (
            <div style={{ marginBottom:28 }}>
              <p style={{ fontSize:8, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.3em', color:'rgba(255,255,255,0.2)', marginBottom:12 }}>
                {t[lang].description}
              </p>
              <p style={{ fontSize:14, color:'rgba(255,255,255,0.65)', lineHeight:1.85, fontWeight:400 }}>
                {tourDesc}
              </p>
            </div>
          )}

          {/* ── CALENDAR BLOCK ── */}
          <div className="fade-up-3" style={{ marginBottom:24 }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <p style={{ fontSize:8, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.3em', color:'rgba(255,255,255,0.22)' }}>
                {t[lang].availableLabel}
              </p>
              {nextAvail && !selectedDate && (
                <div style={{ padding:'4px 10px', background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)' }}>
                  <span style={{ fontSize:9, color:'#f59e0b', fontWeight:700, letterSpacing:'0.05em' }}>
                    {t[lang].nearestDate}: {new Date(nextAvail + 'T00:00:00').toLocaleDateString('ru-RU', { day:'numeric', month:'short' })}
                  </span>
                </div>
              )}
              {selectedDate && (
                <button onClick={() => setSelectedDate('')}
                  style={{ padding:'4px 10px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', color:'#f59e0b', fontSize:9, fontWeight:700, cursor:'pointer', letterSpacing:'0.05em' }}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day:'numeric', month:'short' })} ✕
                </button>
              )}
            </div>

            {availableDates.length > 0 ? (
              <div style={{ padding:'20px 16px', border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.015)' }}>
                <BookingCalendar availableDates={availableDates} selected={selectedDate} onSelect={setSelectedDate} />
              </div>
            ) : (
              <div style={{ padding:'20px 16px', border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.22)', letterSpacing:'0.1em' }}>{t[lang].noDates}</p>
              </div>
            )}
          </div>

          {/* ── BOOK BUTTON ── */}
          <button className="book-btn"
            onClick={() => { setShowModal(true); setIsSubmitted(false); }}
            style={{
              width:'100%', padding:'17px 0', border:'none', cursor:'pointer',
              background: selectedDate ? 'linear-gradient(135deg,#92400e,#b91c1c)' : 'rgba(255,255,255,0.07)',
              color: selectedDate ? '#fff' : 'rgba(255,255,255,0.3)',
              fontSize:11, fontWeight:900, letterSpacing:'0.3em', textTransform:'uppercase',
              boxShadow: selectedDate ? '0 8px 32px rgba(185,28,28,0.35)' : 'none',
            }}
          >
            {selectedDate
              ? `${t[lang].btn} — ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day:'numeric', month:'long' })}`
              : t[lang].btn
            }
          </button>
        </div>
      </div>

      {/* ── MODAL — bottom sheet ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(16px)' }} onClick={() => setShowModal(false)} />

          <div className="modal-anim" style={{ position:'relative', width:'100%', maxWidth:480, background:'#0d1117', borderTop:'1px solid rgba(255,255,255,0.1)', padding:'20px 20px 44px', boxShadow:'0 -40px 80px rgba(0,0,0,0.8)' }}>
            <div style={{ width:32, height:3, background:'rgba(255,255,255,0.1)', margin:'0 auto 22px', borderRadius:2 }} />

            {!isSubmitted ? (
              <form onSubmit={handleBooking}>
                <div style={{ marginBottom:20 }}>
                  <p style={{ fontSize:8, fontWeight:900, letterSpacing:'0.3em', textTransform:'uppercase', color:'rgba(255,255,255,0.22)', marginBottom:5 }}>{t[lang].bookSub}</p>
                  <h2 className="bebas" style={{ fontSize:24, letterSpacing:2, lineHeight:1.1 }}>{tourName}</h2>
                </div>

                {/* Выбранная дата */}
                <div style={{ padding:'14px 16px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.18)', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <p style={{ fontSize:7, fontWeight:900, letterSpacing:'0.25em', textTransform:'uppercase', color:'rgba(245,158,11,0.45)', marginBottom:5 }}>Дата тура</p>
                    <p style={{ fontSize:16, fontWeight:900, color: selectedDate ? '#f59e0b' : 'rgba(255,255,255,0.25)' }}>
                      {selectedDate
                        ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' })
                        : '— не выбрана —'
                      }
                    </p>
                  </div>
                  {priceNum && (
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontSize:7, fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', color:'rgba(255,255,255,0.2)', marginBottom:4 }}>{t[lang].price}</p>
                      <p style={{ fontSize:18, fontWeight:900, color:'#f59e0b', letterSpacing:-0.5 }}>{priceNum.toLocaleString()} ₫</p>
                      {priceUSD && <p style={{ fontSize:10, color:'rgba(255,255,255,0.22)' }}>/ {priceUSD} $</p>}
                    </div>
                  )}
                </div>

                {/* Если дата не выбрана — мини-календарь прямо в модале */}
                {!selectedDate && availableDates.length > 0 && (
                  <div style={{ marginBottom:20, padding:'16px', border:'1px solid rgba(255,255,255,0.07)' }}>
                    <BookingCalendar availableDates={availableDates} selected={selectedDate} onSelect={setSelectedDate} />
                  </div>
                )}

                {!selectedDate && availableDates.length === 0 && (
                  <div style={{ marginBottom:20 }}>
                    <label style={{ display:'block', fontSize:9, fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', color:'rgba(255,255,255,0.3)', marginBottom:8 }}>
                      Выберите дату
                    </label>
                    <input required type="date" value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      style={{ width:'100%', padding:'12px 14px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', outline:'none', fontSize:15, fontWeight:700, fontFamily:'DM Sans,sans-serif', colorScheme:'dark', borderRadius:0 }} />
                  </div>
                )}

                <div style={{ display:'flex', gap:10 }}>
                  <button type="button" onClick={() => setShowModal(false)}
                    style={{ flex:1, padding:'14px 0', cursor:'pointer', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase' }}>
                    {t[lang].close}
                  </button>
                  <button type="submit" disabled={isSubmitting || !selectedDate}
                    style={{ flex:2, padding:'14px 0', cursor:(isSubmitting || !selectedDate)?'not-allowed':'pointer', background:selectedDate?'linear-gradient(135deg,#92400e,#b91c1c)':'rgba(255,255,255,0.05)', border:'none', color:selectedDate?'#fff':'rgba(255,255,255,0.25)', fontSize:10, fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', opacity:isSubmitting?0.6:1, transition:'all .2s', boxShadow:selectedDate?'0 4px 20px rgba(185,28,28,0.3)':'none' }}>
                    {isSubmitting ? '⏳' : t[lang].submitBtn}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ width:52, height:52, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.18)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <div className="ping" style={{ width:10, height:10, borderRadius:'50%', background:'#f59e0b' }} />
                </div>
                <h2 className="bebas" style={{ fontSize:28, letterSpacing:3, marginBottom:8 }}>{t[lang].successTitle}</h2>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.45)', lineHeight:1.8, marginBottom:20 }}>{t[lang].successText}</p>
                <div style={{ padding:'12px 16px', border:'1px solid rgba(255,255,255,0.06)', marginBottom:24 }}>
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.22)', letterSpacing:'0.25em', textTransform:'uppercase' }}>{t[lang].workingHours}</p>
                </div>
                <button onClick={() => setShowModal(false)}
                  style={{ width:'100%', padding:'14px 0', cursor:'pointer', background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)', fontSize:10, fontWeight:900, letterSpacing:'0.25em', textTransform:'uppercase' }}>
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