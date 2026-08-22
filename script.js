/* หน้าจอและการโต้ตอบ — ส่วนที่คุยกับ Apps Script อยู่ใน api.js */

/* ---------- ธีมสว่าง / มืด ----------
   ยังไม่เคยกดสลับ = ตามค่าของเครื่อง กดครั้งแรกเมื่อไหร่ถึงจำค่านั้นไว้ตลอด */
var LS_THEME = 'basic-stock:theme';

function savedTheme(){
  try{ var t = localStorage.getItem(LS_THEME); return (t==='light'||t==='dark') ? t : null; }
  catch(e){ return null; }
}
function currentTheme(){
  return savedTheme() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function applyTheme(){
  var dark = currentTheme()==='dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelectorAll('.theme-sw').forEach(function(b){
    b.setAttribute('aria-checked', String(dark));
    b.title = dark ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด';
  });
}
function toggleTheme(){
  var next = currentTheme()==='dark' ? 'light' : 'dark';
  try{ localStorage.setItem(LS_THEME, next); }catch(e){}
  applyTheme();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){
  if(!savedTheme()) applyTheme();
});

/* ---------- เข้าสู่ระบบ / ออกจากระบบ ----------
   ทุกคำสั่งแนบรหัสผ่านไปเอง รหัสผ่านจึงค้างอยู่ใน localStorage จนกว่าจะกดออกจากระบบ */
var LS_SESSION = 'basic-stock:session';
var SESSION = null;
var ME = null;

function readSession(){
  try{ var s = JSON.parse(localStorage.getItem(LS_SESSION)); return (s && s.username) ? s : null; }
  catch(e){ return null; }
}
function saveSession(s){
  SESSION = s;
  try{ localStorage.setItem(LS_SESSION, JSON.stringify(s)); }catch(e){}
}
function clearSession(){
  SESSION = null; ME = null;
  document.body.classList.remove('admin');
  try{ localStorage.removeItem(LS_SESSION); }catch(e){}
  clearSnapshot();
}

/* ---------- ข้อมูลชุดล่าสุดที่เก็บไว้ในเครื่อง ----------
   Apps Script ตอบกลับรอบละ 2-4 วินาที จึงวาดจอจากชุดที่เก็บไว้ก่อน แล้วเอาของจริงมาทับ */
var LS_SNAP = 'basic-stock:snapshot';

function readSnapshot(user){
  try{
    var s = JSON.parse(localStorage.getItem(LS_SNAP));
    /* ชุดที่เก็บไว้เป็นของอีกบัญชี = สลับผู้ใช้ ห้ามเอาของคนก่อนมาโชว์ */
    if(!s || !s.user || !user || s.user.username !== user.username) return null;
    return s;
  }catch(e){ return null; }
}
function writeSnapshot(d){
  try{
    localStorage.setItem(LS_SNAP, JSON.stringify({
      user: d.user, products: d.products, movements: d.movements, movesTotal: d.movesTotal
    }));
  }catch(e){}
}
function clearSnapshot(){ try{ localStorage.removeItem(LS_SNAP); }catch(e){} }

function setSyncing(on){
  document.getElementById('syncing').classList.toggle('show', on);
}

function showLogin(message){
  document.body.classList.add('guest');
  closeNav();
  /* หน้าเข้าสู่ระบบแค่บังกล่องโต้ตอบที่ค้างอยู่ ไม่ปิดให้ — ไม่ปิดเองมันจะโผล่กลับมาตอนเข้าระบบสำเร็จ */
  document.querySelectorAll('.scrim.open').forEach(function(s){ s.classList.remove('open') });
  document.getElementById('loginErr').textContent = message || '';
  set('l-pass','');
  setTimeout(function(){ document.getElementById(val('l-user') ? 'l-pass' : 'l-user').focus() }, 60);
}

async function submitLogin(e){
  e.preventDefault();
  var btn = document.getElementById('loginBtn'), err = document.getElementById('loginErr');
  err.textContent = '';
  btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…';
  try{
    var user = val('l-user').trim(), pass = val('l-pass');
    var r = await API.login(user, pass);
    saveSession({username:user, password:pass, user:r.user});
    set('l-pass','');
    document.body.classList.remove('guest');
    applyData(r);   /* คำตอบของ login มีข้อมูลทั้งชุดแล้ว ไม่ต้องโหลดซ้ำ */
  }catch(ex){
    err.textContent = ex.message || ex;
    document.getElementById('l-pass').focus();
  }finally{
    btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
  }
}

