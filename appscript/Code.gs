/* ============================================================
   ระบบสต๊อกสินค้า — ฝั่งเซิร์ฟเวอร์ (Google Apps Script)

   POST {action:'login'}                             เข้าสู่ระบบ (= โหลดข้อมูลรอบแรก)
   POST {action:'bootstrap'}                         โหลดข้อมูล
   POST {action:'save',   product:{...}}             เพิ่ม / แก้ไขสินค้า (แอดมิน)
   POST {action:'delete', sku:'...'}                 ลบสินค้า (แอดมิน)
   POST {action:'move',   movement:{...}}            รับเข้า / เบิกออก / ปรับยอด
     → { status, user, products, movements, movesTotal }

   POST {action:'passwd', oldPassword, newPassword}  เปลี่ยนรหัสผ่านตัวเอง
     → { status }   ไม่ได้ทำให้ข้อมูลบนหน้าจอเปลี่ยน จึงไม่ต้องส่งกลับทั้งชุด

   ทุกคำสั่งแนบ username/password มาด้วย ฝั่งนี้ตรวจกับชีต Users ใหม่ทุกครั้ง ไม่จำสถานะ
   และแนบ limit บอกจำนวนแถวประวัติที่ต้องการ (ไม่ใส่ = 200)

   ตอบ HTTP 200 เสมอ ผลลัพธ์ดูที่ status ในเนื้อหา
   เพราะถ้าตอบ 4xx/5xx เบราว์เซอร์จะอ่านข้อความผิดพลาดข้ามโดเมนไม่ได้

   เพิ่ม/แก้/ลบผู้ใช้ทำในชีต Users โดยตรง ไม่มีคำสั่งฝั่งนี้ให้เรียก

   ติดตั้งครั้งแรก: กดปุ่ม Run ได้เลย ช่องเลือกฟังก์ชันจะขึ้น initAllsheet ให้เอง
   ============================================================ */

/* Google Sheets ID — เชื่อมต่อกับสเปรดชีตที่กำหนด */
var SHEET_ID = '1BR5tNVgFYYXEzDCWO17RBaykl_ARXTf_ODu3ayl9ZnY';

var PRODUCT_SHEET = 'Products';
var MOVE_SHEET    = 'Movements';
var USER_SHEET    = 'Users';

/* คอลัมน์ของแต่ละชีต เขียนเป็นคู่ [คีย์ในโค้ด, หัวคอลัมน์ที่เห็นในชีต]
   อ่าน/เขียนยึดหัวคอลัมน์ ไม่ใช่ตำแหน่ง จะสลับลำดับหรือแทรกคอลัมน์เองก็ได้
   แต่ถ้าแก้คำแปลหลังเริ่มใช้งานแล้ว ต้องไปแก้หัวคอลัมน์ในชีตให้ตรงกันด้วย
   ไม่งั้นระบบจะสร้างคอลัมน์ใหม่ต่อท้าย แล้วข้อมูลเดิมจะค้างอยู่คอลัมน์เก่า */
var PRODUCT_FIELDS = [
  ['sku',     'รหัสสินค้า'],
  ['name',    'ชื่อสินค้า'],
  ['unit',    'หน่วยนับ'],
  ['qty',     'จำนวน'],
  ['price',   'ราคา'],
  ['updated', 'แก้ไขล่าสุด']
];

var MOVE_FIELDS = [
  ['date',    'วันที่'],
  ['sku',     'รหัสสินค้า'],
  ['name',    'ชื่อสินค้า'],
  ['type',    'ประเภท'],
  ['qty',     'จำนวน'],
  ['balance', 'คงเหลือ'],
  ['note',    'หมายเหตุ'],
  ['user',    'ผู้ทำรายการ']
];

var USER_FIELDS = [
  ['username', 'ชื่อผู้ใช้'],
  ['name',     'ชื่อที่แสดง'],
  ['role',     'สิทธิ์'],
  ['password', 'รหัสผ่าน'],
  ['created',  'สร้างเมื่อ']
];

/* ประวัติมีแต่โตขึ้น อ่านทั้งชีตจะช้าลงทุกวัน จึงอ่านเฉพาะแถวท้าย ๆ ตามที่หน้าเว็บขอมา */
var MOVE_LIMIT_MAX     = 1000;
var MOVE_LIMIT_DEFAULT = 200;

