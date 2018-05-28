
var name_to_marker = {};//地址名到BMap.Marker的映射
/*
班车编号到详细路线信息的映射
例: {"id":{"time": "07:30", "name": "BH-001", "driver": "何师傅", "phone": "×××××××1266", "number": "粤B00××××", 
"route": [{"full_name": "乐群小学(湖南大碗菜馆门口)(07:30)", "name": "乐群小学"}]}}
*/
var id_to_route = {};
var map = null;//BMap.Map对象，用于绘制地图

/*
上班班车经停点信息，地点名到具体信息的映射
例：{"乐群小学":{"lng":0.0,"lat":0.0,"bus":["BH-001"]}}
*/
var to_work_place_info = {};
var off_work_place_info = {};
var night_work_place_info = {};
var current_place_info = {};

// 在地图上绘制路线
function draw_route(route) {
    let sy = new BMap.Symbol(BMap_Symbol_SHAPE_BACKWARD_OPEN_ARROW, {
        scale: 0.6,//图标缩放大小
        strokeColor:'#fff',//设置矢量图标的线填充颜色
        strokeWeight: '2',//设置线宽
    });
    let icons = new BMap.IconSequence(sy, '10', '30');
    // 创建polyline对象
    let pois = [];
    for(r of route) {
        let name = r['name'];
        if(!(name in current_place_info)) {
            console.warn("找不到："+name);
            continue;
        }
        let p = current_place_info[name];
        let t = new BMap.Point(p.lng, p.lat);
        pois.push(t);
        if(name in name_to_marker) map.addOverlay(name_to_marker[name])
        else map.addOverlay(render_marker(name, t, p.bus));
    }
    map.addOverlay(new BMap.Polyline(pois, {
       enableEditing: false,//是否启用线编辑，默认为false
       enableClicking: true,//是否响应点击事件，默认为true
       icons:[icons],
       strokeWeight:'8',//折线的宽度，以像素为单位
       strokeOpacity: 0.8,//折线的透明度，取值范围0 - 1
       strokeColor:"#18a45b" //折线颜色
    }));
}

//在地图上绘制经停点
function mark_places(places) {
    clear_all_display();
    name_to_marker = {};
    let name_dict = {};
    for(let p of places) {
        if(!(p in name_dict)) {
            name_dict[p] = null;
            if(!(p in current_place_info)) {
                console.warn(`在mark地址时未找到${p}.`);
                continue;
            }
            let t = current_place_info[p];
            let m = render_marker(p, new BMap.Point(t.lng, t.lat), t.bus);
            name_to_marker[p] = m;
            map.addOverlay(m);
        }
    }
}

//在搜索框下面显示路线信息
function show_route_info(route) {
    let mn = $("#search_dropdown");
    let content = `
    <div class="dropdown-menu" aria-labelledby="search_input" id="search_dropdown_menu">
        <div class="dropdown-item no-click-item">
            <ul><li>出发时间: ${route["time"]}</li>
            <li>司机: ${route["driver"]}</li>
            <li>手机号: ${route["phone"]}</li>
            <li>车牌号: ${route["number"]}</li>
            </ul>
        </div>
    </div>`;
    mn.append(content);
    $("#search_dropdown_menu").dropdown('toggle');
}

//清空当前所有显示的对象
function clear_all_display() {
    name_to_marker = {};
    map.clearOverlays();
    let t = $("#search_dropdown_menu");
    if(t !== undefined) t.remove();
}

//在marker选择班车时的回调函数
function select_onchange(node) {
    let val = node.value.trim();
    if(val !== "选择班车") {
        let route = id_to_route[val];
        let node =  $("#search_dropdown_menu");
        if(node !== undefined) node.remove();
        $("#search_input").val(val);
        show_route_info(route);
        draw_route(route["route"]);
    }
}

// 根据地点信息新建一个Marker
function render_marker(name, point, bus) {
    if(name in name_to_marker) return name_to_marker[name];
    let m = new BMap.Marker(point, {title:name});
    let info = `<p>${name}</p>`;
    if(bus.length > 0) {
        info += `<p><span>班车信息: </span><select onchange="select_onchange(this)">
        <option selected>选择班车</option>`;
        for(let i = 0; i < bus.length; i++) {
            info += `<option>${bus[i]}</option>`;
        }
        info += "</select></p>";
    }
    let win = new BMap.InfoWindow(info);
    m.addEventListener("click", ()=>m.openInfoWindow(win));
    name_to_marker[name] = m;
    return m;
}

