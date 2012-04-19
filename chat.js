//========================变量定义===============================
/**
 * modules引入
 */
var express = require('express'),
	sio = require('socket.io'),
	fs=require('fs'),
	path = require('path')
	url = require('url'),
	parseCookie = require('connect').utils.parseCookie,
	MemoryStore = require('connect/lib/middleware/session/memory');

/**
 * 私人聊天使用session
 */
var usersWS = {}, //私人聊天用的websocket
	storeMemory = new MemoryStore({
		reapInterval: 60000 * 10
	});//session store
//=========================app配置=============================	
/**
 * app配置
 */
var app = module.export = express.createServer();
var mysql = require('./lib/db');
var db = new mysql.create();
app.configure(function(){
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({
		secret: 'ccc',
		store:storeMemory,
		cookie:{path:'/', httpOnly:true}

	}));
	app.use(express.methodOverride());
	app.use(app.router);//要放在bodyParser之后，处理post
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.static(__dirname + '/public'));
});
//=================配置socket.io=========================
/**
 * 配置socket.io
 * 
 */	
var io = sio.listen(app);
//io.set('log',false);
//设置session
io.set('authorization', function(handshakeData, callback){
	// 通过客户端的cookie字符串来获取其session数据
	handshakeData.cookie = parseCookie(handshakeData.headers.cookie);
	var connect_sid = handshakeData.cookie['connect.sid'];
	if (connect_sid) {
		storeMemory.get(connect_sid, function(error, session){
			if (error) {
				// if we cannot grab a session, turn down the connection
				callback(error.message, false);
			}
			else {
				// save the session data and accept the connection
				handshakeData.session = session;
				callback(null, true);
			}
		});
	}
	else {
		callback('nosession');
	}
});
//=========================URL=============================
/**
 * url处理开始鸟~
 * @param {Object} req
 * @param {Object} res
 */
app.get('/',function(req,res){
	if(req.query.u){
		var uid = req.query.u;
		var	user = db.query("select * from i_user where `id` =" + uid,function(err, data, field){
			if(err){
				res.redirect('/');
			}else{
			console.info(data);
				if(data[0]){
					var current_u = data[0];
					req.session.is_login = current_u.is_login;
					req.session.name = current_u.uname;
					req.session.rname = current_u.rname;
					res.redirect('/chat');
				}else{
					req.session.is_login = false;
					req.session.name = false;
					res.redirect('/');
				}
			}
		});
	}else{
		req.session.is_login = false;
		var realpath = __dirname + '/views/' + url.parse('login.html').pathname;
		var txt = fs.readFileSync(realpath);
		res.end(txt);
	}
});
app.get('/chat',function(req,res){
	if (req.session.is_login) {
		//需要判断下是否已经登录
		res.render('chat',{name:req.session.name});
	}else{
		res.redirect('/');
	}
})
app.post('/chat',function(req,res){
	var name = req.body.nick;
	if(name && name!==''){
		req.session.name = name;//设置session
		req.session.is_login = true;
		res.render('chat',{name:name});
	}else{
		req.session.is_log = false;
		res.end('nickname cannot null');
	}
	
});
/*
//其他内容监听，在router.json里面配置，例如help等页面
var routes=JSON.parse(fs.readFileSync('router.json','utf8'));
for(var r in routes){
	app.get(r,function(tmp){
		return function(req,res){
			var template = tmp.template,
				data = tmp.data,
				render = tmp.render;
			var realpath = __dirname + '/views/' + url.parse(template).pathname;
			if(path.existsSync(realpath)){
				var txt = fs.readFileSync(realpath);
			}else{
				
				res.end('404'+realpath);
				return;
			}
			
			if(render){
				res.render(txt,data);
			}else{
				res.end(txt);
			}
		}
	}(routes[r]));
}
*/
//===================socket链接监听=================
/**
 * 开始socket链接监听
 * @param {Object} socket
 */
io.sockets.on('connection', function (socket){
	var session = socket.handshake.session;//session
	if(session && session.is_login && session.name){
		var name = session.name;
		usersWS[name] = socket;
	}else{
	
	}
		var refresh_online = function(){
			var n = [];
			for (var i in usersWS){
				n.push(i);
			}
			io.sockets.emit('online list', n);//所有人广播
		}
		refresh_online();
	
		socket.broadcast.emit('system message', '【'+name + '】回来了，大家赶紧去找TA聊聊~~');
	
	//公共信息
	socket.on('public message',function(msg, fn){
		socket.broadcast.emit('public message', name, msg);
		fn(true);
	});
	//私人@信息
	socket.on('private message',function(to, msg, fn){
		var target = usersWS[to];
		if (target) {
			fn(true);
			target.emit('private message', name+'[私信]', msg);
		}
		else {
			fn(false)
			socket.emit('message error', to, msg);
		}
	});
	
	
	//掉线，断开链接处理
	socket.on('disconnect', function(){
		delete usersWS[name];
		session = null;
		socket.broadcast.emit('system message', '【'+name + '】无声无息地离开了。。。');
		refresh_online();
	});
	var robots = {};

	db.query("select `key`,`value` from i_options where `group` = 'liaotian'", function(err, data, field){
	console.info(data);
		if(!err){
			for(var i=0; i<data.length; i++){
				if(data[i].key == 'robot_people'){
					robots['people'] = data[i].value.split(' ');
				}else if(data[i].key == 'robot_speed'){
					robots['speed'] = data[i].value;
				}else if(data[i].key == 'robot_content'){
					var temp_content = data[i].value.split('\n');
					var j =Math.round(temp_content.length * Math.random());
					robots['content'] = temp_content;
				}
			}
			for(var i in robots.people){
				usersWS[robots.people[i]] = robots.people[i];
			}
			setInterval(function(){
				var robot_name = robots.people[Math.round(robots.people.length * Math.random())]; 
				var robot_content = robots.content[Math.round(robots.content.length * Math.random())];
				if(robot_name && robot_content){ 
					socket.broadcast.emit('public message', robot_name,robot_content);
				}
			}, robots.speed);
		}
	});
});

//===========app listen 开始鸟~==========
app.listen(3009, function(){
	var addr = app.address();
	console.info('listen on ' + addr.arrress + ':' + addr.port);
});