/* รหัสผ่านเก็บเป็นข้อความจริงในชีต ใครเปิดชีตได้ = เห็นรหัสผ่านทุกคน ต้องคุมสิทธิ์แชร์ให้ดี */
var MIN_PASSWORD = 8;

/* สร้างให้อัตโนมัติเมื่อชีต Users ยังว่าง — เข้าครั้งแรกแล้วรีบเปลี่ยนรหัสผ่าน */
var DEFAULT_ADMIN = { username: 'admin', name: 'ผู้ดูแลระบบ', password: '123456' };


/* ── ติดตั้งครั้งแรก — กด Run ที่ฟังก์ชันนี้หนึ่งครั้งก่อน deploy ──────
   ต้องเป็นฟังก์ชันแรกของไฟล์ ช่องเลือกฟังก์ชันข้างปุ่ม Run จะได้เลือกให้เอง
   ชีตที่มีอยู่แล้วจะไม่ถูกแตะ กดซ้ำกี่ครั้งก็ได้ */
function initAllsheet() {
  var ss = book_();
  productSheet_(ss);
  moveSheet_(ss);
  userSheet_(ss);
  seedAdmin_(ss);
  return 'สร้างชีต ' + PRODUCT_SHEET + ' / ' + MOVE_SHEET + ' / ' + USER_SHEET +
         ' เรียบร้อย — เข้าระบบด้วย ' + DEFAULT_ADMIN.username +
         ' / ' + DEFAULT_ADMIN.password + ' แล้วรีบเปลี่ยนรหัสผ่าน';
}


/* ── ทางเข้า: เปิด URL นี้ตรง ๆ ในเบราว์เซอร์ ──────────────────
   ไม่รับคำสั่ง เหลือไว้แค่ตอบให้รู้ว่า deploy ถูกและสคริปต์ทำงานอยู่ */
function doGet() {
  return json({ status: 'ok', message: 'ระบบสต๊อกสินค้าพร้อมใช้งาน — ให้เรียกใช้ผ่านหน้าเว็บ' });
}

/* ── ทางเข้า: ทุกคำสั่ง ─────────────────────────────────────── */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return fail('ไม่มีข้อมูลที่ส่งมา');
    var data = JSON.parse(e.postData.contents);

    /* อ่านอย่างเดียว ไม่ต้องเข้าคิวรอคนที่กำลังบันทึกอยู่ให้เสร็จก่อน */
    if (data.action === 'bootstrap') {
      return json(bootstrap_(data.limit, auth_(data.username, data.password)));
    }

    /* กันสองคนกดบันทึกพร้อมกันแล้วยอดสต๊อกเพี้ยน หรือได้รหัสสินค้าซ้ำ */
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(15000);
    } catch (busy) {
      return fail('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณาลองใหม่');
    }

    try {
      /* login ต้องอยู่ในคิวเพราะเป็นทางเดียวที่สร้างแอดมินตั้งต้นเมื่อชีต Users ว่าง
         สองคนเข้าพร้อมกันจังหวะนั้นจะได้แถวแอดมินซ้ำสองแถว */
      if (data.action === 'login') {
        return json(bootstrap_(data.limit, verify_(seedAdmin_(book_()), data.username, data.password)));
      }

      var user = auth_(data.username, data.password);

      if (data.action === 'passwd') return json(changePassword_(user, data.oldPassword, data.newPassword));

      if (data.action === 'move') {
        recordMovement_(data.movement || {}, user);
        return json(bootstrap_(data.limit, user));
      }

      /* ตั้งแต่ตรงนี้ลงไปเป็นงานของแอดมินเท่านั้น */
      requireAdmin_(user);
      if (data.action === 'save')   { saveProduct_(data.product || {}); return json(bootstrap_(data.limit, user)); }
      if (data.action === 'delete') { deleteProduct_(data.sku);         return json(bootstrap_(data.limit, user)); }
      return fail('ไม่รู้จักคำสั่ง ' + data.action);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return fail(err);
  }
}


