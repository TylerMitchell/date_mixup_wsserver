require('dotenv').config();
require("./models/associations");
let db = require("./db");
let os = require('os');
// let socketIO = require('socket.io');

// let app = require("express")();
// let http = require("http").createServer(app);

// http.listen( process.env.PORT, () => { console.log("vanilla http server here!"); } );
let jwt = require('jsonwebtoken');
const { User } = require("./models");

const express = require('express');
const socketIO = require('socket.io');

const accountSID = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")( accountSID, authToken );

let iceServers = null;
let io = null;

const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

  //get STUN/TURN server info
client.tokens.create().then( (token) => { 
    iceServers = token.iceServers;
    io = socketIO(server, {
        cors: {
            "origin": "*",
            "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
            "preflightContinue": false,
            "optionsSuccessStatus": 204
          }
    });

    io.on('connection', (socket) => {
        console.log('Client connected');
        socket.on('disconnect', () => console.log('Client disconnected'));
    });
    
    //setInterval(() => io.emit('time', new Date().toTimeString()), 1000);
    //setInterval(() => io.emit('message', new Date().toTimeString()), 1000);
    io.use((socket, next) => {
        console.log("start of middleware: ");
        const sessionToken = socket.handshake.auth.token;
        console.log("hit the socket.io auth function!: ", sessionToken);
        if( !sessionToken ) {
            next(new Error("No token *test* provided"));
        }
        else{
            console.log("Before jwt decode: ", jwt.decode(sessionToken) );
            jwt.verify(sessionToken, process.env.JWT_SECRET, (err, decoded) => {
                if(decoded){
                    console.log("after jwt decode");
                    User.findOne({ where: { id: decoded.id } }).then( (user) => {
                        console.log("User retrieved successfully");
                        user.getProfiles().then( (profiles) => { 
                            if( profiles[0].id ){
                                console.log("Profile retrieved successfully");
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
        console.log("Start of connection: ");
    
        socket.emit("TURN Servers", iceServers);
        
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
                        console.log("room: ", room);
                        me.join(room);
                        you.join(room);
                        me.isInDate = true;
                        you.isInDate = true;
                        me.partnerSocket = you;
                        you.partnerSocket = me;
                        me.emit("Initiate Date");
                        me.emit("Other Profile", you.profile); //should care about limiting shared info in future TODO
                        you.emit("Other Profile", me.profile)
                        io.to(room).emit("message", "Found Date");
                        match = [];
                    }
                } 
            });
        });
    
        //relay messages to other socket
        socket.on("Offer", (sessionDescription) => { console.log("Hit Offer Relay"); if(socket.partnerSocket){ io.to(socket.partnerSocket.id).emit("Offer", sessionDescription); } })
        socket.on("Answer", (sessionDescription) => { console.log("Hit Answer Relay"); if(socket.partnerSocket){ io.to(socket.partnerSocket.id).emit("Answer", sessionDescription); } })
        socket.on("Candidate", (candidate) => { console.log("Hit Candidate Relay"); if(socket.partnerSocket){ io.to(socket.partnerSocket.id).emit("Candidate", candidate); } })
        
        socket.on("End Date Client", (closeData) => { 
            if(socket.partnerSocket){ io.to(socket.partnerSocket.id).emit("End Date Client", closeData); } 
            socket.leave( socket.profile.screenName + socket.partnerSocket.profile.screenName );
            socket.leave( socket.partnerSocket.profile.screenName + socket.profile.screenName );
            socket.isInDate = false;
            //socket.partnerSocket = null;
        });
    
        socket.on("Contact Exchange Requested", (requestId) => { 
            if(socket.partnerSocket){ io.to(socket.partnerSocket.id).emit("Contact Exchange Requested", requestId); }
            else{ console.log("Partner Socket was null in Contact Exchange Requested!"); }
        });
    
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
}); 