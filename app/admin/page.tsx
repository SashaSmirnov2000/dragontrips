"use client";
import { useState, useRef } from 'react';
import { supabase } from '../supabase';

interface Tour {
  id?: number;
  name_ru: string;
  name_en: string;
  desc_ru: string;
  desc_en: string;
  route_ru: string;
  route_en: string;
  category: string;
  image_main: string;
  gallery: string[];
  price: string | number;      // базовая цена USD за 1 чел
  price_1: string | number;    // цена USD за 1 чел (если спец)
  price_2: string | number;    // цена USD за 2 чел суммарно (если скидка)
  duration_h: string | number;
  hot: boolean;
  sort_order: number;
  is_active: boolean;
  available_dates: string[];
}

const EMPTY: Tour = {
  name_ru:'', name_en:'',
  desc_ru:'', desc_en:'',
  route_ru:'', route_en:'',
  category:'', image_main:'',
  gallery:[], price:'', price_1:'', price_2:'',
  duration_h:'', hot:false, sort_order:0, is_active:true, available_dates:[],
};

const CATEGORIES = ['Море','Горы','Город','Природа','Дайвинг','Еда','Культура'];
const ADMIN_PIN  = '2626';
const VND_RATE   = 26000;

function fmt$(n: number) { return `$${n.toLocaleString()}`; }
function fmtVnd(usd: number) {
  const v = usd * VND_RATE;
  return v >= 1_000_000 ? `≈${(v/1_000_000).toFixed(1)}M ₫` : `≈${(v/1000).toFixed(0)}k ₫`;
}

