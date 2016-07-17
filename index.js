var server = require('http').createServer();
var io = require('socket.io')(server);
var users = {};
var rooms = {};

io.on('connection', function (socket) {
    console.log("用户连接到服务器");
    socket.join("public");
    socket.on('user.online', function (user) {
        user.room = 'public';
        users[user.id] = user;
        io.sockets.emit('user.online', getUsers());
		  });
    socket.on('chat.send', function (chat) {
        var user = users[socket.id.replace("/#", '')];
        socket.to(user.room).emit("chat.newchat", chat);
    });
    socket.on('room.enterTheRoom', function (roomname) {
        if (rooms[roomname]) {
            socket.emit("room.existed");
            return;
        }
         var user = users[socket.id.replace("/#", '')];
        rooms[roomname] = { roomname: roomname, play1: user, play2: null };

        socket.leave(user.room);
        socket.join(roomname);

        user.room = roomname;
        user.status = 2;
        //
        io.sockets.in("public").emit("room.rooms", getRooms());
        //通知自己
        socket.emit("room.hasCreated", rooms[roomname]);
        //通知所有人在线状态
        io.sockets.emit('user.online', getUsers());
    });
    //加入房间
    socket.on("room.join", function (roomname) {
            if (rooms[roomname].play2) {
                socket.emit("room.joinfaild");
                return;
            }
            var user = users[socket.id.replace("/#", '')];
            socket.leave(user.room);
            socket.join(roomname);
            user.status = 2;
            user.room = roomname;

            rooms[roomname].play2 = user;
            //通知自己
            socket.emit("room.joinOK", rooms[roomname]);
            //通知房主
            socket.in(roomname).emit("room.hasCreated", rooms[roomname]);
            //通知所有人在线状态
            io.sockets.emit('user.online', getUsers());
        })
    //开始游戏
    socket.on("game.start",function() {
        var user = users[socket.id.replace("/#", '')];
        var room = rooms[user.room];

        if( room.play1 && room.play2 ){
            //向房主发送游戏开始指令
            socket.emit("game.start",1);
            
            //向玩家2发送游戏开始指令
            socket.in(user.room).emit("game.start",2);

            //修改玩家的状态
            room.play1.status = 3;
            room.play2.status = 3;

            //向所有人广播
            io.sockets.emit("user.online",getUsers());
        }    
})
    //游戏数据交换指令
    socket.on("game.changedata",function(data) {
        var user = users[socket.id.replace("/#",'')];
        socket.in(user.room).emit("game.changedata",data);  
    });
    socket.on('disconnect', function () {
        delete users[socket.id.replace("/#", '')];
        io.sockets.emit('user.online', getUsers());
        console.log("用户离开服务器");
    });
});
function getUsers() {
    var arr = [];
    for (var key in users) {
        arr.push(users[key]);
    }
    return arr;
}
function getRooms() {
    var arr = [];
    for (var key in rooms) {
        arr.push(rooms[key]);
    }
    return arr;
}
server.listen(3000)
console.log("开启服务器！");