function logout(){
  if(!confirm('ออกจากระบบ?')) return;
  clearSession();
  STATE = {products:[], movements:[], movesTotal:0};
  /* ต้องล้าง DOM ด้วย ไม่ใช่แค่ตัวแปร ไม่งั้นของคนก่อนจะโผล่ให้คนถัดไปเห็นตอนเข้าระบบสำเร็จ */
  ['whoName','whoRole','setName','setUser','setRole'].forEach(function(id){
    document.getElementById(id).textContent = '';
  });
  set('q',''); set('fstat','');
  prepareFeeds([]);
  renderKpis(); render(); renderFeeds(); updateBadge();
  showTab('dashboard');
  set('l-user','');
  showLogin();
}

/* รหัสผ่านที่เก็บไว้ใช้ไม่ได้แล้ว — พากลับไปหน้าเข้าสู่ระบบ ไม่ใช่แค่ขึ้นข้อความผิดพลาด */
function fail(err){
  if(err && err.code === 'auth'){ clearSession(); showLogin(err.message); return; }
  toast((err && err.message) || err, 'err');
}

function togglePass(id, btn){
  var input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.classList.toggle('on', input.type === 'text');
  input.focus();
}

/* ---------- สถานะและการวาดหน้าจอ ---------- */
var STATE = {products:[], movements:[], movesTotal:0};
var THB = new Intl.NumberFormat('th-TH');
function money(n){ return '฿' + THB.format(Math.round(n)); }
function statusOf(p){ return p._status || (p.qty <= 0 ? 'out' : 'ok'); }
function isAdmin(){ return !!ME && ME.role === 'admin'; }

var FEEDS = {stockout:[], stockin:[], rendered:{stockout:false, stockin:false}};

function prepareProducts(products){
  return (products || []).map(function(p){
    var item = Object.assign({}, p);
    item._status = item.qty <= 0 ? 'out' : 'ok';
    item._search = (String(item.name || '') + '\n' + String(item.sku || '')).toLowerCase();
    item._value = item.qty * item.price;
    return item;
  }).sort(function(a,b){
    var order = {out:0, ok:1};
    return order[a._status] - order[b._status] || a.name.localeCompare(b.name, 'th');
  });
}

function prepareFeeds(movements){
  var list = (movements || []).slice().sort(function(a,b){
    return String(b.date).localeCompare(String(a.date));
  });
  FEEDS.stockout = [];
  FEEDS.stockin = [];
  list.forEach(function(m){
    (m.qty < 0 ? FEEDS.stockout : FEEDS.stockin).push(m);
  });
  FEEDS.rendered = {stockout:false, stockin:false};
  updateFeedCounts();
}

/* ทุกคำสั่งบันทึกส่งข้อมูลชุดใหม่กลับมาด้วย จึงวาดหน้าจอต่อได้เลย ไม่ต้องยิงขอข้อมูลอีกรอบ */
function applyData(data, cached){
  ME = data.user;
  STATE.products = prepareProducts(data.products);
  STATE.movements = data.movements || [];
  /* ชีตส่งประวัติมาแค่ MOVE_LIMIT แถว ยอดจริงต้องดูที่ movesTotal */
  STATE.movesTotal = data.movesTotal != null ? data.movesTotal : STATE.movements.length;
  prepareFeeds(STATE.movements);
  applyRole();
  renderKpis(); render(); renderActiveFeed(); renderSettings(); updateBadge();
  if(!cached) writeSnapshot(data);
}

async function boot(){
  try{ applyData(await API.bootstrap()); }
  catch(err){ fail(err); }
}

/* พนักงานเห็นทุกอย่างแต่แก้ได้เฉพาะยอดสต๊อก — ซ่อนปุ่มเฉย ๆ ของจริงเซิร์ฟเวอร์กันอีกชั้น */
function applyRole(){
  document.body.classList.toggle('admin', isAdmin());
  document.getElementById('whoName').textContent = ME.name || ME.username;
  var chip = document.getElementById('whoRole');
  chip.textContent = isAdmin() ? 'แอดมิน' : 'พนักงาน';
  chip.className = 'chip' + (isAdmin() ? ' chip-admin' : '');
  syncTopbar();
}

