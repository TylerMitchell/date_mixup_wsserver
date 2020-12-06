require('dotenv').config();
require("./models/associations");
let db = require("./db");
let os = require('os');
let socketIO = require('socket.io');

let app = require("express")();
let http = require("http").createServer(app);

http.listen( process.env.PORT, () => { console.log("vanilla http server here!"); } );
let jwt = require('jsonwebtoken');
const { User } = require("./models");

console.log("before cors!");
let io = socketIO(http, {
    cors: { 
        origin: "http://localhost:3000, https://date-mixup.herokuapp.com",
        optionsSuccessStatus: 200,
        credentials: true
    }
});
console.log("before middleware!");
io.use((socket, next) => {
    console.log("start of middleware: ", socket.handshake);
    const sessionToken = socket.handshake.auth.token;
    console.log("hit the socket.io auth function!");
    if( !sessionToken ) {
        next(new Error("No token *test* provided"));
    }
    else{
        jwt.verify(sessionToken, process.env.JWT_SECRET, (err, decoded) => {
            if(decoded){
                User.findOne({ where: { id: decoded.id } }).then( (user) => {

                    user.getProfiles().then( (profiles) => { 
                        if( profiles[0].id ){
                            socket.profile = profiles[0];
                            socket.user = user;
                            next();
                        } else{ next(new Error("No Profile Found for user!")); }
                    });
                }, () => { next(new Error("Not Authorized!")); });
            } else { next(new Error("Not Authorized!")); }
        });
    }
});

io.sockets.on('connection', function(socket) {
    console.log("Start of connection: ", io.sockets.adapter.sids);

    socket.on("Join Event", (eventName) => {
        socket.join(eventName);
        socket.isInDate = false;
        let eventSocketIdArr = Array.from(io.sockets.adapter.rooms.get(eventName));

        //algorithm currently just pairs any two people not currently in a date
        let match = [];
        eventSocketIdArr.forEach( (sockId) => {
            let sock = io.sockets.sockets.get(sockId);
            if( sock.isInDate === false ){ 
                match.push(sock); 
                if(match.length == 2){ //create a room id and add both sockets to that room, then emit a message to both users
                    let me = match[0];
                    let you = match[1];
                    let room = me.profile.screenName + you.profile.screenName;
                    me.join(room);
                    you.join(room);
                    me.partnerSocket = you;
                    you.partnerSocket = me;
                    me.emit("Initiate Date");
                    io.to(room).emit("message", "Found Date");
                    match = [];
                }
            } 
        });
    });

    //relay messages to other socket
    socket.on("Offer", (sessionDescription) => { console.log("Hit Offer Relay", socket); if(socket.partnerSocket){ io.to(socket.partnerSocket.id).emit("Offer", sessionDescription); } })
    socket.on("Answer", (sessionDescription) => { console.log("Hit Answer Relay"); if(socket.partnerSocket){ io.to(socket.partnerSocket.id).emit("Answer", sessionDescription); } })
    socket.on("Candidate", (candidate) => { console.log("Hit Candidate Relay"); if(socket.partnerSocket){ io.to(socket.partnerSocket.id).emit("Candidate", candidate); } })
    
    // handle the event sent with socket.send()
    socket.on('message', (data) => {
        console.log(data);
    });

    socket.on('ipaddr', function() {
        let ifaces = os.networkInterfaces();
        for (let dev in ifaces) {
            ifaces[dev].forEach((details) => {
                if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                    socket.emit('ipaddr', details.address);
                }
            });
        }
    });

});