//搜索附近的班车经停点，默认两公里
function search_nearby_places(point, title, radius=2) {
    let select_id = $("#select_place_type").find(":selected").val();
    let places = to_work_place_info;
    if(select_id == 1)places = to_work_place_info;
    else if(select_id == 2) places = off_work_place_info;
    else places = night_work_place_info;
    current_place_info = places;
    let lng0 = 113.820646, lat0 = 22.629279;//宝安国际机场
    let lng1 = 114.03694, lat1 = 22.61659;//深圳北站
    let dis = 22.2;//相距22.2公里
    let rad = radius*Math.sqrt(Math.pow(lng1-lng0, 2)+Math.pow(lat1-lat0, 2))/dis;
    let nearby_places = [];
    for(let k of Object.keys(places)) {
        let p = places[k];
        let d = Math.sqrt(Math.pow(p.lng-point.lng, 2)+Math.pow(p.lat-point.lat, 2));
        if(d <= rad) {
            let t = {};
            t["name"] = k;
            t["lng"] = p.lng;
            t["lat"] = p.lat;
            t["bus"] = p.bus;
            nearby_places.push(t);
        }
    }
    clear_all_display();
    for(let p of nearby_places) {
        map.addOverlay(render_marker(p.name, new BMap.Point(p.lng, p.lat), p.bus));
    }
    map.addOverlay(new BMap.Marker(point, {title:title}));
    map.centerAndZoom(point, 13);
}