function updateBadge(){
  var alerts = STATE.products.filter(function(p){return statusOf(p)==='out'}).length;
  var b=document.getElementById('navBadge');
  b.textContent=alerts; b.className='badge'+(alerts>0?' show':'');
}

function renderKpis(){
  var ps = STATE.products;
  var totalValue = ps.reduce(function(s,p){return s + p._value}, 0);
  var out = ps.filter(function(p){return p._status==='out'}).length;
  var units = ps.reduce(function(s,p){return s + p.qty}, 0);
  document.getElementById('kpis').innerHTML =
    kpi('จำนวนรายการ', THB.format(ps.length), '<span class="neu">'+THB.format(units)+'</span> หน่วยรวมในคลัง', 'gb-primary',
        'img/quantity.png') +
    kpi('มูลค่าสต๊อก', money(totalValue), 'ราคา × จำนวน ของทุกรายการ', 'gb-success',
        'img/money.png') +
    kpi('หมดสต๊อก', THB.format(out), (out>0?'<span class="neg">ต้องเติมด่วน</span>':'ไม่มีของขาด'), 'gb-danger',
        'img/delete.png');
}
/* icon เป็นได้ทั้ง path ของ svg หรือ path ไฟล์ภาพ (.png/.svg/.webp) */
function kpi(lab,val,sub,grad,icon){
  var img = /\.(png|svg|webp|jpg)$/i.test(icon);
  var ic = img
    ? '<img src="'+icon+'" alt="">'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+icon+'</svg>';
  return '<div class="kpi"><div class="kpi-info"><div class="lab">'+lab+'</div><div class="val">'+val+'</div><div class="sub">'+sub+'</div></div>'+
    '<div class="badge-ic '+(img ? 'ic-img' : grad)+'">'+ic+'</div></div>';
}

var renderJob = 0;
function queueRender(){
  if(renderJob) cancelAnimationFrame(renderJob);
  renderJob = requestAnimationFrame(function(){
    renderJob = 0;
    render();
  });
}

function render(){
  var q = document.getElementById('q').value.trim().toLowerCase();
  var fs = document.getElementById('fstat').value;
  var list = STATE.products.filter(function(p){
    if (fs && p._status !== fs) return false;
    if (q && p._search.indexOf(q)<0) return false;
    return true;
  });
  document.getElementById('count-line').textContent = 'แสดง ' + list.length + ' จาก ' + STATE.products.length + ' รายการ';

  var tb = document.getElementById('rows');
  if (!list.length){
    var msg = STATE.products.length ? 'ไม่พบสินค้าที่ตรงเงื่อนไข'
            : (isAdmin() ? 'ยังไม่มีสินค้าในคลัง — กด “เพิ่มสินค้า” เพื่อเริ่มบันทึก'
                         : 'ยังไม่มีสินค้าในคลัง — ให้แอดมินเป็นคนเพิ่มรายการ');
    tb.innerHTML = '<tr><td colspan="7"><div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8V16a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg><div>'+msg+'</div></div></td></tr>';
    return;
  }
  tb.innerHTML = list.map(function(p){
    var st = p._status;
    var stLabel = {out:'หมดสต๊อก',ok:'มีสินค้า'}[st];
    var stClass = {out:'s-out',ok:'s-ok'}[st];
    return '<tr>'+
      '<td class="l"><div class="p-name">'+esc(p.name)+'</div><div class="p-sku">'+esc(p.sku)+'</div></td>'+
      '<td class="stock-cell"><b>'+THB.format(p.qty)+'</b></td>'+
      '<td class="col-unit">'+(p.unit?esc(p.unit):'—')+'</td>'+
      '<td class="col-price">'+money(p.price)+'</td>'+
      '<td class="col-status"><span class="status '+stClass+'">'+stLabel+'</span></td>'+
      '<td class="col-value">'+money(p._value)+'</td>'+
      '<td><div class="row-actions">'+
        '<button class="act-btn edit admin-only" onclick="openProduct(\''+esc(jsq(p.sku))+'\')">แก้ไขสินค้า</button>'+
        '<button class="act-btn move" onclick="openMove(\''+esc(jsq(p.sku))+'\')">ปรับสต๊อก</button>'+
        '<button class="act-btn danger admin-only" onclick="removeProduct(\''+esc(jsq(p.sku))+'\')">ลบ</button>'+
      '</div></td>'+
    '</tr>';
  }).join('');
}