// ── Datepicker ────────────────────────────────────────────────────────────────
function DatePicker({ selected, onChange }: { selected:string[]; onChange:(d:string[])=>void }) {
  const today = new Date();
  const [vy, setVy] = useState(today.getFullYear());
  const [vm, setVm] = useState(today.getMonth());

  const dim = new Date(vy, vm+1, 0).getDate();
  const fd  = new Date(vy, vm, 1).getDay();
  const off = fd===0 ? 6 : fd-1;
  const cells = [...Array(off).fill(null), ...Array.from({length:dim},(_,i)=>i+1)];
  const MN = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

  const prev = () => vm===0 ? (setVm(11), setVy(y=>y-1)) : setVm(m=>m-1);
  const next = () => vm===11 ? (setVm(0), setVy(y=>y+1)) : setVm(m=>m+1);
  const toggle = (s:string) => selected.includes(s) ? onChange(selected.filter(d=>d!==s)) : onChange([...selected,s].sort());

  return (
    <div style={{background:'rgba(0,0,0,0.2)',border:'1px solid rgba(255,255,255,0.07)',padding:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <button onClick={prev} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:20,padding:'0 6px'}}>‹</button>
        <span style={{fontSize:12,fontWeight:900,color:'#f59e0b',letterSpacing:'0.15em',textTransform:'uppercase'}}>{MN[vm]} {vy}</span>
        <button onClick={next} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:20,padding:'0 6px'}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:6}}>
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>(
          <div key={d} style={{textAlign:'center',fontSize:8,fontWeight:900,color:'rgba(255,255,255,0.2)',letterSpacing:'0.05em'}}>{d}</div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
        {cells.map((day,idx)=>{
          if(!day) return <div key={idx}/>;
          const ds = `${vy}-${String(vm+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const sel = selected.includes(ds);
          const past = new Date(ds) < new Date(today.toDateString());
          return (
            <button key={idx} onClick={()=>!past&&toggle(ds)} style={{
              padding:'5px 0',border:sel?'1px solid #f59e0b':'1px solid transparent',
              background:sel?'rgba(245,158,11,0.18)':'transparent',
              color:past?'rgba(255,255,255,0.12)':sel?'#f59e0b':'rgba(255,255,255,0.6)',
              fontSize:11,fontWeight:sel?900:400,cursor:past?'not-allowed':'pointer',textAlign:'center',
            }}>{day}</button>
          );
        })}
      </div>
      {selected.length>0&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:10,color:'#f59e0b',fontWeight:700}}>Выбрано: {selected.length} дат</span>
          <button onClick={()=>onChange([])} style={{fontSize:9,color:'rgba(255,100,100,0.7)',background:'none',border:'none',cursor:'pointer',letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:700}}>Очистить</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminTours() {
  const [authed,setAuthed]     = useState(false);
  const [pin,setPin]           = useState('');
  const [pinError,setPinError] = useState(false);
  const [tours,setTours]       = useState<Tour[]>([]);
  const [loading,setLoading]   = useState(false);
  const [saving,setSaving]     = useState(false);
  const [deleting,setDeleting] = useState<number|null>(null);
  const [form,setForm]         = useState<Tour>(EMPTY);
  const [editId,setEditId]     = useState<number|null>(null);
  const [showForm,setShowForm] = useState(false);
  const [toast,setToast]       = useState<{msg:string;type:'ok'|'err'}|null>(null);
  const [galleryInput,setGalleryInput] = useState('');
  const [uploading,setUploading]       = useState(false);
  const mainImgRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const checkPin  = () => { if(pin===ADMIN_PIN){setAuthed(true);loadTours();}else{setPinError(true);setTimeout(()=>setPinError(false),1200);} };

  const loadTours = async () => {
    setLoading(true);
    const {data,error} = await supabase.from('tours').select('*').order('sort_order',{ascending:true});
    if(error) showToast('Ошибка: '+error.message,'err');
    else setTours(data||[]);
    setLoading(false);
  };

  const uploadImage = async (file:File):Promise<string|null> => {
    const ext  = file.name.split('.').pop();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const {error} = await supabase.storage.from('images').upload(name,file,{upsert:true});
    if(error){showToast('Ошибка загрузки: '+error.message,'err');return null;}
    return supabase.storage.from('images').getPublicUrl(name).data.publicUrl;
  };

  const handleMainImg = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if(!file)return;
    setUploading(true);
    const url = await uploadImage(file);
    if(url) setForm(f=>({...f,image_main:url}));
    setUploading(false);
  };

  const handleGalleryImg = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files||[]); if(!files.length)return;
    setUploading(true);
    const urls:string[] = [];
    for(const file of files){const u=await uploadImage(file);if(u)urls.push(u);}
    setForm(f=>({...f,gallery:[...f.gallery,...urls]}));
    setUploading(false);
  };

  const addGalleryUrl = () => {
    const url=galleryInput.trim(); if(!url)return;
    setForm(f=>({...f,gallery:[...f.gallery,url]}));
    setGalleryInput('');
  };

  const removeGalleryImg = (idx:number) => setForm(f=>({...f,gallery:f.gallery.filter((_,i)=>i!==idx)}));

  const handleSave = async () => {
    if(!form.name_ru||!form.name_en){showToast('Заполни названия RU и EN','err');return;}
    setSaving(true);
    const payload:any = {
      ...form,
      gallery:         Array.isArray(form.gallery)         ? form.gallery.filter(Boolean)         : [],
      available_dates: Array.isArray(form.available_dates) ? form.available_dates.filter(Boolean).sort() : [],
      price:      form.price   ? Number(form.price)   : null,
      price_1:    form.price_1 ? Number(form.price_1) : null,
      price_2:    form.price_2 ? Number(form.price_2) : null,
      duration_h: form.duration_h ? Number(form.duration_h) : null,
      sort_order: Number(form.sort_order)||0,
    };
    if(!editId) delete payload.id;
    const result = editId
      ? await supabase.from('tours').update(payload).eq('id',editId)
      : await supabase.from('tours').insert([payload]);
    setSaving(false);
    if(result.error){showToast('Ошибка: '+result.error.message,'err');return;}
    showToast(editId?'✓ Тур обновлён':'✓ Тур добавлен');
    resetForm(); loadTours();
  };

  const handleDelete = async (id:number) => {
    setDeleting(id);
    const {error} = await supabase.from('tours').delete().eq('id',id);
    setDeleting(null);
    if(error){showToast('Ошибка удаления','err');return;}
    showToast('Тур удалён'); loadTours();
  };

  const toggleActive = async (tour:Tour) => {
    await supabase.from('tours').update({is_active:!tour.is_active}).eq('id',tour.id!);
    loadTours();
  };

  const startEdit = (tour:Tour) => {
    setForm({
      ...tour,
      price:           tour.price    !=null?String(tour.price):'',
      price_1:         (tour as any).price_1!=null?String((tour as any).price_1):'',
      price_2:         (tour as any).price_2!=null?String((tour as any).price_2):'',
      duration_h:      tour.duration_h!=null?String(tour.duration_h):'',
      route_ru:        (tour as any).route_ru||'',
      route_en:        (tour as any).route_en||'',
      gallery:         Array.isArray(tour.gallery)?tour.gallery.filter(Boolean):[],
      available_dates: Array.isArray(tour.available_dates)?tour.available_dates.filter(Boolean):[],
    });
    setEditId(tour.id!); setShowForm(true);
    window.scrollTo({top:0,behavior:'smooth'});
  };

  const resetForm = () => { setForm(EMPTY);setEditId(null);setShowForm(false);setGalleryInput(''); };

  // ── PIN ───────────────────────────────────────────────────────────────────
  if(!authed) return (
    <div style={{minHeight:'100vh',background:'#0d1117',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;700;900&display=swap');`}</style>
      <div style={{textAlign:'center',padding:'0 24px'}}>
        <div style={{width:52,height:52,margin:'0 auto 18px',background:'linear-gradient(135deg,#92400e,#b91c1c)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🐉</div>
        <p style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:3,color:'#fff',marginBottom:3}}>DRAGON <span style={{color:'#f59e0b'}}>TRIPS</span></p>
        <p style={{fontSize:9,color:'rgba(255,255,255,0.25)',letterSpacing:4,textTransform:'uppercase',marginBottom:32}}>Admin Panel</p>
        <input type="password" placeholder="PIN" value={pin}
          onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&checkPin()}
          style={{width:180,padding:'13px 20px',border:`1px solid ${pinError?'#ef4444':'rgba(255,255,255,0.1)'}`,background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:20,textAlign:'center',letterSpacing:8,outline:'none',display:'block',margin:'0 auto 14px',transition:'border-color .2s',borderRadius:0}}/>
        <button onClick={checkPin} style={{padding:'11px 36px',border:'none',cursor:'pointer',background:'linear-gradient(135deg,#92400e,#b91c1c)',color:'#fff',fontSize:11,fontWeight:900,letterSpacing:3,textTransform:'uppercase'}}>
          Войти
        </button>
        {pinError&&<p style={{color:'#ef4444',fontSize:11,marginTop:12,letterSpacing:1}}>Неверный PIN</p>}
      </div>
    </div>
  );

  // ── MAIN ──────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#0d1117',color:'#fff',fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700;900&display=swap');
        .bebas{font-family:'Bebas Neue',sans-serif;}
        *{box-sizing:border-box;}
        .F{width:100%;padding:11px 14px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border-color .2s;resize:vertical;border-radius:0;}
        .F:focus{border-color:rgba(245,158,11,0.5);}
        .F::placeholder{color:rgba(255,255,255,0.2);}
        .L{display:block;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:7px;}
        .SEC{border-top:1px solid rgba(255,255,255,0.06);padding:20px 0;}
        .ST{font-size:9px;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:rgba(245,158,11,0.6);margin-bottom:16px;}
        .ROW{display:flex;gap:14px;align-items:center;padding:15px 16px;border-bottom:1px solid rgba(255,255,255,0.05);transition:background .15s;}
        .ROW:hover{background:rgba(255,255,255,0.02);}
        .ROW:last-child{border-bottom:none;}
        .TGL{width:36px;height:20px;border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;}
        .TGL::after{content:'';position:absolute;top:3px;width:14px;height:14px;background:#fff;transition:left .2s;}
        .TGL.on{background:#16a34a;}.TGL.off{background:rgba(255,255,255,0.12);}
        .TGL.on::after{left:19px;}.TGL.off::after{left:3px;}
        .UPL{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;cursor:pointer;border:1px dashed rgba(245,158,11,0.3);background:rgba(245,158,11,0.04);color:rgba(245,158,11,0.8);font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;transition:all .2s;white-space:nowrap;}
        .UPL:hover{background:rgba(245,158,11,0.1);}
        .BF{padding:11px 24px;border:none;cursor:pointer;background:linear-gradient(135deg,#92400e,#b91c1c);color:#fff;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;}
        .BF:disabled{opacity:.35;cursor:not-allowed;}
        .BG{padding:9px 16px;cursor:pointer;background:transparent;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.45);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;}
        .BG:hover{border-color:rgba(255,255,255,0.22);color:#fff;}
        .BS{padding:7px 12px;cursor:pointer;background:transparent;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;}
        .BS:hover{border-color:rgba(255,255,255,0.22);color:#fff;}
        .BD{padding:7px 12px;cursor:pointer;background:transparent;border:1px solid rgba(185,28,28,0.2);color:rgba(239,68,68,0.65);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;}
        .BD:hover{border-color:rgba(185,28,28,0.45);color:#ef4444;}
        .BD:disabled{opacity:.35;cursor:not-allowed;}
        .G2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .G3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
        @media(max-width:600px){.G2,.G3{grid-template-columns:1fr;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes tst{from{opacity:0;transform:translateY(10px) translateX(-50%);}to{opacity:1;transform:translateY(0) translateX(-50%);}}
        .TST{position:fixed;bottom:24px;left:50%;padding:11px 24px;font-size:13px;font-weight:700;animation:tst .3s ease forwards;z-index:999;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,0.5);}
        .TST.ok{background:#15803d;color:#fff;}.TST.err{background:#b91c1c;color:#fff;}
        .DCHIP{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;font-size:10px;font-weight:700;color:#f59e0b;border:1px solid rgba(245,158,11,0.25);background:rgba(245,158,11,0.06);}
        .DCHIP button{background:none;border:none;color:rgba(245,158,11,0.5);cursor:pointer;font-size:12px;line-height:1;padding:0;}
        .DCHIP button:hover{color:#ef4444;}
        .PTAB{display:flex;border:1px solid rgba(255,255,255,0.08);}
        .PTAB button{flex:1;padding:10px;background:transparent;border:none;color:rgba(255,255,255,0.35);font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-right:1px solid rgba(255,255,255,0.08);transition:all .15s;}
        .PTAB button:last-child{border-right:none;}
        .PTAB button.act{background:rgba(245,158,11,0.1);color:#f59e0b;}
      `}</style>

      {/* TOP BAR */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(13,17,23,0.98)',backdropFilter:'blur(12px)',borderBottom:'1px solid rgba(255,255,255,0.07)',padding:'13px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:32,height:32,background:'linear-gradient(135deg,#92400e,#b91c1c)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🐉</div>
          <div>
            <p className="bebas" style={{fontSize:16,letterSpacing:2.5,lineHeight:1.1}}>
              DRAGON <span style={{color:'#f59e0b'}}>TRIPS</span>
              <span style={{color:'rgba(255,255,255,0.25)',fontSize:12,marginLeft:10,fontFamily:'DM Sans',letterSpacing:1,fontWeight:400}}>/ADMIN</span>
            </p>
            <p style={{fontSize:8,color:'rgba(255,255,255,0.25)',letterSpacing:2.5,textTransform:'uppercase'}}>Управление турами</p>
          </div>
        </div>
        <button onClick={()=>{resetForm();setShowForm(true);}} className="BF">+ Добавить тур</button>
      </div>

      <div style={{maxWidth:880,margin:'0 auto',padding:'28px 16px 80px'}}>

        {/* ── FORM ── */}
        {showForm&&(
          <div style={{border:'1px solid rgba(255,255,255,0.08)',marginBottom:32,background:'rgba(255,255,255,0.015)'}}>
            <div style={{padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(245,158,11,0.025)'}}>
              <p className="bebas" style={{fontSize:20,letterSpacing:2.5,color:'#f59e0b'}}>
                {editId?'✎  Редактировать тур':'+  Новый тур'}
              </p>
              <button onClick={resetForm} className="BS">✕ Отмена</button>
            </div>

            <div style={{padding:'0 24px 24px'}}>

              {/* Названия */}
              <div className="SEC">
                <p className="ST">Название</p>
                <div className="G2">
                  <div><label className="L">🇷🇺 Название RU *</label><input className="F" placeholder="Острова Чамов" value={form.name_ru} onChange={e=>setForm(f=>({...f,name_ru:e.target.value}))}/></div>
                  <div><label className="L">🇬🇧 Название EN *</label><input className="F" placeholder="Cham Islands Tour" value={form.name_en} onChange={e=>setForm(f=>({...f,name_en:e.target.value}))}/></div>
                </div>
              </div>

              {/* Описание */}
              <div className="SEC">
                <p className="ST">Описание тура</p>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div><label className="L">🇷🇺 Описание RU</label><textarea className="F" rows={4} placeholder="Яркое описание тура, впечатления, особенности..." value={form.desc_ru} onChange={e=>setForm(f=>({...f,desc_ru:e.target.value}))}/></div>
                  <div><label className="L">🇬🇧 Описание EN</label><textarea className="F" rows={4} placeholder="Vivid tour description, highlights, features..." value={form.desc_en} onChange={e=>setForm(f=>({...f,desc_en:e.target.value}))}/></div>
                </div>
              </div>

              {/* Маршрут */}
              <div className="SEC">
                <p className="ST">Маршрут тура</p>
                <p style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:14,lineHeight:1.6}}>
                  Опиши остановки, время, что будет на каждом этапе. Используй нумерацию: «1. Место — что делаем»
                </p>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div><label className="L">🇷🇺 Маршрут RU</label><textarea className="F" rows={6} placeholder={'1. 08:00 — Отправление из центра Дананга\n2. 09:30 — Причал, посадка на лодку\n3. 10:00 — Прибытие на острова...'} value={form.route_ru} onChange={e=>setForm(f=>({...f,route_ru:e.target.value}))}/></div>
                  <div><label className="L">🇬🇧 Маршрут EN</label><textarea className="F" rows={6} placeholder={'1. 08:00 — Departure from Da Nang center\n2. 09:30 — Pier, board the boat\n3. 10:00 — Arrival at the islands...'} value={form.route_en} onChange={e=>setForm(f=>({...f,route_en:e.target.value}))}/></div>
                </div>
              </div>

              {/* Параметры */}
              <div className="SEC">
                <p className="ST">Параметры</p>
                <div className="G3" style={{marginBottom:18}}>
                  <div>
                    <label className="L">Категория</label>
                    <select className="F" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                      <option value="">— выбрать —</option>
                      {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="L">⏱ Длительность (ч)</label><input className="F" type="number" placeholder="6" value={form.duration_h} onChange={e=>setForm(f=>({...f,duration_h:e.target.value}))}/></div>
                  <div><label className="L">Порядок</label><input className="F" type="number" placeholder="0" value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:Number(e.target.value)}))}/></div>
                </div>
                <div style={{display:'flex',gap:32}}>
                  <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                    <button type="button" className={`TGL ${form.hot?'on':'off'}`} onClick={()=>setForm(f=>({...f,hot:!f.hot}))}/>
                    <span style={{fontSize:12,color:form.hot?'#f59e0b':'rgba(255,255,255,0.3)',fontWeight:700}}>Хит сезона</span>
                  </label>
                  <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                    <button type="button" className={`TGL ${form.is_active?'on':'off'}`} onClick={()=>setForm(f=>({...f,is_active:!f.is_active}))}/>
                    <span style={{fontSize:12,color:form.is_active?'#16a34a':'rgba(255,255,255,0.3)',fontWeight:700}}>{form.is_active?'Активен':'Скрыт'}</span>
                  </label>
                </div>
              </div>

              {/* Цены */}
              <div className="SEC">
                <p className="ST">Цены (USD)</p>
                <p style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:16,lineHeight:1.6}}>
                  Базовая цена — обязательна. Цена за 1 и за 2 человека — заполни только если есть спецпредложение (иначе оставь пустым).
                </p>
                <div className="G3">
                  {/* Базовая */}
                  <div style={{border:'1px solid rgba(255,255,255,0.08)',padding:'14px 16px'}}>
                    <label className="L">Базовая цена / чел *</label>
                    <div style={{position:'relative'}}>
                      <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'rgba(255,255,255,0.4)',fontWeight:700}}>$</span>
                      <input className="F" type="number" placeholder="35" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} style={{paddingLeft:28,fontSize:17,fontWeight:900}}/>
                    </div>
                    {form.price&&(
                      <p style={{fontSize:10,color:'rgba(245,158,11,0.6)',marginTop:6,fontWeight:700}}>
                        {fmt$(Number(form.price))} · {fmtVnd(Number(form.price))}
                      </p>
                    )}
                  </div>
                  {/* За 1 чел спец */}
                  <div style={{border:'1px solid rgba(255,255,255,0.06)',padding:'14px 16px',background:'rgba(255,255,255,0.01)'}}>
                    <label className="L" style={{color:'rgba(245,158,11,0.5)'}}>Цена за 1 чел (спец)</label>
                    <div style={{position:'relative'}}>
                      <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'rgba(255,255,255,0.3)',fontWeight:700}}>$</span>
                      <input className="F" type="number" placeholder="—" value={form.price_1} onChange={e=>setForm(f=>({...f,price_1:e.target.value}))} style={{paddingLeft:28,fontSize:17,fontWeight:900}}/>
                    </div>
                    {form.price_1&&(
                      <p style={{fontSize:10,color:'rgba(245,158,11,0.6)',marginTop:6,fontWeight:700}}>
                        {fmt$(Number(form.price_1))} · {fmtVnd(Number(form.price_1))}
                      </p>
                    )}
                  </div>
                  {/* За 2 чел */}
                  <div style={{border:'1px solid rgba(255,255,255,0.06)',padding:'14px 16px',background:'rgba(255,255,255,0.01)'}}>
                    <label className="L" style={{color:'rgba(245,158,11,0.5)'}}>Цена за 2 чел (итого)</label>
                    <div style={{position:'relative'}}>
                      <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'rgba(255,255,255,0.3)',fontWeight:700}}>$</span>
                      <input className="F" type="number" placeholder="—" value={form.price_2} onChange={e=>setForm(f=>({...f,price_2:e.target.value}))} style={{paddingLeft:28,fontSize:17,fontWeight:900}}/>
                    </div>
                    {form.price_2&&(
                      <>
                        <p style={{fontSize:10,color:'rgba(245,158,11,0.6)',marginTop:6,fontWeight:700}}>
                          {fmt$(Number(form.price_2))} · {fmtVnd(Number(form.price_2))}
                        </p>
                        {form.price&&(
                          <p style={{fontSize:9,color:'rgba(100,220,100,0.6)',marginTop:3}}>
                            Экономия: {fmt$(Number(form.price)*2-Number(form.price_2))}/чел → {fmt$(Math.round((Number(form.price)*2-Number(form.price_2))/2))}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Доступные даты */}
              <div className="SEC">
                <p className="ST">Доступные даты</p>
                {form.available_dates.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
                    {form.available_dates.map(d=>(
                      <div key={d} className="DCHIP">
                        {new Date(d+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}
                        <button onClick={()=>setForm(f=>({...f,available_dates:f.available_dates.filter(x=>x!==d)}))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <DatePicker selected={form.available_dates} onChange={dates=>setForm(f=>({...f,available_dates:dates}))}/>
              </div>

              {/* Главное фото */}
              <div className="SEC">
                <p className="ST">Главное фото <span style={{color:'rgba(255,255,255,0.25)',fontWeight:400,textTransform:'none',fontSize:9}}>1000×700px</span></p>
                <div style={{display:'flex',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
                  {form.image_main&&(
                    <div style={{position:'relative',flexShrink:0}}>
                      <img src={form.image_main} style={{width:140,height:98,objectFit:'cover',border:'1px solid rgba(255,255,255,0.08)',display:'block'}}/>
                      <button onClick={()=>setForm(f=>({...f,image_main:''}))} style={{position:'absolute',top:-7,right:-7,width:20,height:20,border:'none',background:'#b91c1c',color:'#fff',cursor:'pointer',fontSize:11}}>✕</button>
                    </div>
                  )}
                  <div style={{display:'flex',flexDirection:'column',gap:8,flex:1,minWidth:200}}>
                    <label className="UPL">{uploading?'⏳ Загрузка...':'↑ Загрузить файл'}<input ref={mainImgRef} type="file" accept="image/*" onChange={handleMainImg} style={{display:'none'}}/></label>
                    <input className="F" placeholder="или вставь URL..." value={form.image_main} onChange={e=>setForm(f=>({...f,image_main:e.target.value}))} style={{fontSize:11}}/>
                  </div>
                </div>
              </div>

              {/* Галерея */}
              <div className="SEC">
                <p className="ST">Галерея <span style={{color:'rgba(255,255,255,0.25)',fontWeight:400,textTransform:'none',fontSize:9}}>({form.gallery.length} фото, 1000×700px)</span></p>
                {form.gallery.length>0&&(
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
                    {form.gallery.map((url,i)=>(
                      <div key={i} style={{position:'relative'}}>
                        <img src={url} style={{width:70,height:49,objectFit:'cover',border:'1px solid rgba(255,255,255,0.07)'}}/>
                        <button onClick={()=>removeGalleryImg(i)} style={{position:'absolute',top:-6,right:-6,width:18,height:18,border:'none',background:'#b91c1c',color:'#fff',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <label className="UPL">{uploading?'⏳...':'↑ Добавить фото'}<input ref={galleryRef} type="file" accept="image/*" multiple onChange={handleGalleryImg} style={{display:'none'}}/></label>
                  <div style={{display:'flex',gap:6,flex:1,minWidth:200}}>
                    <input className="F" placeholder="или URL..." value={galleryInput} onChange={e=>setGalleryInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGalleryUrl()} style={{fontSize:11}}/>
                    <button onClick={addGalleryUrl} className="BS">+ Add</button>
                  </div>
                </div>
              </div>

              {/* Save */}
              <div style={{display:'flex',justifyContent:'flex-end',gap:10,paddingTop:20,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                <button onClick={resetForm} className="BG">Отмена</button>
                <button onClick={handleSave} className="BF" disabled={saving}>
                  {saving?'⏳ Сохраняю...':editId?'✓ Сохранить':'✓ Создать тур'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LIST ── */}
        <div style={{marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <p className="bebas" style={{fontSize:18,letterSpacing:2.5,color:'rgba(255,255,255,0.5)'}}>
            Туры <span style={{color:'#f59e0b'}}>({tours.length})</span>
          </p>
          <button onClick={loadTours} className="BS">↻ Обновить</button>
        </div>

        <div style={{border:'1px solid rgba(255,255,255,0.07)'}}>
          {loading?(
            <div style={{display:'flex',justifyContent:'center',padding:'60px 0'}}>
              <div style={{width:28,height:28,border:'2px solid rgba(245,158,11,0.2)',borderTopColor:'#f59e0b',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
            </div>
          ):tours.length===0?(
            <div style={{textAlign:'center',padding:'60px 0',color:'rgba(255,255,255,0.18)'}}>
              <p style={{fontSize:11,letterSpacing:3,textTransform:'uppercase'}}>Туров пока нет — добавь первый</p>
            </div>
          ):tours.map(tour=>(
            <div key={tour.id} className="ROW">
              <div style={{width:72,height:50,overflow:'hidden',flexShrink:0,background:'#0c0f1c'}}>
                {tour.image_main?<img src={tour.image_main} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                :<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,opacity:0.1}}>🗺️</div>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <p style={{fontSize:13,fontWeight:800,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'rgba(255,255,255,0.9)'}}>{tour.name_ru}</p>
                  {tour.hot&&<span style={{fontSize:8,background:'rgba(185,28,28,0.15)',color:'#ef4444',padding:'2px 7px',fontWeight:900,letterSpacing:1.5,textTransform:'uppercase',border:'1px solid rgba(185,28,28,0.2)',flexShrink:0}}>ХИТ</span>}
                </div>
                <div style={{display:'flex',gap:12,fontSize:10,color:'rgba(255,255,255,0.3)',flexWrap:'wrap',alignItems:'center'}}>
                  {tour.category&&<span style={{letterSpacing:'0.1em',textTransform:'uppercase',fontSize:9}}>{tour.category}</span>}
                  {(tour as any).price&&<span style={{color:'rgba(245,158,11,0.6)',fontWeight:700}}>${Number((tour as any).price)} · {fmtVnd(Number((tour as any).price))}</span>}
                  {tour.duration_h&&<span>{tour.duration_h}ч</span>}
                  {(tour as any).available_dates?.length>0&&<span style={{color:'rgba(100,200,100,0.5)',fontSize:9}}>{(tour as any).available_dates.length} дат</span>}
                  {(tour as any).route_ru&&<span style={{color:'rgba(100,150,255,0.5)',fontSize:9}}>📍 маршрут</span>}
                </div>
              </div>
              <button className={`TGL ${tour.is_active?'on':'off'}`} onClick={()=>toggleActive(tour)} title={tour.is_active?'Скрыть':'Показать'}/>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>startEdit(tour)} className="BS">✎ Изменить</button>
                <button onClick={()=>{if(confirm(`Удалить "${tour.name_ru}"?`))handleDelete(tour.id!);}} className="BD" disabled={deleting===tour.id}>{deleting===tour.id?'...':'✕'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {toast&&<div className={`TST ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}