// 检索地址后，点击地址marker的回调函数
function show_search_result(title, point) {
    let t = $("#search_dropdown_menu");
    if(t !== undefined) t.remove();
    let mn = $("#search_dropdown");
    let content = `
    <div class="dropdown-menu" aria-labelledby="search_input" id="search_dropdown_menu">
        <div class="dropdown-item no-click-item">
            ${title}
        </div>
        <div class="dropdown-item no-click-item">
            <select class="custom-select mr-sm-2" id="select_place_type">
                <option selected value="1">上班经停点</option>
                <option value="2">下班经停点</option>
                <option value="3">夜班经停点</option>
            </select>
        </div>
        <div class="dropdown-item no-click-item">
            <button type="button" class="btn btn-primary" id="dropdown_button">搜索</button>
        </div>
    </div>`;
    mn.append(content);
    $("#dropdown_button").click(()=>search_nearby_places(point, title));
    $("#search_dropdown_menu").dropdown('toggle');
}
// 检索地址后设置marker以响应用户操作
function set_markers(result) {
    let overlays = map.getOverlays();
    if(overlays.length <= 0) {
        let e = $("#search_input").val();
        let t = $("#search_dropdown_menu");
        if(t !== undefined) t.remove();
        let mn = $("#search_dropdown");
        let content = `
        <div class="dropdown-menu" aria-labelledby="search_input" id="search_dropdown_menu">
            <div class="dropdown-item no-click-item">
                找不到: ${e}.
            </div>
        </div>`;
        mn.append(content);
        $("#search_dropdown_menu").dropdown('toggle');
    }
    for(let e of overlays) {
        if(e instanceof BMap.Marker)
        {
            e.addEventListener("infowindowopen", (type, target)=>show_search_result(e.getTitle(), e.getPosition()));
        }
    }
}
// 检索框的回调函数
function search() {
    clear_all_display();
    let pat = /\s*\w+-\d+.*/i;
    let e = $("#search_input").val();
    if(e != "") {
        if(pat.test(e) || e.indexOf("新增线路") !== -1 || e.indexOf("腾讯滨海接驳巴士") !== -1) {
            if(!(e in id_to_route)) {
                let t = $("#search_dropdown_menu");
                if(t !== undefined) t.remove();
                let mn = $("#search_dropdown");
                let content = `
                <div class="dropdown-menu" aria-labelledby="search_input" id="search_dropdown_menu">
                    <div class="dropdown-item no-click-item">
                        找不到班车: ${e}.
                    </div>
                </div>`;
                mn.append(content);
                $("#search_dropdown_menu").dropdown('toggle');
            }
            else {
                show_route_info(id_to_route[e]);
                draw_route(id_to_route[e]["route"]);
            }
        }
        else {
            let local = new BMap.LocalSearch(map, {
                renderOptions:{map: map}
            });
            local.setMarkersSetCallback(set_markers);
            local.search(e);
        }
    }
}
// 检查路线是否正常
function check_route(route) {
    let lng0 = 113.820646, lat0 = 22.629279;//宝安国际机场
    let lng1 = 114.03694, lat1 = 22.61659;//深圳北站
    let dis = 22.2;//相距22.2公里
    //相邻两站超过三公里提示异常
    let rad = 10*Math.sqrt(Math.pow(lng1-lng0, 2)+Math.pow(lat1-lat0, 2))/dis;
    let rt = route["route"];
    for(let i = 1; i < rt.length; i++) {
        let prev = name_to_point[rt[i-1]["name"]];
        if(prev === undefined || prev === null) {
            console.warn(`在检查路线时找不到"${rt[i-1]["name"]}".`);
            continue;
        }
        let cur = name_to_point[rt[i]["name"]];
        if(cur === undefined || cur == null) {
            console.warn(`在检查路线时找不到"${rt[i]["name"]}".`);
        }
        if(rad < Math.sqrt(Math.pow(prev["lng"]-cur["lng"], 2)+Math.pow(prev["lat"]-cur["lat"], 2))) {
            console.warn(`${route["name"]}在"${rt[i-1]["name"]}"到"${rt[i]["name"]}"段距离异常.`);
        }
    }
}
function init() {
    for(let e of to_work_routes.concat(off_work_routes, night_work_routes)) {
        if(!(e["name"] in id_to_route)) {
            id_to_route[e["name"]] = e;
        }
        else {
            console.warn(`有重名的班车路线：${e["name"]}.`);
        }
        check_route(e);
    }
    for(let e of  to_work_routes) {
        for(let p of e["route"]) {
            if(!(p["name"] in name_to_point)) {
                console.warn(`在构建上班经停点信息时找不到：${p["name"]}。`);
                continue;
            }
            if(p["name"] in to_work_place_info) {
                to_work_place_info[p["name"]]["bus"].push(e["name"]);
            }
            else {
                let t = {};
                t["lng"] = name_to_point[p["name"]]["lng"];
                t["lat"] = name_to_point[p["name"]]["lat"];
                t["bus"] = [e["name"]];
                to_work_place_info[p["name"]] = t;
            }
        }
    }
    
    for(let e of  off_work_routes) {
        for(let p of e["route"]) {
            if(!(p["name"] in name_to_point)) {
                console.warn(`在构建下班经停点信息时找不到：${p["name"]}。`);
                continue;
            }
            if(p["name"] in off_work_place_info) {
                off_work_place_info[p["name"]]["bus"].push(e["name"]);
            }
            else {
                let t = {};
                t["lng"] = name_to_point[p["name"]]["lng"];
                t["lat"] = name_to_point[p["name"]]["lat"];
                t["bus"] = [e["name"]];
                off_work_place_info[p["name"]] = t;
            }
        }
    }
    
    for(let e of  night_work_routes) {
        for(let p of e["route"]) {
            if(!(p["name"] in name_to_point)) {
                console.warn(`在构建夜班经停点信息时找不到：${p["name"]}。`);
                continue;
            }
            if(p["name"] in night_work_place_info) {
                night_work_place_info[p["name"]]["bus"].push(e["name"]);
            }
            else {
                let t = {};
                t["lng"] = name_to_point[p["name"]]["lng"];
                t["lat"] = name_to_point[p["name"]]["lat"];
                t["bus"] = [e["name"]];
                night_work_place_info[p["name"]] = t;
            }
        }
    }
    current_place_info = to_work_place_info;
}
function main() {
    map = new BMap.Map("mymap");
    // 创建地图实例  
    map.centerAndZoom("深圳市");
    map.setCurrentCity("深圳市");
    map.enableScrollWheelZoom();   //启用滚轮放大缩小，默认禁用
    map.enableContinuousZoom();

    $("#to_work").click(()=>{current_place_info = to_work_place_info;mark_places(to_work_places);});
    $("#off_work").click(()=>{current_place_info = off_work_place_info;mark_places(off_work_places);});
    $("#night_work").click(()=>{current_place_info = night_work_place_info;mark_places(night_work_places);});
    $("#search_button").click(()=>search());
    setTimeout(()=>mark_places(to_work_places), 10);
}
init();
$(document).ready(()=>main());
