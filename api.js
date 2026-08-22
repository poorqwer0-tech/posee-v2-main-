
var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby4qLWuKf5kb7jp9HmuLUSX25a7odeMcuRnkDh_KKgYL8lLhkqKmIDRTw_BecCb7OVWkg/exec';

var MOVE_LIMIT = 200;

var MIN_PASSWORD = 8;

function apiPost(payload){
  var body = Object.assign({}, payload);
  body.limit = MOVE_LIMIT;
  if (SESSION && body.action !== 'login'){
    body.username = SESSION.username;
    body.password = SESSION.password;
  }
  return request(fetch(SCRIPT_URL, {
    method: 'POST',
    headers: {'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(body)
  }));
}

function request(p){
  /* fetch ปฏิเสธเป็น TypeError เมื่อยิงไม่ถึงปลายทาง — ปล่อยไว้ผู้ใช้จะเห็นแค่ "Failed to fetch" */
  return track(p.then(readJson, function(e){
    throw (e instanceof TypeError)
      ? new Error('ติดต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่อีกครั้ง')
      : e;
  }));
}

/* นับคำขอที่ค้างอยู่ ไอคอนหมุนจะได้อยู่จนคำขอสุดท้ายจบ ไม่ใช่หายตั้งแต่คำขอแรกเสร็จ */
var pending = 0;
function track(p){
  if(++pending === 1) setSyncing(true);
  var done = function(){ if(--pending === 0) setSyncing(false); };
  return p.then(function(d){ done(); return d; }, function(e){ done(); throw e; });
}

function readJson(res){
  if(!res.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (HTTP '+res.status+')');
  return res.text().then(function(raw){
    var d;
    /* deploy ไม่ถูก (เช่นตั้งสิทธิ์เข้าถึงเฉพาะตัวเอง) Apps Script จะตอบเป็นหน้า HTML แทน JSON */
    try{ d = JSON.parse(raw); }
    catch(e){
      throw new Error('เซิร์ฟเวอร์ไม่ได้ตอบกลับเป็นข้อมูล — ตรวจว่า deploy เป็น Web app ' +
                      'และตั้ง "ผู้ที่มีสิทธิ์เข้าถึง" เป็น ทุกคน (Anyone) แล้วหรือยัง');
    }
    /* เซิร์ฟเวอร์ตอบ 200 เสมอแม้ทำงานไม่สำเร็จ ต้องดูที่ status ในเนื้อหา */
    if(!d || d.status==='error'){
      var err = new Error((d && d.message) || 'เซิร์ฟเวอร์ตอบกลับผิดพลาด');
      if (d && d.code) err.code = d.code;   /* 'auth' = ต้องเข้าสู่ระบบใหม่ */
      throw err;
    }
    return d;
  });
}

var API = {
  login: function(username, password){
    return apiPost({action:'login', username:username, password:password});
  },
  passwd: function(oldPassword, newPassword){
    return apiPost({action:'passwd', oldPassword:oldPassword, newPassword:newPassword});
  },
  bootstrap: function(){
    return apiPost({action:'bootstrap'});
  },
  save: function(p){
    return apiPost({action:'save', product:p});
  },
  del: function(sku){
    return apiPost({action:'delete', sku:sku});
  },
  move: function(m){
    return apiPost({action:'move', movement:m});
  }
};
