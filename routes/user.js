const express = require('express');
const router = express.Router();
const User = require('../models/UserModel');
const passport = require('passport');

router.get('/register', async (req, res) => {
    res.render("../views/createUser.ejs");
});

router.post('/register', async (req, res) => {
    const { username, password, confirmPassword, isMemeRecommendationEnabled } = req.body;

    if (password !== confirmPassword) {
        return res.send('Passwords do not match');
    }

    // Convert isMemeRecommendationEnabled to a boolean
    const memeRecommendationEnabled = isMemeRecommendationEnabled === "on";

    try {
        const user = new User({ username, isMemeRecommendationEnabled: memeRecommendationEnabled });
        await User.register(user, password);
        passport.authenticate('local')(req, res, () => {
            res.redirect('/');
        });
    } catch (err) {
        console.error(err);
        res.send('Error occurred while creating user');
    }
});

router.get('/login', async (req, res) => {
    res.render("../views/login.ejs");
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

module.exports = router;
