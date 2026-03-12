"use client";
import { useState, useRef, useEffect } from 'react';
import { useParams } from "next/navigation";
import { supabase } from "../../supabase";
import Link from "next/link";

const VND_RATE = 26000;
function fmt$(n:number){ return `$${n.toLocaleString()}`; }
function fmtVnd(usd:number){
  const v = usd*VND_RATE;
  return v>=1_000_000 ? `≈${(v/1_000_000).toFixed(1)}M ₫` : `≈${(v/1000).toFixed(0)}k ₫`;
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function BookingCalendar({ availableDates, selected, onSelect }:
  { availableDates:string[]; selected:string; onSelect:(d:string)=>void; }) {
  const today = new Date();
  const firstAvail = availableDates.length ? new Date(availableDates[0]+'T00:00:00') : today;
  const [vy,setVy] = useState(firstAvail.getFullYear());
  const [vm,setVm] = useState(firstAvail.getMonth());

  const dim = new Date(vy,vm+1,0).getDate();
  const fd  = new Date(vy,vm,1).getDay();
  const off = fd===0?6:fd-1;
  const cells = [...Array(off).fill(null),...Array.from({length:dim},(_,i)=>i+1)];
  const MN = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  const prev = ()=>vm===0?(setVm(11),setVy(y=>y-1)):setVm(m=>m-1);
  const next = ()=>vm===11?(setVm(0),setVy(y=>y+1)):setVm(m=>m+1);

  return (
    <div style={{userSelect:'none'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <button onClick={prev} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:22,padding:'0 4px',lineHeight:1}}>‹</button>
        <div style={{textAlign:'center'}}>
          <p style={{fontSize:14,fontWeight:900,color:'#fff',letterSpacing:'0.05em'}}>{MN[vm]}</p>
          <p style={{fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.15em',marginTop:1}}>{vy}</p>
        </div>
        <button onClick={next} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:22,padding:'0 4px',lineHeight:1}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:8}}>
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d,i)=>(
          <div key={d} style={{textAlign:'center',fontSize:9,fontWeight:900,color:i>=5?'rgba(245,158,11,0.4)':'rgba(255,255,255,0.2)',paddingBottom:4}}>{d}</div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {cells.map((day,idx)=>{
          if(!day)return<div key={idx}/>;
          const ds = `${vy}-${String(vm+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isAvail = availableDates.includes(ds);
          const isSel   = selected===ds;
          const isPast  = new Date(ds)<new Date(today.toDateString());
          const isWe    = idx%7>=5;
          let bg='transparent',color=isPast?'rgba(255,255,255,0.12)':isWe?'rgba(255,200,100,0.4)':'rgba(255,255,255,0.4)';
          let border='1px solid transparent',fw:number=400,cursor='default';
          if(isSel){bg='#f59e0b';color='#000';fw=900;border='1px solid #f59e0b';cursor='pointer';}
          else if(isAvail&&!isPast){bg='rgba(245,158,11,0.1)';color='#f59e0b';border='1px solid rgba(245,158,11,0.3)';fw=800;cursor='pointer';}
          else if(!isPast)color='rgba(255,255,255,0.16)';
          return(
            <button key={idx} onClick={()=>isAvail&&!isPast&&onSelect(ds)}
              style={{padding:'8px 0',border,background:bg,color,fontSize:12,fontWeight:fw,cursor,textAlign:'center',transition:'all .12s',position:'relative'}}>
              {day}
              {isAvail&&!isPast&&!isSel&&<span style={{position:'absolute',bottom:2,left:'50%',transform:'translateX(-50%)',width:3,height:3,borderRadius:'50%',background:'#f59e0b',display:'block'}}/>}
            </button>
          );
        })}
      </div>
      <div style={{display:'flex',gap:16,marginTop:16,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:12,height:12,background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.35)'}}/>
          <span style={{fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Доступно</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:12,height:12,background:'#f59e0b'}}/>
          <span style={{fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Выбрано</span>
        </div>
      </div>
    </div>
  );
}

// ── Route parser ──────────────────────────────────────────────────────────────
function RouteBlock({text}:{text:string}) {
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:0}}>
      {lines.map((line,i)=>{
        const match = line.match(/^(\d+)\.\s*(.*)/);
        const num   = match?match[1]:null;
        const rest  = match?match[2]:line;
        // разбить "время — место"
        const parts = rest.split(/\s*[—–-]{1,2}\s*/);
        const time  = parts.length>1?parts[0]:null;
        const place = parts.length>1?parts.slice(1).join(' — '):rest;

        return (
          <div key={i} style={{display:'flex',gap:0,position:'relative'}}>
            {/* Вертикальная линия */}
            {i<lines.length-1&&<div style={{position:'absolute',left:19,top:32,bottom:0,width:1,background:'rgba(245,158,11,0.15)'}}/>}
            {/* Номер/точка */}
            <div style={{flexShrink:0,width:38,paddingTop:14,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{width:20,height:20,background:num?'rgba(245,158,11,0.12)':'rgba(255,255,255,0.06)',border:`1px solid ${num?'rgba(245,158,11,0.3)':'rgba(255,255,255,0.1)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:num?'#f59e0b':'rgba(255,255,255,0.4)',flexShrink:0,zIndex:1}}>
                {num||'·'}
              </div>
            </div>
            {/* Текст */}
            <div style={{flex:1,padding:'12px 0 12px 8px',borderBottom:i<lines.length-1?'1px solid rgba(255,255,255,0.04)':'none'}}>
              {time&&<p style={{fontSize:10,fontWeight:900,color:'#f59e0b',letterSpacing:'0.1em',marginBottom:3}}>{time}</p>}
              <p style={{fontSize:13,color:'rgba(255,255,255,0.72)',lineHeight:1.6,fontWeight:400}}>{place}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TourPage() {
  const params = useParams();
  const [lang,setLang]                       = useState<'ru'|'en'>('ru');
  const [isReady,setIsReady]                 = useState(false);
  const [tour,setTour]                       = useState<any>(null);
  const [loading,setLoading]                 = useState(true);
  const [activePhoto,setActivePhoto]         = useState(0);
  const [ref,setRef]                         = useState('');
  const [tab,setTab]                         = useState<'desc'|'route'>('desc');
  const [showModal,setShowModal]             = useState(false);
  const [selectedDate,setSelectedDate]       = useState('');
  const [guests,setGuests]                   = useState(1);
  const [isSubmitting,setIsSubmitting]       = useState(false);
  const [isSubmitted,setIsSubmitted]         = useState(false);
  const touchStartX = useRef<number|null>(null);
  const touchEndX   = useRef<number|null>(null);

  useEffect(()=>{
    const sl = localStorage.getItem('userLang');
    if(sl==='en'||sl==='ru') setLang(sl as 'ru'|'en');
    setIsReady(true);
    const initRef=()=>{
      const tg=(window as any).Telegram?.WebApp;
      const sp=new URLSearchParams(window.location.search).get('tgWebAppStartParam')||tg?.initDataUnsafe?.start_param;
      const sr=localStorage.getItem('referrer');
      if(sp){setRef(sp);localStorage.setItem('referrer',sp);return true;}
      else if(sr){setRef(sr);return true;}
      return false;
    };
    initRef();
    const iv=setInterval(()=>{if(initRef())clearInterval(iv);},500);
    setTimeout(()=>clearInterval(iv),2000);
    const tg=(window as any).Telegram?.WebApp;
    if(tg){tg.ready();tg.expand();tg.setHeaderColor?.('#0d1117');tg.setBackgroundColor?.('#0d1117');}
    async function load(){
      const{data,error}=await supabase.from('tours').select('*').eq('id',params.id).single();
      if(!error&&data)setTour(data);
      setLoading(false);
    }
    if(params.id)load();
    return()=>clearInterval(iv);
  },[params.id]);

  // Вычисляем цену для выбранного кол-ва гостей
  const calcPrice = (tour:any, g:number):number|null => {
    if(!tour) return null;
    const base = tour.price ? Number(tour.price) : null;
    const p1   = tour.price_1 ? Number(tour.price_1) : null;
    const p2   = tour.price_2 ? Number(tour.price_2) : null;
    if(g===2 && p2) return p2;
    if(g===1 && p1) return p1;
    if(base) return base*g;
    return null;
  };

  const handleBooking = async (e:React.FormEvent) => {
    e.preventDefault();
    if(!selectedDate){alert(lang==='ru'?'Выберите дату':'Select a date');return;}
    setIsSubmitting(true);
    const tg=(window as any).Telegram?.WebApp;
    const user=tg?.initDataUnsafe?.user;
    const totalUsd = calcPrice(tour,guests);
    const bookingData={
      bike_id:         tour.id,
      bike_model:      tour.name_ru,
      start_date:      selectedDate,
      end_date:        selectedDate,
      client_username: user?.username||'web_user',
      telegram_id:     user?.id,
      referrer:        ref,
      total_price:     totalUsd ? `${fmt$(totalUsd)} (${guests} чел)` : '—',
    };
    try{
      const{data:nb,error:de}=await supabase.from('bookings').insert([bookingData]).select().single();
      if(de)throw de;
      await fetch('/api/send-telegram',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...bookingData,booking_id:nb?.id,guests}),
      });
      setIsSubmitted(true);
    }catch(err:any){alert('Error: '+err.message);}
    finally{setIsSubmitting(false);}
  };

  const onTouchStart=(e:React.TouchEvent)=>{touchStartX.current=e.targetTouches[0].clientX;};
  const onTouchMove =(e:React.TouchEvent)=>{touchEndX.current=e.targetTouches[0].clientX;};
  const onTouchEnd  =()=>{
    if(!touchStartX.current||!touchEndX.current)return;
    const d=touchStartX.current-touchEndX.current;
    if(d>50&&activePhoto<gallery.length-1)setActivePhoto(p=>p+1);
    if(d<-50&&activePhoto>0)setActivePhoto(p=>p-1);
    touchStartX.current=null;touchEndX.current=null;
  };

  const T={
    ru:{back:'← Назад',btn:'Забронировать',desc:'Описание',route:'Маршрут',
        cat:'Категория',dur:'Длительность',priceLabel:'Цена тура',h:'ч',
        guestLabel:'Количество человек',guest1:'1 человек',guest2:'2 человека',
        perPerson:'за чел',forTwo:'за двоих',saving:'Экономия',
        dateLabel:'Ближайшая дата',calSub:'Доступные даты выделены',
        submitBtn:'Подтвердить бронь',successTitle:'Запрос принят!',
        successText:'Свяжемся в Telegram для подтверждения.',hours:'09:00–21:00',
        close:'Закрыть',noDates:'Уточняйте даты у организатора',noDesc:'Описание скоро появится',
        noRoute:'Маршрут скоро появится',nearest:'Ближайшая',totalPrice:'Итого',
        availLabel:'Доступные даты',discountBadge:'Скидка за двоих',
    },
    en:{back:'← Back',btn:'Book Now',desc:'Description',route:'Route',
        cat:'Category',dur:'Duration',priceLabel:'Tour price',h:'h',
        guestLabel:'Number of guests',guest1:'1 person',guest2:'2 people',
        perPerson:'per person',forTwo:'for two',saving:'Save',
        dateLabel:'Nearest date',calSub:'Available dates are highlighted',
        submitBtn:'Confirm Booking',successTitle:'Request Sent!',
        successText:"We'll contact you via Telegram to confirm.",hours:'9AM–9PM',
        close:'Close',noDates:'Contact organizer for available dates',noDesc:'Description coming soon',
        noRoute:'Route coming soon',nearest:'Nearest',totalPrice:'Total',
        availLabel:'Available dates',discountBadge:'Group discount',
    },
  };

  if(!isReady||loading) return(
    <div style={{minHeight:'100vh',background:'#0d1117',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:'2px solid rgba(245,158,11,0.2)',borderTopColor:'#f59e0b',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(!tour) return(
    <div style={{minHeight:'100vh',background:'#0d1117',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.2)',fontFamily:'DM Sans,sans-serif',fontSize:11,letterSpacing:3,textTransform:'uppercase'}}>
      Tour not found
    </div>
  );

  const t            = T[lang];
  const gallery:string[] = [tour.image_main,...(Array.isArray(tour.gallery)?tour.gallery:[])].filter(Boolean);
  const tourName     = lang==='ru'?tour.name_ru:(tour.name_en||tour.name_ru);
  const tourDesc     = lang==='ru'?tour.desc_ru:(tour.desc_en||tour.desc_ru);
  const tourRoute    = lang==='ru'?tour.route_ru:(tour.route_en||tour.route_ru);
  const priceBase    = tour.price?Number(tour.price):null;
  const price1       = tour.price_1?Number(tour.price_1):null;
  const price2       = tour.price_2?Number(tour.price_2):null;
  const hasDiscount  = !!price2;
  const availDates:string[] = Array.isArray(tour.available_dates)?tour.available_dates.filter(Boolean).sort():[];
  const nextAvail    = availDates.find(d=>new Date(d+'T00:00:00')>=new Date(new Date().toDateString()));
  const totalUsd     = calcPrice(tour,guests);
  const displayBase  = price1||priceBase;

  return(
    <main style={{minHeight:'100vh',background:'#0d1117',color:'#fff',fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column',alignItems:'center',overflowX:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700;900&display=swap');
        .bebas{font-family:'Bebas Neue',sans-serif;}
        *{box-sizing:border-box;}
        .no-sb::-webkit-scrollbar{display:none;}.no-sb{scrollbar-width:none;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes slUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        .modal-anim{animation:slUp .25s cubic-bezier(.4,0,.2,1);}
        @keyframes fw{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        .fsw{background:linear-gradient(90deg,#f59e0b,#ef4444,#f59e0b,#ef4444);background-size:200% 100%;animation:fw 3s linear infinite;}
        @keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .fu {animation:fu .4s ease forwards;}
        .fu2{animation:fu .4s ease .08s forwards;opacity:0;}
        .fu3{animation:fu .4s ease .16s forwards;opacity:0;}
        .bb{transition:transform .15s,opacity .15s,background .3s,box-shadow .3s;}
        .bb:active{transform:scale(0.98);}
        @keyframes ping{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(2.2);opacity:0}}
        .ping{animation:ping 1.5s ease-in-out infinite;}
        .tab-btn{flex:1;padding:12px 8px;background:transparent;border:none;color:rgba(255,255,255,0.35);font-family:'DM Sans',sans-serif;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;}
        .tab-btn.on{color:#f59e0b;border-bottom-color:#f59e0b;}
        .g-btn{background:transparent;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);width:36px;height:36px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;}
        .g-btn:hover{border-color:rgba(245,158,11,0.4);color:#f59e0b;}
        .g-btn:disabled{opacity:.25;cursor:not-allowed;}
      `}</style>

      {/* NAV */}
      <nav style={{position:'fixed',top:0,width:'100%',zIndex:100,height:52,display:'flex',alignItems:'center',padding:'0 16px',justifyContent:'space-between',background:'linear-gradient(to bottom,rgba(13,17,23,0.98) 0%,rgba(13,17,23,0) 100%)',backdropFilter:'blur(10px)'}}>
        <Link href="/" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.55)',fontSize:10,fontWeight:900,textDecoration:'none',letterSpacing:'0.2em',textTransform:'uppercase'}}>
          {t.back}
        </Link>
        {tour.category&&(
          <div style={{padding:'6px 12px',border:'1px solid rgba(245,158,11,0.2)',color:'rgba(245,158,11,0.75)',fontSize:9,fontWeight:900,letterSpacing:'0.25em',textTransform:'uppercase'}}>
            {tour.category}
          </div>
        )}
      </nav>

      <div style={{width:'100%',maxWidth:480,paddingBottom:100}}>

        {/* GALLERY — соотношение 10:7 (1000×700) */}
        <div className="fu" style={{position:'relative',width:'100%',overflow:'hidden',background:'#0c0f1c',touchAction:'pan-y',aspectRatio:'10/7'}}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div style={{width:'100%',height:'100%',display:'flex',transition:'transform .4s cubic-bezier(.4,0,.2,1)',transform:`translateX(-${activePhoto*100}%)`}}>
            {gallery.length>0?gallery.map((img,i)=>(
              <img key={i} src={img} style={{width:'100%',height:'100%',objectFit:'cover',flexShrink:0}} alt={tourName}/>
            )):(
              <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:64,opacity:0.06}}>🗺️</div>
            )}
          </div>
          <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'linear-gradient(to top,rgba(13,17,23,1) 0%,rgba(13,17,23,0.05) 55%,transparent 100%)'}}/>
          {tour.hot&&(
            <div style={{position:'absolute',top:0,left:0,background:'#b91c1c',padding:'5px 12px'}}>
              <span style={{fontSize:8,fontWeight:900,letterSpacing:'0.3em',textTransform:'uppercase',color:'#fff'}}>ХИТ СЕЗОНА</span>
            </div>
          )}
          {tour.duration_h&&(
            <div style={{position:'absolute',top:tour.hot?32:12,right:0,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(10px)',padding:'8px 14px',borderLeft:'2px solid rgba(245,158,11,0.5)'}}>
              <span style={{fontSize:22,fontWeight:900,color:'#fff',lineHeight:1}}>{tour.duration_h}</span>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.5)',marginLeft:3,letterSpacing:'0.1em'}}>ЧАС</span>
            </div>
          )}
          {/* Title + price */}
          <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'0 18px 20px'}}>
            <div className="fsw" style={{height:2,width:28,marginBottom:8}}/>
            <h1 className="bebas" style={{fontSize:36,lineHeight:1.05,letterSpacing:2,textShadow:'0 2px 24px rgba(0,0,0,0.9)',marginBottom:displayBase?8:0}}>
              {tourName}
            </h1>
            {displayBase&&(
              <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                <span style={{fontSize:22,fontWeight:900,color:'#f59e0b',letterSpacing:-0.5,textShadow:'0 2px 16px rgba(0,0,0,0.8)'}}>
                  {fmt$(displayBase)}
                </span>
                <span style={{fontSize:11,color:'rgba(255,255,255,0.35)',fontWeight:600}}>{fmtVnd(displayBase)}</span>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>{t.perPerson}</span>
              </div>
            )}
          </div>
          {gallery.length>1&&(
            <div style={{position:'absolute',bottom:12,right:16,display:'flex',gap:4}}>
              {gallery.map((_,i)=>(
                <div key={i} style={{height:2,transition:'all .3s',width:i===activePhoto?16:5,background:i===activePhoto?'#f59e0b':'rgba(255,255,255,0.3)'}}/>
              ))}
            </div>
          )}
        </div>

        {/* THUMBNAILS */}
        {gallery.length>1&&(
          <div className="no-sb" style={{display:'flex',gap:2,overflowX:'auto',padding:'2px 0 0'}}>
            {gallery.map((img,idx)=>(
              <button key={idx} onClick={()=>setActivePhoto(idx)}
                style={{width:56,height:39,overflow:'hidden',flexShrink:0,border:'none',padding:0,cursor:'pointer',opacity:activePhoto===idx?1:0.3,outline:activePhoto===idx?'2px solid #f59e0b':'none',outlineOffset:-2,transition:'all .2s'}}>
                <img src={img} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
              </button>
            ))}
          </div>
        )}

        <div className="fu2" style={{padding:'0 16px'}}>

          {/* STATS ROW */}
          <div style={{display:'flex',borderTop:'1px solid rgba(255,255,255,0.07)',borderBottom:'1px solid rgba(255,255,255,0.07)',marginBottom:24}}>
            {[
              tour.category  && {label:t.cat,    value:tour.category,              color:'#f59e0b', upper:true},
              tour.duration_h&& {label:t.dur,    value:`${tour.duration_h} ${t.h}`,color:'#fff',   upper:false},
              displayBase    && {label:t.priceLabel, value:fmt$(displayBase),       color:'#f59e0b', upper:false},
            ].filter(Boolean).map((item:any,i,arr)=>(
              <div key={i} style={{flex:1,padding:'13px 14px',borderRight:i<arr.length-1?'1px solid rgba(255,255,255,0.07)':'none'}}>
                <p style={{fontSize:7,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.25em',color:'rgba(255,255,255,0.22)',marginBottom:5}}>{item.label}</p>
                <p style={{fontSize:12,fontWeight:900,color:item.color,textTransform:item.upper?'uppercase':'none',letterSpacing:item.upper?'0.08em':'normal'}}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* DISCOUNT BANNER */}
          {hasDiscount&&(
            <div className="fu2" style={{marginBottom:20,padding:'12px 16px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <p style={{fontSize:8,fontWeight:900,letterSpacing:'0.25em',textTransform:'uppercase',color:'rgba(245,158,11,0.55)',marginBottom:4}}>{t.discountBadge}</p>
                <p style={{fontSize:14,fontWeight:900,color:'#f59e0b'}}>{fmt$(price2!)} <span style={{fontSize:10,color:'rgba(255,255,255,0.35)',fontWeight:400}}>{fmtVnd(price2!)} · {t.forTwo}</span></p>
              </div>
              {priceBase&&<div style={{textAlign:'right'}}>
                <p style={{fontSize:9,color:'rgba(255,255,255,0.3)',marginBottom:2}}>{t.saving}</p>
                <p style={{fontSize:13,fontWeight:900,color:'rgba(100,220,100,0.8)'}}>{fmt$(priceBase*2-price2!)}</p>
              </div>}
            </div>
          )}

          {/* TABS — Описание / Маршрут */}
          {(tourDesc||tourRoute)&&(
            <div style={{marginBottom:20}}>
              <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.07)',marginBottom:0}}>
                <button className={`tab-btn ${tab==='desc'?'on':''}`} onClick={()=>setTab('desc')}>{t.desc}</button>
                {tourRoute&&<button className={`tab-btn ${tab==='route'?'on':''}`} onClick={()=>setTab('route')}>{t.route}</button>}
              </div>
              <div style={{paddingTop:16}}>
                {tab==='desc'&&(
                  <p style={{fontSize:14,color:'rgba(255,255,255,0.65)',lineHeight:1.85,fontWeight:400}}>
                    {tourDesc||<span style={{color:'rgba(255,255,255,0.22)',fontStyle:'italic'}}>{t.noDesc}</span>}
                  </p>
                )}
                {tab==='route'&&(
                  tourRoute
                    ? <RouteBlock text={tourRoute}/>
                    : <p style={{fontSize:13,color:'rgba(255,255,255,0.22)',fontStyle:'italic'}}>{t.noRoute}</p>
                )}
              </div>
            </div>
          )}

          {/* CALENDAR BLOCK */}
          <div className="fu3" style={{marginBottom:24}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <p style={{fontSize:8,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.3em',color:'rgba(255,255,255,0.22)'}}>{t.availLabel}</p>
              {nextAvail&&!selectedDate&&(
                <div style={{padding:'4px 10px',background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.2)'}}>
                  <span style={{fontSize:9,color:'#f59e0b',fontWeight:700}}>
                    {t.nearest}: {new Date(nextAvail+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}
                  </span>
                </div>
              )}
              {selectedDate&&(
                <button onClick={()=>setSelectedDate('')} style={{padding:'4px 10px',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',color:'#f59e0b',fontSize:9,fontWeight:700,cursor:'pointer'}}>
                  {new Date(selectedDate+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'})} ✕
                </button>
              )}
            </div>
            {availDates.length>0?(
              <div style={{padding:'18px 14px',border:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.015)'}}>
                <BookingCalendar availableDates={availDates} selected={selectedDate} onSelect={setSelectedDate}/>
              </div>
            ):(
              <div style={{padding:'20px 16px',border:'1px solid rgba(255,255,255,0.06)',textAlign:'center'}}>
                <p style={{fontSize:11,color:'rgba(255,255,255,0.22)',letterSpacing:'0.1em'}}>{t.noDates}</p>
              </div>
            )}
          </div>

          {/* GUEST SELECTOR */}
          {(priceBase||price1||price2)&&(
            <div style={{marginBottom:24,padding:'16px',border:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.015)'}}>
              <p style={{fontSize:8,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.3em',color:'rgba(255,255,255,0.22)',marginBottom:14}}>{t.guestLabel}</p>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <button className="g-btn" disabled={guests<=1} onClick={()=>setGuests(g=>Math.max(1,g-1))}>−</button>
                <div style={{flex:1,textAlign:'center'}}>
                  <p style={{fontSize:24,fontWeight:900,color:'#fff',lineHeight:1}}>{guests}</p>
                  <p style={{fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',marginTop:2,textTransform:'uppercase'}}>
                    {guests===1?t.guest1:t.guest2}
                  </p>
                </div>
                <button className="g-btn" disabled={guests>=10} onClick={()=>setGuests(g=>Math.min(10,g+1))}>+</button>
              </div>
              {totalUsd&&(
                <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
                  <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.2em',color:'rgba(255,255,255,0.25)'}}>{t.totalPrice}</span>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontSize:22,fontWeight:900,color:'#f59e0b',letterSpacing:-0.5}}>{fmt$(totalUsd)}</span>
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginLeft:8}}>{fmtVnd(totalUsd)}</span>
                    {guests===2&&price2&&priceBase&&(
                      <p style={{fontSize:9,color:'rgba(100,220,100,0.7)',marginTop:3}}>
                        {t.saving} {fmt$(priceBase*2-price2)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOOK BUTTON */}
          <button className="bb"
            onClick={()=>{setShowModal(true);setIsSubmitted(false);}}
            style={{width:'100%',padding:'17px 0',border:'none',cursor:'pointer',
              background:selectedDate?'linear-gradient(135deg,#92400e,#b91c1c)':'rgba(255,255,255,0.07)',
              color:selectedDate?'#fff':'rgba(255,255,255,0.3)',
              fontSize:11,fontWeight:900,letterSpacing:'0.3em',textTransform:'uppercase',
              boxShadow:selectedDate?'0 8px 32px rgba(185,28,28,0.35)':'none'}}>
            {selectedDate
              ? `${t.btn} — ${new Date(selectedDate+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}`
              : t.btn}
          </button>
        </div>
      </div>

      {/* MODAL — bottom sheet */}
      {showModal&&(
        <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(16px)'}} onClick={()=>setShowModal(false)}/>
          <div className="modal-anim" style={{position:'relative',width:'100%',maxWidth:480,background:'#0d1117',borderTop:'1px solid rgba(255,255,255,0.1)',padding:'20px 20px 44px',boxShadow:'0 -40px 80px rgba(0,0,0,0.8)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:32,height:3,background:'rgba(255,255,255,0.1)',margin:'0 auto 22px',borderRadius:2}}/>

            {!isSubmitted?(
              <form onSubmit={handleBooking}>
                <div style={{marginBottom:18}}>
                  <p style={{fontSize:8,fontWeight:900,letterSpacing:'0.3em',textTransform:'uppercase',color:'rgba(255,255,255,0.22)',marginBottom:5}}>{t.calSub}</p>
                  <h2 className="bebas" style={{fontSize:22,letterSpacing:2,lineHeight:1.1}}>{tourName}</h2>
                </div>

                {/* Дата */}
                <div style={{padding:'12px 14px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.18)',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <p style={{fontSize:7,fontWeight:900,letterSpacing:'0.25em',textTransform:'uppercase',color:'rgba(245,158,11,0.45)',marginBottom:4}}>Дата</p>
                    <p style={{fontSize:15,fontWeight:900,color:selectedDate?'#f59e0b':'rgba(255,255,255,0.25)'}}>
                      {selectedDate?new Date(selectedDate+'T00:00:00').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}):'— не выбрана —'}
                    </p>
                  </div>
                  {totalUsd&&(
                    <div style={{textAlign:'right'}}>
                      <p style={{fontSize:7,fontWeight:900,letterSpacing:'0.2em',textTransform:'uppercase',color:'rgba(255,255,255,0.2)',marginBottom:4}}>{t.totalPrice}</p>
                      <p style={{fontSize:17,fontWeight:900,color:'#f59e0b',letterSpacing:-0.5}}>{fmt$(totalUsd)}</p>
                      <p style={{fontSize:9,color:'rgba(255,255,255,0.25)'}}>{fmtVnd(totalUsd)}</p>
                    </div>
                  )}
                </div>

                {/* Гости */}
                <div style={{padding:'12px 14px',border:'1px solid rgba(255,255,255,0.07)',marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
                  <button type="button" className="g-btn" disabled={guests<=1} onClick={()=>setGuests(g=>Math.max(1,g-1))}>−</button>
                  <div style={{flex:1,textAlign:'center'}}>
                    <p style={{fontSize:18,fontWeight:900,color:'#fff',lineHeight:1}}>{guests}</p>
                    <p style={{fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em',marginTop:2,textTransform:'uppercase'}}>
                      {guests===1?t.guest1:t.guest2}
                    </p>
                  </div>
                  <button type="button" className="g-btn" disabled={guests>=10} onClick={()=>setGuests(g=>Math.min(10,g+1))}>+</button>
                </div>

                {/* Если дата не выбрана, показываем мини-календарь */}
                {!selectedDate&&availDates.length>0&&(
                  <div style={{marginBottom:16,padding:'14px',border:'1px solid rgba(255,255,255,0.07)'}}>
                    <BookingCalendar availableDates={availDates} selected={selectedDate} onSelect={setSelectedDate}/>
                  </div>
                )}
                {!selectedDate&&availDates.length===0&&(
                  <div style={{marginBottom:16}}>
                    <label style={{display:'block',fontSize:9,fontWeight:900,letterSpacing:'0.2em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',marginBottom:8}}>Выберите дату</label>
                    <input required type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
                      style={{width:'100%',padding:'11px 14px',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'#fff',outline:'none',fontSize:15,fontWeight:700,fontFamily:'DM Sans,sans-serif',colorScheme:'dark',borderRadius:0}}/>
                  </div>
                )}

                <div style={{display:'flex',gap:10}}>
                  <button type="button" onClick={()=>setShowModal(false)}
                    style={{flex:1,padding:'13px 0',cursor:'pointer',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.4)',fontSize:10,fontWeight:900,letterSpacing:'0.2em',textTransform:'uppercase'}}>
                    {t.close}
                  </button>
                  <button type="submit" disabled={isSubmitting||!selectedDate}
                    style={{flex:2,padding:'13px 0',cursor:(isSubmitting||!selectedDate)?'not-allowed':'pointer',background:selectedDate?'linear-gradient(135deg,#92400e,#b91c1c)':'rgba(255,255,255,0.05)',border:'none',color:selectedDate?'#fff':'rgba(255,255,255,0.25)',fontSize:10,fontWeight:900,letterSpacing:'0.2em',textTransform:'uppercase',opacity:isSubmitting?0.6:1,transition:'all .2s',boxShadow:selectedDate?'0 4px 20px rgba(185,28,28,0.3)':'none'}}>
                    {isSubmitting?'⏳':t.submitBtn}
                  </button>
                </div>
              </form>
            ):(
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{width:52,height:52,background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.18)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
                  <div className="ping" style={{width:10,height:10,borderRadius:'50%',background:'#f59e0b'}}/>
                </div>
                <h2 className="bebas" style={{fontSize:28,letterSpacing:3,marginBottom:8}}>{t.successTitle}</h2>
                <p style={{fontSize:13,color:'rgba(255,255,255,0.45)',lineHeight:1.8,marginBottom:20}}>{t.successText}</p>
                <div style={{padding:'12px 16px',border:'1px solid rgba(255,255,255,0.06)',marginBottom:24}}>
                  <p style={{fontSize:9,color:'rgba(255,255,255,0.22)',letterSpacing:'0.25em',textTransform:'uppercase'}}>{t.hours}</p>
                </div>
                <button onClick={()=>setShowModal(false)}
                  style={{width:'100%',padding:'13px 0',cursor:'pointer',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.5)',fontSize:10,fontWeight:900,letterSpacing:'0.25em',textTransform:'uppercase'}}>OK</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}