/* ── งานหลัก ───────────────────────────────────────────────── */

function bootstrap_(limit, user) {
  var ss = book_();
  return {
    status:    'ok',
    user:      { username: user.username, name: user.name, role: user.role },
    products:  readProducts_(ss).map(clean_),
    movements: readMovements_(ss, limit),
    /* movements ถูกตัดมาแค่แถวท้าย ๆ หน้าเว็บจะได้บอกว่า "แสดง 200 จาก 1,438 รายการ" */
    movesTotal: Math.max(moveSheet_(ss).getLastRow() - 1, 0)
  };
}

function saveProduct_(p) {
  var ss    = book_();
  var sheet = productSheet_(ss);
  var col   = productCols_(ss);
  var list  = readProducts_(ss);

  var sku = text_(p.sku);
  var key = text_(p.originalSku);   /* มีค่า = มาจากหน้าแก้ไข, ว่าง = เพิ่มใหม่ */

  if (!sku)             throw new Error('กรุณากรอกรหัสสินค้า');
  if (!text_(p.name))   throw new Error('กรุณากรอกชื่อสินค้า');
  if (num_(p.price) < 0) throw new Error('ราคาต้องไม่ติดลบ');
  if (num_(p.qty) < 0)   throw new Error('จำนวนต้องไม่ติดลบ');

  /* ยึด originalSku ไม่ใช่ดูว่ารหัสนี้มีในชีตหรือยัง ไม่งั้นเพิ่มใหม่ด้วยรหัสซ้ำ
     จะกลายเป็นการเขียนทับสินค้าเดิมเงียบ ๆ */
  var found = key ? find_(list, key) : null;
  if (key && !found) throw new Error('ไม่พบสินค้ารหัส ' + key);

  var clash = find_(list, sku);
  if (clash && clash !== found) throw new Error('มีรหัสสินค้า ' + sku + ' อยู่แล้ว');

  var item = {
    sku:     sku,
    name:    text_(p.name),
    unit:    text_(p.unit) || 'ชิ้น',
    /* แก้ไขสินค้าเดิมไม่แตะยอด — ยอดต้องเดินผ่านหน้าปรับสต๊อก ประวัติจะได้ไม่ขาดตอน */
    qty:     found ? found.qty : num_(p.qty),
    price:   num_(p.price),
    updated: stamp_()
  };

  if (found) {
    writeRow_(sheet, col, found._row, item);
  } else {
    appendRow_(sheet, col, item);
  }

  return { status: 'ok', product: item };
}

/* ลบสินค้า — ประวัติการเคลื่อนไหวเดิมยังอยู่ในชีต Movements */
function deleteProduct_(sku) {
  var ss    = book_();
  var found = find_(readProducts_(ss), text_(sku));
  if (!found) throw new Error('ไม่พบสินค้ารหัส ' + sku);

  productSheet_(ss).deleteRow(found._row);
  return { status: 'ok' };
}

/* รับเข้า / เบิกออก / ปรับยอด — อัปเดตยอดในชีต Products แล้วต่อท้ายชีต Movements */
function recordMovement_(m, user) {
  var ss    = book_();
  var sheet = productSheet_(ss);
  var col   = productCols_(ss);
  var item  = find_(readProducts_(ss), text_(m.sku));
  if (!item) throw new Error('ไม่พบสินค้ารหัส ' + m.sku);

  /* ช่อง min="0" ในหน้าเว็บไม่ได้อยู่ในฟอร์ม เบราว์เซอร์จึงไม่บังคับให้ — ต้องกันซ้ำตรงนี้
     ไม่งั้นกรอกติดลบใน "ปรับยอด" จะได้สต๊อกติดลบ หรือ "เบิกออก" ติดลบจะกลายเป็นเพิ่มของ */
  var q = num_(m.qty);
  if (q < 0) throw new Error('จำนวนต้องไม่ติดลบ');
  if (m.type !== 'adjust' && q <= 0) throw new Error('กรุณากรอกจำนวนมากกว่า 0');

  var log, label;

  if (m.type === 'in') {
    item.qty += q;  log = q;  label = 'รับเข้า';
  } else if (m.type === 'out') {
    if (q > item.qty) throw new Error('เบิกออกเกินจำนวนที่มี');
    item.qty -= q;  log = -q; label = 'เบิกออก';
  } else {
    log = q - item.qty;  item.qty = q;  label = 'ปรับยอด';   /* ยอดที่นับได้จริงไม่ตรงกับในระบบ */
  }

  item.updated = stamp_();
  writeRow_(sheet, col, item._row, item);

  var moves = moveSheet_(ss);
  appendRow_(moves, moveCols_(ss), {
    date: stamp_(), sku: item.sku, name: item.name, type: label,
    qty: log, balance: item.qty, note: text_(m.note), user: user.username
  });

  return { status: 'ok', product: clean_(item) };
}


