/* MC: airplane = operations, hangars = client missions. Read-only. */
(function(){
var COORD={TEB:[40.8501,-74.0608],FLL:[26.0726,-80.1527],HPN:[41.0670,-73.7076],MMU:[40.7993,-74.4149],
SAN:[32.7336,-117.1897],CLD:[33.1283,-117.2800],SNA:[33.6757,-117.8682],LAX:[33.9425,-118.4081],
VNY:[34.2098,-118.4899],PBI:[26.6832,-80.0956],BCT:[26.3785,-80.1077],FXE:[26.1973,-80.1707],
MIA:[25.7932,-80.2906],EWR:[40.6925,-74.1687],JFK:[40.6398,-73.7789],LGA:[40.7772,-73.8726]};
var ACTIVE=['planned','submitted','received','accepted','preparing','ready','dispatched','blocked','delay_requested'];
var MC=window.MC={page:0,per:8,ready:false,err:'',cache:{},wx:{}};
function s(x){return String(x==null?'':x)}
function q(k){return MC.cache[k]||[]}
function esc2(v){return s(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function tone(c){return c==='red'?'#ff4d5e':c==='orange'?'#ffb020':c==='green'?'#2ee6a6':'#8fa3c7'}
function when(v){if(!v)return '';var d=new Date(v);if(isNaN(d.getTime()))return s(v);return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function hoursTo(v){if(!v)return null;return Math.round((new Date(v)-new Date())/3600000)}
function client(){try{return (window.LIVE&&LIVE.sb)?LIVE.sb.schema('mission_control'):null}catch(e){return null}}
MC.load=function(){
  var c=client(); if(!c){MC.err='no client';return Promise.resolve(false)}
  function g(t){return c.from(t).select('*').limit(500).then(function(r){return r.error?[]:(r.data||[])},function(){return []})}
  return Promise.all([g('missions'),g('mission_readiness'),g('incidents'),g('orders'),g('vendors'),g('crew'),g('mission_assignments'),g('open_items'),g('airports'),g('passenger_profiles'),g('passenger_needs')])
  .then(function(r){
    var k=['missions','readiness','incidents','orders','vendors','crew','assignments','open_items','airports','passengers','needs'];
    k.forEach(function(n,i){MC.cache[n]=r[i]||[]});
    MC.ready=true;MC.err='';MC.wxLoad();MC.updateScene();if(MC.open)MC.rerender();MC.hash();return true;
  }).catch(function(e){MC.err=e.message||'load failed';return false});
};
function missionsActive(){return q('missions').filter(function(m){return ACTIVE.indexOf(s(m.status).toLowerCase())>-1})}
function readiness(id){return q('readiness').filter(function(r){return String(r.mission_id)===String(id)})[0]||null}
function vendorsMap(){var m={};q('vendors').forEach(function(v){m[String(v.id)]=v});return m}
function airMap(){var m={};q('airports').forEach(function(a){m[s(a.code)]=a});return m}
MC.wxLoad=function(){
  var codes=[];missionsActive().forEach(function(m){[m.origin,m.destination].forEach(function(c){if(c&&codes.indexOf(c)<0)codes.push(c)})});
  codes=codes.filter(function(c){return COORD[c]&&!MC.wx[c]}).slice(0,10);
  codes.forEach(function(c){var p=COORD[c];
    fetch('https://api.open-meteo.com/v1/forecast?latitude='+p[0]+'&longitude='+p[1]+'&current=temperature_2m,weather_code')
    .then(function(r){return r.json()}).then(function(j){var cu=j&&j.current;if(!cu)return;MC.wx[c]={t:Math.round(cu.temperature_2m),label:wxLabel(cu.weather_code)};if(MC.open)MC.rerender()}).catch(function(){});
  });
};
function wxLabel(c){c=+c;if(c===0)return 'CLEAR';if(c<=2)return 'MOSTLY CLEAR';if(c===3)return 'OVERCAST';if(c>=45&&c<=48)return 'FOG';if(c>=51&&c<=57)return 'DRIZZLE';if(c>=61&&c<=67)return 'RAIN';if(c>=71&&c<=77)return 'SNOW';if(c>=80&&c<=82)return 'SHOWERS';if(c>=95)return 'STORMS';return 'MIXED'}
function wx(c){var w=MC.wx[c];return w?(w.label+' / '+w.t+'\u00B0C'):(c?'weather loading':'no airport code')}
function clip(t,n){t=s(t);return t.length>n?t.slice(0,n-1)+'\u2026':t}
function shortName(m){return s(m.label).replace(/\s*\(EXAMPLE[^)]*\)/i,'').replace(/\s*\(not a real mission[^)]*\)/i,'').trim()||('MISSION '+m.id)}
function colOf(m){var rd=readiness(m.id)||{};if(rd.color)return rd.color;var st=s(m.status).toLowerCase();if(st==='blocked')return 'red';if(st==='planned'||st==='submitted')return 'orange';return 'green'}
function statusWord(rd,m){var c=rd.color||'';if(c==='red')return 'blocked';if(c==='orange')return 'attention';if(c==='green')return 'ready';return s(m.status)||'planned'}
MC.hangars=function(a,g){
  var BR=window.BR||[];
  if(!BR.length)return;
  var list=missionsActive(),signed=MC.signed();
  for(var i=0;i<8;i++){
    var b=BR[i],mis=list[MC.page*8+i]||null;
    var n=document.createElementNS('http://www.w3.org/2000/svg','g');
    n.setAttribute('class','nd '+(mis?'s-'+colOf(mis):'s-off'));
    n.setAttribute('tabindex','0');n.setAttribute('role','button');
    var r=document.createElementNS('http://www.w3.org/2000/svg','rect');
    r.setAttribute('class','hs');r.setAttribute('x',b[0]);r.setAttribute('y',b[1]);
    r.setAttribute('width',b[2]);r.setAttribute('height',b[3]);r.setAttribute('rx',6);
    n.appendChild(r);
    var lines=mis?[{t:shortName(mis),c:'#e8f0ff',z:10.5,w:'600'},
                   {t:(s(mis.origin)||'?')+' \u2192 '+(s(mis.destination)||'?'),c:'#cfdcff',z:8.6},
                   {t:statusWord(readiness(mis.id)||{},mis).toUpperCase(),c:tone(colOf(mis)),z:8.2,w:'700'}]
                 :(signed?[{t:'BAY OPEN',c:'#8fa3c7',z:9.5,w:'600'},{t:'AVAILABLE',c:'#5f7396',z:7.6}]
                         :[{t:'BAY',c:'#8fa3c7',z:9.5,w:'600'},{t:'SIGN IN TO LOAD',c:'#5f7396',z:7.6}]);
    lines.forEach(function(L,k){
      var t=document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x',b[0]+11);t.setAttribute('y',b[1]+22+k*15);
      t.setAttribute('style','font-size:'+L.z+'px;fill:'+L.c+';font-weight:'+(L.w||'400'));
      t.textContent=clip(L.t,b[2]>125?17:14);
      n.appendChild(t);
    });
    n.onclick=(function(m){return function(){if(m)MC.openMission(m.id);else MC.openOps()}})(mis);
    a.appendChild(n);
    if(g&&g.nodes)g.nodes.push({g:n,n:mis?shortName(mis):'Bay open',s:mis?colOf(mis):'off'});
  }
  MC.decorate(a,list);
};
MC.decorate=function(a,list){
  if(!a||!a.querySelectorAll)return;
  var openInc=q('incidents').filter(function(i){return s(i.status).toLowerCase()!=='resolved'}).length;
  var red=list.filter(function(m){return colOf(m)==='red'}).length;
  var orange=list.filter(function(m){return colOf(m)==='orange'}).length;
  var green=list.filter(function(m){return colOf(m)==='green'}).length;
  var texts=a.querySelectorAll('text');
  for(var i=0;i<texts.length;i++){
    var t=texts[i],v=s(t.textContent);
    if(/^MISSION #\d+$/.test(v))t.textContent=list.length+' MISSION'+(list.length===1?'':'S');
    else if(v==='BLOCKED')t.textContent=red?(red+' BLOCKED'):(orange?'ON TRACK':'ON TRACK');
    else if(/^\d+ problems?$/.test(v))t.textContent=openInc+' PROBLEM'+(openInc===1?'':'S');
    else if(/^\d+ to watch$/.test(v))t.textContent=orange+' to watch';
    else if(/^\d+ clear$/.test(v))t.textContent=green+' clear';
    else if(v==='STATUS \u00B7 NOT LOADED'||v==='STATUS \u00B7 NOT LOADED'||v==='LIVE \u00B7 FROM DATABASE')t.textContent=MC.ready?'LIVE \u00B7 FROM DATABASE':'SIGN IN TO LOAD DATA';
  }
};
MC.hash=function(){try{var h=s(location.hash).replace('#','');var v='';var mm=s(location.search).match(/[?&]view=([a-z0-9]+)/i);if(mm)v=mm[1];if(h==='ops'||v==='ops')MC.openOps();else if(/^m\d+$/.test(h))MC.openMission(h.slice(1));else if(/^m\d+$/.test(v))MC.openMission(v.slice(1));}catch(e){document.title='hash err '+e.message}};
window.addEventListener('hashchange',function(){if(MC.ready)MC.hash()});
MC.updateScene=function(){try{if(typeof build==='function'&&typeof path!=='undefined'&&path.length&&path[path.length-1][0]==='abc')refresh()}catch(e){}};
function sheet(){
  var d=document.getElementById('sheet');
  if(d)return d;
  d=document.createElement('div');d.id='sheet';
  d.innerHTML='<div class="sh"><div class="shh"><div class="sht" id="sht"></div><button id="shx">CLOSE \u00D7</button></div><div class="shb" id="shb"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click',function(e){if(e.target===d)MC.close()});
  d.querySelector('#shx').onclick=function(){MC.close()};
  return d;
}
MC.close=function(){MC.open=null;var d=document.getElementById('sheet');if(d)d.classList.remove('on')};
MC.head=function(t,sub){var d=sheet();d.querySelector('#sht').innerHTML='<b>'+esc2(t)+'</b>'+(sub?'<span>'+esc2(sub)+'</span>':'');d.classList.add('on');return d.querySelector('#shb')};
MC.rerender=function(){if(!MC.open)return;if(MC.open.kind==='ops')MC.openOps();else MC.openMission(MC.open.id)};
MC.openOps=function(){
  MC.open={kind:'ops'};
  var list=missionsActive(),per=MC.per,pages=Math.max(1,Math.ceil(list.length/per));
  if(MC.page>=pages)MC.page=0;
  var slice=list.slice(MC.page*per,MC.page*per+per);
  var red=list.filter(function(m){return colOf(m)==='red'}),orange=list.filter(function(m){return colOf(m)==='orange'}),green=list.filter(function(m){return colOf(m)==='green'});
  var body=MC.head('ABC OPERATIONS','Airplane view \u00B7 overall flight hospitality operations');
  var h='<div class="big"><div><b>'+list.length+'</b><span>ACTIVE CLIENT MISSION'+(list.length===1?'':'S')+'</span></div>'
   +'<div><b style="color:#ff4d5e">'+red.length+'</b><span>BLOCKED</span></div>'
   +'<div><b style="color:#ffb020">'+orange.length+'</b><span>NEED ATTENTION</span></div>'
   +'<div><b style="color:#2ee6a6">'+green.length+'</b><span>READY</span></div></div>';
  if(!MC.ready){h+='<div class="note">'+(MC.err?'Operations data did not load ('+esc2(MC.err)+').':'Loading operations data\u2026')+'</div>';body.innerHTML=h;return}
  if(!list.length)h+='<div class="note">No client missions in the system. Empty hangars are open bays, not failures.</div>';
  else{
    h+='<div class="rows"><div class="rh"><span>CLIENT MISSION</span><span>ROUTE \u00B7 LOCAL WEATHER</span><span>READINESS</span><span>NEXT ACTION</span></div>';
    slice.forEach(function(m){
      var rd=readiness(m.id)||{};
      h+='<div class="r" data-m="'+m.id+'"><span class="cn">'+esc2(shortName(m))+'<i>#'+m.id+'</i></span>'
       +'<span class="rt">'+esc2(s(m.origin)||'?')+' \u2192 '+esc2(s(m.destination)||'?')
       +'<i>dep '+(m.departs_at?esc2(when(m.departs_at)):'not scheduled')+'</i><i>'+esc2(wx(m.destination))+'</i></span>'
       +'<span class="rd" style="color:'+tone(colOf(m))+'">'+esc2(statusWord(rd,m).toUpperCase())+'</span>'
       +'<span class="na">'+esc2(rd.next_action||'no next action recorded')+'</span></div>';
    });
    h+='</div>';
    if(list.length>per)h+='<div class="pager"><button id="pv">\u2039 PREV</button><span>SHOWING '+(MC.page*per+1)+'\u2013'+Math.min(list.length,MC.page*per+per)+' OF '+list.length+'</span><button id="nx">NEXT \u203A</button></div>';
  }
  var acts=[];
  list.forEach(function(m){var rd=readiness(m.id)||{};if(rd.next_action)acts.push({m:shortName(m),t:rd.next_action,w:''})});
  q('open_items').forEach(function(it){if(it.what&&acts.length<14)acts.push({m:it.mission_id?('#'+it.mission_id):'COMPANY',t:it.what,w:s(it.responsible)})});
  if(acts.length){h+='<h4>NEXT ACTIONS</h4><ul class="acts">';acts.slice(0,12).forEach(function(x){h+='<li><b>'+esc2(x.m)+'</b> '+esc2(x.t)+(x.w?' <i>'+esc2(x.w)+'</i>':'')+'</li>'});h+='</ul>'}
  body.innerHTML=h;
  var pv=body.querySelector('#pv'),nx=body.querySelector('#nx');
  if(pv)pv.onclick=function(){MC.page=Math.max(0,MC.page-1);MC.openOps();MC.updateScene()};
  if(nx)nx.onclick=function(){MC.page++;MC.openOps();MC.updateScene()};
  [].forEach.call(body.querySelectorAll('.r[data-m]'),function(el){el.onclick=function(){MC.openMission(el.getAttribute('data-m'))}});
};
MC.openMission=function(id){
  MC.open={kind:'mission',id:id};
  var m=q('missions').filter(function(x){return String(x.id)===String(id)})[0];
  if(!m){MC.head('CLIENT HANGAR','mission '+id);document.getElementById('shb').innerHTML='<div class="note">Mission '+esc2(id)+' is not in the operations database.</div>';return}
  var rd=readiness(m.id)||{},ap=airMap(),vm=vendorsMap();
  var ords=q('orders').filter(function(o){return String(o.mission_id)===String(m.id)});
  var incs=q('incidents').filter(function(i){return String(i.mission_id)===String(m.id)});
  var asg=q('assignments').filter(function(x){return String(x.mission_id)===String(m.id)});
  var needs=q('needs').filter(function(x){return String(x.mission_id)===String(m.id)});
  var prof=q('passengers').filter(function(x){return String(x.id)===String(m.passenger_id)});
  var body=MC.head(shortName(m),'Client hangar \u00B7 mission #'+m.id+' \u00B7 '+statusWord(rd,m).toUpperCase());
  function block(title,rows){
    var h='<section><h4>'+title+'</h4>';
    if(!rows||!rows.length){h+='<div class="none">Not recorded yet.</div></section>';return h}
    h+='<div class="kv">';
    rows.forEach(function(r){h+='<div><em>'+esc2(r[0])+'</em><span>'+(r[2]?'<b style="color:'+r[2]+'">':'')+esc2(r[1])+(r[2]?'</b>':'')+'</span></div>'});
    return h+'</div></section>';
  }
  var h='<div class="strip"><span style="color:'+tone(colOf(m))+'">'+esc2(statusWord(rd,m).toUpperCase())+'</span><span>'+esc2(s(m.origin)||'?')+' \u2192 '+esc2(s(m.destination)||'?')+'</span><span>'+esc2(wx(m.destination))+'</span></div>';
  var cl=[['Mission',shortName(m)+'  #'+m.id]];
  if(m.passenger_id)cl.push(['Passenger ref',s(m.passenger_id)]);
  prof.forEach(function(p){cl.push(['Passenger',s(p.full_name||p.name||p.display_name||p.id)])});
  if(s(m.notes))cl.push(['Notes',s(m.notes)]);
  h+=block('CLIENT &amp; PASSENGERS',cl);
  h+=block('ITINERARY \u00B7 OPERATOR \u00B7 AIRCRAFT \u00B7 FBO',[
    ['Origin',(s(m.origin)||'not set')+(ap[s(m.origin)]?' \u00B7 '+ap[s(m.origin)].name:'')],
    ['Destination',(s(m.destination)||'not set')+(ap[s(m.destination)]?' \u00B7 '+ap[s(m.destination)].name:'')],
    ['Departs',m.departs_at?when(m.departs_at):'not scheduled'],
    ['Arrives',m.arrives_at?when(m.arrives_at):'not scheduled'],
    ['Operator confirmed',m.operator_confirmed?'YES':'NO \u2014 operator not confirmed',m.operator_confirmed?'#2ee6a6':'#ff4d5e'],
    ['Aircraft / tail',asg.length?(asg.map(function(x){return s(x.tail||x.aircraft_tail||x.registration)}).filter(Boolean).join(', ')||'assigned, tail not recorded'):'not recorded'],
    ['FBO / handling','not recorded in the system yet']]);
  function pick(re){return ords.filter(function(o){return re.test(s(o.service))})}
  function orows(os){return os.map(function(o){var v=vm[String(o.vendor_id)]||{};return ['#'+o.id+' '+s(o.service),s(v.name||('vendor '+o.vendor_id))+' \u00B7 '+s(o.state||'state not set')]})}
  h+=block('GROUND TRANSPORTATION',orows(pick(/ground|transport|limo|driver|sedan|suv/i)));
  h+=block('CATERING',orows(pick(/cater|food|meal|cuisine|beverage|bar\b|wine|champagne/i)));
  var diet=[],alg=[];
  ords.forEach(function(o){if(s(o.dietary_instructions).trim())diet.push(['#'+o.id+' dietary',s(o.dietary_instructions)]);if(s(o.allergy_instructions).trim())alg.push(['#'+o.id+' ALLERGY',s(o.allergy_instructions),'#ff4d5e'])});
  h+=block('DIETARY REQUIREMENTS &amp; PRECAUTIONS',alg.concat(diet));
  h+=block('VENDORS \u00B7 CONFIRMATIONS \u00B7 OUTSTANDING ACKNOWLEDGMENTS',ords.map(function(o){
    var v=vm[String(o.vendor_id)]||{};
    var late=o.ack_due_at&&hoursTo(o.ack_due_at)<0&&s(o.state)!=='confirmed';
    return ['#'+o.id+' '+s(o.service),s(v.name||('vendor '+o.vendor_id))+' \u00B7 '+s(o.state||'not set')+(o.written_confirmation?' \u00B7 written confirmation on file':' \u00B7 NO written confirmation')+(o.ack_due_at?' \u00B7 ack due '+when(o.ack_due_at):'')+(late?' \u00B7 OVERDUE':''),s(o.state)==='confirmed'?'#2ee6a6':late?'#ff4d5e':null];
  }));
  h+=block('ASSIGNED CREW &amp; STAFF',asg.map(function(x){
    var c=q('crew').filter(function(k){return String(k.id)===String(x.crew_id)})[0]||{};
    return [s(c.crew_role||'crew').replace(/_/g,' '),s(c.name||x.name||('crew '+x.crew_id))+' \u00B7 '+s(x.status||x.role||'assigned')];
  }));
  h+=block('PASSENGER PREFERENCES',needs.map(function(n){return [s(n.kind||n.category||'preference'),s(n.detail||n.need||n.notes||'')]}));
  h+=block('READINESS',[['State',statusWord(rd,m).toUpperCase(),tone(colOf(m))],['Next action',s(rd.next_action)||'none recorded'],['Failed orders',s(rd.failed_orders)||'0'],['Open orders',s(rd.open_orders)||'0'],['Overdue acknowledgments',s(rd.overdue_acks)||'0'],['Confirmed in writing',s(rd.verified_green_orders)||'0'],['Crew assigned',s(rd.assignments)||'0'],['Blocking problems',s(rd.blocking_incidents)||'0']]);
  h+=block('PROBLEMS',incs.map(function(i){return ['#'+i.id+' '+s(i.title||i.what_happened||'problem'),s(i.status||'')+' \u00B7 '+s(i.severity||'')+' \u00B7 needs '+s(i.required_action||i.follow_up||'action not recorded'),s(i.status)==='resolved'?'#2ee6a6':'#ff4d5e']}));
  body.innerHTML=h;
};
MC.signed=function(){try{if(window.LIVE&&LIVE.on)return true;if(typeof preSession==='function')return !!preSession()}catch(e){}return false};
function bootMC(){
  var t=0;(function go(){t++;if(window.LIVE&&LIVE.sb&&MC.signed()){MC.load();return}if(t<90)setTimeout(go,1000)})();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootMC);else bootMC();
window.addEventListener('keydown',function(e){if(e.key==='Escape'&&MC.open)MC.close()});
})();
