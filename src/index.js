const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
//const request = require("request");
const Filter = require("bad-words");
const {
  generateMessage,
  generateLocationMessage,
} = require("./utils/messages");

const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");
app.use(express.static(publicDirectoryPath));

io.on("connection", (socket) => {
  console.log("New webSocket connection");

  socket.on("join", ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    socket.emit("welcomeMessage", generateMessage("Admin", "welcome!"));
    socket.broadcast
      .to(user.room)
      .emit("welcomeMessage", generateMessage(`${user.username} has joined!`));
    // send message to everyone in the room
    // io.to.emit, socket.broadcast.to.emit
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });
    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();
    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed");
    }

    io.to(user.room).emit(
      "welcomeMessage",
      generateMessage(user.username, message)
    );
    callback();
  });

  socket.on("sendGeolocation", (coords, callback) => {
    const user = getUser(socket.id);
    const url = `https://google.com/maps?q=${coords.latitude},${coords.longitude}`;

    io.to(user.room).emit(
      "locationMessage",
      generateLocationMessage(user.username, url)
    );
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        "welcomeMessage",
        generateMessage(`${user.username} has left!`)
      );
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server start on port ${port}`);
});