/* ── เข้าสู่ระบบ ────────────────────────────────────────────── */

/* คืนแถวผู้ใช้ทั้งแถว (มี _row ติดมาด้วย) คำสั่งที่เรียกต่อจะได้ไม่ต้องอ่านชีตซ้ำ */
function auth_(username, password) {
  return verify_(readUsers_(book_()), username, password);
}

function verify_(list, username, password) {
  var user = findUser_(list, text_(username).toLowerCase());

  /* ไม่มีชื่อผู้ใช้กับรหัสผ่านผิดต้องตอบข้อความเดียวกัน ไม่งั้นคนเดารหัสจะไล่หาชื่อผู้ใช้ที่มีจริงได้ */
  if (!user || !equals_(text_(password), user.password)) {
    throw authFail_('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  return user;
}

/* ตรวจรหัสเดิมซ้ำอีกรอบ กันคนที่มาใช้เครื่องที่เจ้าของเปิดค้างไว้แล้วแอบเปลี่ยนรหัส */
function changePassword_(user, oldPassword, newPassword) {
  if (!equals_(text_(oldPassword), user.password)) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');

  writePassword_(book_(), user, text_(newPassword));
  return { status: 'ok' };
}


/* ── รหัสผ่าน ───────────────────────────────────────────────── */

function writePassword_(ss, user, password) {
  var sheet = userSheet_(ss);
  var col   = userCols_(ss);
  passwordAsText_(sheet, col);
  writeRow_(sheet, col, user._row, { password: requirePassword_(password) });
}

/* ไม่บังคับเป็นข้อความก่อนเขียน ชีตจะแปลงค่าให้เองเงียบ ๆ (0012345 → 12345,
   2026-08-09 → ค่าวันที่) แล้วเจ้าของบัญชีจะเข้าระบบไม่ได้อีกโดยไม่มีอะไรฟ้อง */
function passwordAsText_(sheet, col) {
  var at = col.index.password;
  if (at >= 0) sheet.getRange(1, at + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
}

function requirePassword_(password) {
  var p = text_(password);
  if (p.length < MIN_PASSWORD) throw new Error('รหัสผ่านต้องยาวอย่างน้อย ' + MIN_PASSWORD + ' ตัว');

  /* ขึ้นต้นด้วยอักขระพวกนี้ชีตจะนึกว่าเป็นสูตร แล้วเก็บค่าผิดจนเข้าระบบไม่ได้ */
  if (/^[=+\-@]/.test(p)) throw new Error('รหัสผ่านห้ามขึ้นต้นด้วย = + - หรือ @');
  return p;
}

/* เทียบให้ใช้เวลาเท่ากันทุกกรณี ไม่งั้นเวลาที่ใช้ตอบจะบอกใบ้ว่ารหัสที่เดามาถูกไปกี่ตัวแล้ว */
function equals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function requireAdmin_(user) {
  if (user.role !== 'admin') throw new Error('ต้องใช้สิทธิ์แอดมินสำหรับคำสั่งนี้');
}

/* code:'auth' บอกหน้าเว็บว่าให้เด้งกลับไปหน้าเข้าสู่ระบบ ไม่ใช่แค่ขึ้นข้อความผิดพลาด */
function authFail_(message) {
  var err = new Error(message || 'กรุณาเข้าสู่ระบบ');
  err.code = 'auth';
  return err;
}


/* ── อ่าน / เขียนชีต ────────────────────────────────────────── */

/* จำผลการเปิดชีตและตำแหน่งคอลัมน์ไว้ใช้ซ้ำ เพราะเรียก API สเปรดชีตทีนึงคือคุยกับ Google จริง ๆ
   Apps Script รันใหม่หมดทุกคำขอ ตัวแปรนี้จึงไม่มีทางค้างข้ามคำขอ */
var CACHE_ = { book: null, sheets: {}, cols: {} };

function book_() {
  if (!CACHE_.book) CACHE_.book = openBook_();
  return CACHE_.book;
}

function openBook_() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

/* สร้างชีตพร้อมหัวคอลัมน์ให้ถ้ายังไม่มี */
function tab_(ss, name, fields) {
  if (CACHE_.sheets[name]) return CACHE_.sheets[name];

  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    var labels = fields.map(function (f) { return f[1]; });
    sheet.appendRow(labels);
    sheet.getRange(1, 1, 1, labels.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  CACHE_.sheets[name] = sheet;
  return sheet;
}

function cols_(name, sheet, fields) {
  if (!CACHE_.cols[name]) CACHE_.cols[name] = columns_(sheet, fields);
  return CACHE_.cols[name];
}

function productSheet_(ss) { return tab_(ss, PRODUCT_SHEET, PRODUCT_FIELDS); }
function moveSheet_(ss)    { return tab_(ss, MOVE_SHEET,    MOVE_FIELDS); }
function userSheet_(ss)    { return tab_(ss, USER_SHEET,    USER_FIELDS); }

function productCols_(ss) { return cols_(PRODUCT_SHEET, productSheet_(ss), PRODUCT_FIELDS); }
function moveCols_(ss)    { return cols_(MOVE_SHEET,    moveSheet_(ss),    MOVE_FIELDS); }
function userCols_(ss)    { return cols_(USER_SHEET,    userSheet_(ss),    USER_FIELDS); }

/* จับคู่คีย์กับคอลัมน์ด้วยหัวคอลัมน์ แล้วเติมหัวที่ยังไม่มีต่อท้าย
   ถ้าอ่านตามตำแหน่งตายตัว ชีตที่คนไปแทรกคอลัมน์เองจะทำให้ข้อมูลเลื่อนทั้งแถวเงียบ ๆ
   คืน index = คีย์ -> ตำแหน่งคอลัมน์ (เริ่มจาก 0), width = จำนวนคอลัมน์ที่ต้องอ่าน */
function columns_(sheet, fields) {
  var head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(text_);

  var missing = fields.filter(function (f) { return head.indexOf(f[1]) < 0; })
                      .map(function (f) { return f[1]; });
  if (missing.length) {
    var need = head.length + missing.length;
    if (sheet.getMaxColumns() < need) sheet.insertColumnsAfter(sheet.getMaxColumns(), need - sheet.getMaxColumns());
    sheet.getRange(1, head.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    head = head.concat(missing);
  }

  var index = {};
  fields.forEach(function (f) { index[f[0]] = head.indexOf(f[1]); });
  return { index: index, width: head.length };
}

function readProducts_(ss) {
  var sheet = productSheet_(ss);
  var col   = productCols_(ss);
  if (sheet.getLastRow() < 2) return [];

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, col.width).getValues();

  return rows.map(function (row, i) {
    var obj = { _row: i + 2 };   /* เลขแถวจริงในชีต ใช้ตอนเขียนทับ / ลบ */
    PRODUCT_FIELDS.forEach(function (f) {
      var key = f[0], v = row[col.index[key]];
      obj[key] = (key === 'qty' || key === 'price') ? num_(v)
               : (key === 'updated')                ? when_(v)
               : text_(v);
    });
    return obj;
  }).filter(function (p) { return p.sku !== ''; });   /* ข้ามแถวว่างที่เผลอเว้นไว้ในชีต */
}

function readUsers_(ss) {
  var sheet = userSheet_(ss);
  var col   = userCols_(ss);
  if (sheet.getLastRow() < 2) return [];

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, col.width).getValues();

  return rows.map(function (row, i) {
    var obj = { _row: i + 2 };
    USER_FIELDS.forEach(function (f) {
      var key = f[0], v = row[col.index[key]];
      obj[key] = key === 'created' ? when_(v) : text_(v);
    });
    obj.username = obj.username.toLowerCase();
    return obj;
  }).filter(function (u) { return u.username !== ''; });
}

/* ชีต Users ว่าง = ยังไม่มีใครเข้าระบบได้ จึงสร้างบัญชีตั้งต้นให้
   เผลอลบผู้ใช้หมดก็ได้ทางกลับเข้าระบบด้วยวิธีเดียวกัน */
function seedAdmin_(ss) {
  var list = readUsers_(ss);
  if (list.length) return list;

  var sheet = userSheet_(ss);
  var col   = userCols_(ss);
  passwordAsText_(sheet, col);
  appendRow_(sheet, col, {
    username: DEFAULT_ADMIN.username,
    name:     DEFAULT_ADMIN.name,
    role:     'admin',
    password: DEFAULT_ADMIN.password,
    created:  stamp_()
  });
  return readUsers_(ss);
}

function readMovements_(ss, limit) {
  var sheet = moveSheet_(ss);
  var col   = moveCols_(ss);
  var last  = sheet.getLastRow();
  if (last < 2) return [];   /* มีแต่หัวตาราง = ยังไม่เคยปรับสต๊อก */

  var want  = Math.min(Math.max(Number(limit) || MOVE_LIMIT_DEFAULT, 1), MOVE_LIMIT_MAX);
  var count = Math.min(want, last - 1);
  var rows  = sheet.getRange(last - count + 1, 1, count, col.width).getValues();

  return rows.map(function (row) {
    var obj = {};
    MOVE_FIELDS.forEach(function (f) {
      var key = f[0], v = row[col.index[key]];
      obj[key] = (key === 'qty' || key === 'balance') ? num_(v)
               : (key === 'date')                    ? when_(v)
               : text_(v);
    });
    return obj;
  }).reverse();   /* ใหม่สุดอยู่บน */
}

/* เขียนทับเฉพาะคอลัมน์ที่ระบบดูแล — ค่าที่คนกรอกเพิ่มเองในชีตจะไม่ถูกล้าง */
function writeRow_(sheet, col, row, obj) {
  var range  = sheet.getRange(row, 1, 1, col.width);
  var values = range.getValues()[0];
  fill_(values, col, obj);
  range.setValues([values]);
}

function appendRow_(sheet, col, obj) {
  var values = [];
  for (var i = 0; i < col.width; i++) values.push('');
  fill_(values, col, obj);
  sheet.appendRow(values);
}

/* วางค่าลงตำแหน่งคอลัมน์ตามคีย์ — คีย์ที่ชีตไม่มี (เช่น _row) จะถูกข้าม */
function fill_(values, col, obj) {
  Object.keys(obj).forEach(function (k) {
    var at = col.index[k];
    if (at >= 0 && obj[k] !== undefined) values[at] = obj[k];
  });
}


/* ── ตัวช่วยเล็ก ๆ ──────────────────────────────────────────── */

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

function fail(err) {
  return json({ status: 'error', code: (err && err.code) || '', message: String((err && err.message) || err) });
}

function find_(list, sku) {
  for (var i = 0; i < list.length; i++) if (list[i].sku === sku) return list[i];
  return null;
}

function findUser_(list, username) {
  for (var i = 0; i < list.length; i++) if (list[i].username === username) return list[i];
  return null;
}

/* ตัด _row ออกก่อนส่งกลับหน้าเว็บ — เป็นข้อมูลของฝั่งชีตเท่านั้น */
function clean_(item) {
  var out = {};
  PRODUCT_FIELDS.forEach(function (f) { out[f[0]] = item[f[0]]; });
  return out;
}

/* รูปแบบนี้เรียงวันที่แบบข้อความได้ตรง ๆ */
function stamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

function text_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function num_(v)  { return Number(v) || 0; }

/* ชีตแปลงข้อความหน้าตาเหมือนวันที่เป็นค่า Date เอง ปล่อยผ่าน text_()
   หน้าเว็บจะโชว์ 'Sun Aug 09 2026 10:30:00 GMT+0700 (…)' และเรียงประวัติเพี้ยน */
function when_(v) {
  return v instanceof Date
    ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
    : text_(v);
}
