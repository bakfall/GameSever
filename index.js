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
        //广播房间信息
        io.sockets.in("public").emit("room.rooms", getRooms());
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
        //广播房间信息
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
    socket.on("game.start", function () {
        var user = users[socket.id.replace("/#", '')];
        var room = rooms[user.room];

        if (room.play1 && room.play2) {
            //向房主发送游戏开始指令
            socket.emit("game.start", 1);

            //向玩家2发送游戏开始指令
            socket.in(user.room).emit("game.start", 2);

            //修改玩家的状态
            room.play1.status = 3;
            room.play2.status = 3;

            //向所有人广播
            io.sockets.emit("user.online", getUsers());
        }
    })
    //游戏数据交换指令
    socket.on("game.changedata", function (data) {
        var user = users[socket.id.replace("/#", '')];
        socket.in(user.room).emit("game.changedata", data);
    });
    //游戏结束指令
    socket.on("game.over", function () {
        //找到玩家
        var user = users[socket.id.replace("/#", '')];
        var room = rooms[user.room];

        var winner = user.id == room.play1.id ? room.play1 : room.play2;
        var loser = user.id == room.play1.id ? room.play2 : room.play1;

        //更新状态
        winner.win += 1;
        winner.total += 1;
        winner.status = 2;

        loser.total += 1;
        loser.status = 2;

        //返回游戏结束指令
        socket.emit("game.over", winner);
        socket.in(user.room).emit("game.over", loser);

        //向两位玩家发送一条系统消息
        io.sockets.in(user.room).emit("chat.newchat", {
            nickname: '系统消息',
            msg: winner.nickname + "赢了"
        });

        //向所有人广播
        io.sockets.emit("user.online", getUsers());
    });
    //退出房间
    socket.on("game.exit", function () {
        var user = users[socket.id.replace("/#", '')];
        var room = rooms[user.room];

        if (user.id == room.play1.id) {//房主
            delete rooms[user.room];
            if (room.play2) {
                room.play2.status = 1;
                room.play2.room = "public";

                //找到对方的socket,离开房间进入public
                var so = io.sockets.sockets["/#" + room.play2.id];
                so.leave(user.room);
                so.join("public");
            }
        } else {//加入者
            room.play2 = null;
            socket.in(user.room).emit("room.hasCreated", room);
        }

        //自己退出房间
        socket.leave(user.room);
        socket.join("public");
        user.status = 1;
        user.room = "public";
        //自己退出房间，刷新房间列表
        io.sockets.in("public").emit("room.rooms", getRooms());
        io.sockets.emit("user.online", getUsers());
    });

    //断开连接
    socket.on('disconnect', function () {
        var user = users[socket.id.replace("/#", '')];
        if (user.status == 3) {//游戏中状态
            var room = rooms[user.room];
            if (user.id == room.play1.id) {
                delete rooms[user.room];
                room.play2.status = 1;
                room.play2.room = "public";
                room.play2.win += 1;
                room.play2.total += 1;
                var so = io.sockets.sockets["/#" + room.play2.id];
                so.leave(user.room);
                so.join("public");

                so.emit("game.over", room.play2);
                so.emit("chat.newchat", {
                    nickname: '系统消息',
                    msg: "您的对手掉线"
                });
                io.sockets.in("public").emit("room.rooms", getRooms());
            } else {
                room.play1.status = 2;
                room.play1.win += 1;
                room.play1.total += 1;

                room.play2 = null;
                socket.in(user.room).emit("game.over", room.play1);
                socket.in(user.room).emit("room.hasCreated", room);
                socket.in(user.room).emit("chat.newchat", {
                    nickname: '系统消息',
                    msg: "您的对手掉线"
                });
            }
        }
        if (user.status == 2) {//准备中状态
            var room = rooms[user.room];
            if (user.id == room.play1.id) {
                delete rooms[user.room];
                if (room.play2) {
                    room.play2.status = 1;
                    room.play2.room = "public";
                    //找到对方的socket,离开房间进入public
                    var so = io.sockets.sockets["/#" + room.play2.id];
                    so.leave(user.room);
                    so.join("public");
                }
                io.sockets.in("public").emit("room.rooms", getRooms());
            } else {
                room.play2 = null;
                socket.in(user.room).emit("room.hasCreated", room);
            }
        }
        //删除自己通知所有人
        delete users[socket.id.replace("/#", '')];
        io.sockets.emit('user.online', getUsers());
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