/* แยกสองหน้าด้วยเครื่องหมายของ qty ไม่ใช่ชื่อประเภท เพราะ "ปรับยอด" เป็นได้ทั้งเพิ่มและลด */
function renderFeeds(){
  renderFeed('feed-out', 'out-count', FEEDS.stockout, 'ยังไม่มีประวัติการเบิกออก');
  renderFeed('feed-in',  'in-count',  FEEDS.stockin,  'ยังไม่มีประวัติการรับเข้า');
  FEEDS.rendered.stockout = true;
  FEEDS.rendered.stockin = true;
}

function updateFeedCounts(){
  updateFeedCount('stockout', 'out-count');
  updateFeedCount('stockin', 'in-count');
}

function updateFeedCount(tab, countId){
  var el = document.getElementById(countId);
  if(!el) return;
  var list = FEEDS[tab];
  el.textContent = STATE.movements.length < STATE.movesTotal
    ? THB.format(list.length) + ' รายการ จากประวัติ ' + THB.format(STATE.movements.length) + ' รายการล่าสุด'
    : 'ทั้งหมด ' + THB.format(list.length) + ' รายการ';
}

function renderActiveFeed(){
  if(TAB === 'stockout' && !FEEDS.rendered.stockout){
    renderFeed('feed-out', 'out-count', FEEDS.stockout, 'ยังไม่มีประวัติการเบิกออก');
    FEEDS.rendered.stockout = true;
  }else if(TAB === 'stockin' && !FEEDS.rendered.stockin){
    renderFeed('feed-in', 'in-count', FEEDS.stockin, 'ยังไม่มีประวัติการรับเข้า');
    FEEDS.rendered.stockin = true;
  }
}

function renderFeed(bodyId, countId, list, emptyMsg){
  var feed = document.getElementById(bodyId);

  /* ต้องบอกว่าตัวเลขนับจากช่วงไหน ไม่งั้นคนอ่านจะนึกว่าเป็นยอดรวมทั้งหมด */
  updateFeedCount(bodyId === 'feed-out' ? 'stockout' : 'stockin', countId);

  if (!list.length){
    feed.innerHTML = '<tr><td colspan="8"><div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg><div>'+emptyMsg+'</div></div></td></tr>';
    return;
  }

  var typeMap = {'รับเข้า':'in','เบิกออก':'out','ปรับยอด':'adjust'};
  feed.innerHTML = list.map(function(m){
    var cls = typeMap[m.type]||'adjust';
    var sign = m.qty>0?'+':'';
    var before = m.balance - m.qty;   /* ชีตเก็บแต่ยอดหลังทำรายการ */
    return '<tr>'+
      '<td class="l mv-date">'+esc(m.date)+'</td>'+
      '<td class="l"><div class="p-name">'+esc(m.name)+'</div><div class="p-sku">'+esc(m.sku)+'</div></td>'+
      '<td><span class="mv-type '+cls+'">'+esc(m.type)+'</span></td>'+
      '<td class="mv-delta '+cls+'">'+sign+THB.format(m.qty)+'</td>'+
      '<td class="col-before mv-before">'+THB.format(before)+'</td>'+
      '<td class="mv-after">'+THB.format(m.balance)+'</td>'+
      '<td class="col-user mv-user">'+(m.user?esc(m.user):'—')+'</td>'+
      '<td class="col-note" title="'+esc(m.note)+'">'+(m.note?esc(m.note):'—')+'</td>'+
    '</tr>';
  }).join('');
}

function renderSettings(){
  document.getElementById('setName').textContent = ME.name || '—';
  document.getElementById('setUser').textContent = ME.username;
  var chip = document.getElementById('setRole');
  chip.className = 'status ' + (isAdmin() ? 's-admin' : 's-staff');
  chip.textContent = isAdmin() ? 'แอดมิน' : 'พนักงาน';
}

