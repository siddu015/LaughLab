const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require('method-override');
const ejsMate = require("ejs-mate");
const passport = require("./passportConfig");
const session = require("express-session");
const { isAuthenticated, trackSession } = require('./middleware');


const port = 8080;
const MONGO_URL = "mongodb://127.0.0.1:27017/laughLab";

mongoose.connect(MONGO_URL)
    .then(() => console.log("Connected to DB"))
    .catch(err => console.log(err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(trackSession); // Logs session info for all routes

const userRouter = require("./routes/user.js");
const chatRouter = require("./routes/chat.js");

app.use("/", userRouter);
app.use("/", chatRouter);

app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/dashboard');
    } else {
        res.render("../views/loader.ejs");
    }
});

app.all("*", (req, res) => {
    res.send("This page is not there");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
