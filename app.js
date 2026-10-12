require('dotenv').config();

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const routes = require('./routes');

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required. Copy .env.example to .env and set a strong session secret.');
}

const app = express();

app.engine('jade', require('pug').__express);
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  res.locals.formatMoney = (value) => Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  next();
});
app.use(routes);
app.use((req, res) => res.status(404).render('not-found', { title: 'Page not found' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  if (error.name === 'SequelizeUniqueConstraintError') {
    req.flash('error', 'That code, email, asset tag, serial number, or category name is already in use.');
    return res.redirect('back');
  }
  if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeForeignKeyConstraintError') {
    req.flash('error', 'The submitted information is invalid or refers to a record that does not exist.');
    return res.redirect('back');
  }
  if (error.message === 'That asset is no longer available in stock'
    || error.message === 'Select an active employee.'
    || error.message === 'That asset is not currently issued.'
    || error.message.startsWith('Only assets currently in stock')) {
    req.flash('error', error.message);
    return res.redirect('back');
  }
  res.status(500).render('error', { title: 'Something went wrong contact Rudrakshh S' });
});

module.exports = app;
