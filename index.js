var server = require('http').createServer();
var io = require('socket.io')(server);

io.on('connection', function(socket){
    console.log("用户连接到服务器");
  socket.on('event', function(data){});
  socket.on('disconnect', function(){
      console.log("用户断开连接");
  });   
});

server.listen(3000)
console.log("开启服务器！");