/* ---------- โมดัลสินค้า ---------- */
var editingSku = null;
function openProduct(sku){
  editingSku = sku || null;
  var p = sku ? STATE.products.find(function(x){return x.sku===sku}) : null;
  document.getElementById('pTitle').textContent = p ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า';
  document.getElementById('pSub').textContent = p ? 'ปรับรายละเอียดสินค้า '+p.sku : 'กรอกข้อมูลสินค้าใหม่เข้าคลัง';
  set('f-sku', p?p.sku:''); set('f-name', p?p.name:'');
  set('f-qty', p?p.qty:0); set('f-unit', p?p.unit:''); set('f-price', p?p.price:0);
  document.getElementById('f-qty').disabled = !!p;
  openModal('pModal');
  setTimeout(function(){document.getElementById('f-name').focus()},60);
}
async function saveProductForm(){
  var payload = {
    originalSku: editingSku,
    sku: val('f-sku').trim(), name: val('f-name').trim(),
    qty: +val('f-qty')||0, unit: val('f-unit').trim()||'ชิ้น', price:+val('f-price')||0
  };
  if(!payload.sku){ toast('กรุณากรอกรหัสสินค้า','err'); return; }
  if(!payload.name){ toast('กรุณากรอกชื่อสินค้า','err'); return; }
  if(payload.qty<0 || payload.price<0){ toast('จำนวนและราคาต้องไม่ติดลบ','err'); return; }
  var btn=document.getElementById('pSave'); btn.disabled=true; btn.textContent='กำลังบันทึก…';
  try{ applyData(await API.save(payload)); closeModal('pModal'); toast(editingSku?'แก้ไขสินค้าแล้ว':'เพิ่มสินค้าแล้ว','ok'); }
  catch(err){ fail(err); }
  finally{ btn.disabled=false; btn.textContent='บันทึกสินค้า'; }
}
async function removeProduct(sku){
  var p = STATE.products.find(function(x){return x.sku===sku});
  if(!confirm('ลบสินค้า "'+(p?p.name:sku)+'" ?\nประวัติการเคลื่อนไหวเดิมจะยังอยู่')) return;
  try{ applyData(await API.del(sku)); toast('ลบสินค้าแล้ว','ok'); }
  catch(err){ fail(err); }
}

/* ---------- โมดัลปรับสต๊อก ---------- */
var moveSku=null, moveType='in';
function openMove(sku){
  moveSku=sku; moveType='in';
  var p=STATE.products.find(function(x){return x.sku===sku});
  document.getElementById('mSub').textContent = p.name+' ('+p.sku+')';
  document.getElementById('mCurrent').textContent = THB.format(p.qty);
  document.getElementById('mUnit').textContent = p.unit;
  set('m-qty',''); set('m-note','');
  setMoveType('in'); openModal('mModal');
  setTimeout(function(){document.getElementById('m-qty').focus()},60);
}
function setMoveType(t){
  moveType=t;
  ['in','out','adjust'].forEach(function(x){
    var b=document.querySelector('#mSeg button[data-type="'+x+'"]');
    b.className = x===t ? 'on-'+x : '';
  });
  document.getElementById('mQtyLabel').innerHTML =
    (t==='adjust'?'ตั้งจำนวนใหม่':'จำนวนที่'+(t==='in'?'รับเข้า':'เบิกออก'))+' <span class="req">*</span>';
  updateMovePreview();
}
function updateMovePreview(){
  var p=STATE.products.find(function(x){return x.sku===moveSku});
  if(!p) return;   /* สินค้าถูกลบระหว่างเปิดหน้าต่างนี้ค้างไว้ */
  var q=+val('m-qty')||0; var after;
  if(moveType==='in') after=p.qty+q; else if(moveType==='out') after=p.qty-q; else after=q;
  var el=document.getElementById('mPreview');
  el.textContent = q? ('จำนวนหลังทำรายการ: '+THB.format(after)+' '+p.unit) : '';
  el.style.color = after<0 ? 'var(--danger)' : 'var(--muted)';
}
document.getElementById('m-qty').addEventListener('input', updateMovePreview);
async function submitMovement(){
  var q=+val('m-qty')||0;
  if(q<0){ toast('จำนวนต้องไม่ติดลบ','err'); return; }
  if(moveType!=='adjust' && q<=0){ toast('กรุณากรอกจำนวนมากกว่า 0','err'); return; }
  var btn=document.getElementById('mSave'); btn.disabled=true; btn.textContent='กำลังบันทึก…';
  try{ applyData(await API.move({sku:moveSku, type:moveType, qty:q, note:val('m-note').trim()})); closeModal('mModal'); toast('บันทึกการเคลื่อนไหวแล้ว','ok'); }
  catch(err){ fail(err); }
  finally{ btn.disabled=false; btn.textContent='บันทึกรายการ'; }
}

