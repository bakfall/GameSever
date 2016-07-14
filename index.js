var server = require('http').createServer();
var io = require('socket.io')(server);
var users = {}

io.on('connection', function (socket) {
    console.log("用户连接到服务器");
    socket.join("public");
    socket.on('user.online', function (user) {
        user.room = 'public';
        users[user.id] = user;
        io.sockets.emit('user.online', getUsers());
		  });
    socket.on('chat.send',function( chat ) {
        var user = users[socket.id.replace("/#",'')];
        socket.to(user.room).emit("chat.newchat",chat);
    })
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
server.listen(3000)
console.log("开启服务器！");