/* ---------- โมดัลเปลี่ยนรหัสผ่าน ---------- */
function openPassword(){
  set('w-user', ME ? ME.username : '');
  set('w-old',''); set('w-new',''); set('w-new2','');
  openModal('wModal');
  setTimeout(function(){document.getElementById('w-old').focus()},60);
}
async function submitPassword(e){
  e.preventDefault();
  var oldP = val('w-old'), newP = val('w-new');
  if(newP.length < MIN_PASSWORD){ toast('รหัสผ่านใหม่ต้องยาวอย่างน้อย '+MIN_PASSWORD+' ตัว','err'); return; }
  if(newP !== val('w-new2')){ toast('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน','err'); return; }
  var btn=document.getElementById('wSave'); btn.disabled=true; btn.textContent='กำลังบันทึก…';
  try{
    await API.passwd(oldP, newP);
    /* ไม่อัปเดตตรงนี้ คำสั่งถัดไปจะแนบรหัสเดิมแล้วโดนเด้งออก ทั้งที่เพิ่งเปลี่ยนรหัสสำเร็จ */
    saveSession(Object.assign({}, SESSION, {password:newP}));
    closeModal('wModal'); toast('เปลี่ยนรหัสผ่านแล้ว','ok');
  }
  catch(err){ fail(err); }
  finally{ btn.disabled=false; btn.textContent='บันทึกรหัสผ่าน'; }
}

/* ---------- แท็บ ---------- */
var TAB = 'dashboard';
var TAB_TITLE = {dashboard:'ภาพรวมสินค้า', stockout:'ประวัติเบิกออก', stockin:'ประวัติรับเข้า', settings:'ตั้งค่า'};

function showTab(tab){
  TAB = tab;
  document.querySelectorAll('.sidebar nav button').forEach(function(b){
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  });
  Object.keys(TAB_TITLE).forEach(function(k){
    document.getElementById('view-'+k).hidden = k !== tab;
  });
  document.getElementById('pageTitle').textContent = TAB_TITLE[tab];
  document.getElementById('crumb').textContent = 'หน้าหลัก / ' + TAB_TITLE[tab];
  syncTopbar();
  renderActiveFeed();
}

function syncTopbar(){
  document.getElementById('addBtn').hidden = TAB !== 'dashboard';
}

document.querySelectorAll('.sidebar nav button').forEach(function(b){
  b.addEventListener('click', function(){ showTab(b.dataset.tab); closeNav(); });
});

/* ---------- ลิ้นชักเมนูบนจอแคบ ----------
   จอกว้างไซด์บาร์ค้างอยู่ตลอด คลาสนี้จึงไม่มีผลอะไร */
function toggleNav(){ setNav(!document.body.classList.contains('nav-open')); }
function closeNav(){ setNav(false); }
function setNav(open){
  document.body.classList.toggle('nav-open', open);
  document.querySelector('.nav-toggle').setAttribute('aria-expanded', String(open));
}
/* ลากจอกว้างขึ้นแล้วไซด์บาร์จะกลับมาค้างเอง ต้องล้างสถานะไว้ ไม่งั้นย่อกลับมาลิ้นชักจะเปิดค้าง */
matchMedia('(min-width: 981px)').addEventListener('change', function(e){ if(e.matches) closeNav(); });

/* ---------- ยูทิลิตี้ UI ---------- */
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.scrim').forEach(function(s){
  s.addEventListener('click', function(e){ if(e.target===s) s.classList.remove('open'); });
});
document.addEventListener('keydown', function(e){
  if(e.key!=='Escape') return;
  document.querySelectorAll('.scrim.open').forEach(function(s){s.classList.remove('open')});
  closeNav();
});
function toast(msg, kind){
  var t=document.createElement('div'); t.className='toast '+(kind||'');
  var ic = kind==='err' ? '<path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/>' : '<path d="M20 6 9 17l-5-5"/>';
  t.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'+ic+'</svg>'+esc(msg);
  document.getElementById('toasts').appendChild(t);
  setTimeout(function(){t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(function(){t.remove()},300)},2600);
}
function set(id,v){ document.getElementById(id).value = v; }
function val(id){ return document.getElementById(id).value; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]}); }

/* ใช้คู่กันเป็น esc(jsq(s)) เสมอเวลาแทรกค่าลงใน onclick="fn('...')" */
function jsq(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

applyTheme();
SESSION = readSession();
if (SESSION){
  document.body.classList.remove('guest');
  var snap = readSnapshot(SESSION.user);
  if (snap) applyData(snap, true);   /* ของจริงจาก boot() จะมาทับ */
  boot();
}else{
  showLogin();
}
