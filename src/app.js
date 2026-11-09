require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { createStore } = require('./store');

const app = express();
const dataFile = process.env.DATA_FILE || path.join(__dirname, '..', 'data.json');
const store = createStore(dataFile);
const jwtSecret = process.env.JWT_SECRET || 'development-only-secret-change-me';
const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validString = (value) => typeof value === 'string' && value.trim().length > 0;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// The small static pages use inline page-specific controllers; other Helmet headers remain enabled.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'Invalid JSON body' });
  return next(error);
});

function error(res, status, message) { return res.status(status).json({ error: message }); }
function validatePassword(password) { return typeof password === 'string' && password.length >= 8 && passwordPattern.test(password); }
function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return error(res, 401, 'Authentication required');
  try {
    req.customerId = jwt.verify(token, jwtSecret).customerId;
    return next();
  } catch (err) {
    return error(res, 401, 'Invalid or expired token');
  }
}
function publicCustomer(customer) {
  return { customerId: customer.customerId, username: customer.username, fullName: customer.fullName, email: customer.email, createdAt: customer.createdAt };
}
function ownsAccount(data, customerId, accountId) {
  return data.accounts.find((account) => account.accountId === accountId && account.customerId === customerId);
}

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many failed login attempts. Please try again later.' }
});

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
 *   schemas:
 *     Error: { type: object, properties: { error: { type: string } } }
 *     Account: { type: object, properties: { accountId: { type: string }, customerId: { type: string }, type: { type: string }, currency: { type: string }, balance: { type: integer } } }
 *     Transaction: { type: object, properties: { transactionId: { type: string }, accountId: { type: string }, date: { type: string }, description: { type: string }, category: { type: string }, type: { type: string }, amount: { type: integer }, status: { type: string } } }
 */
/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Register a customer
 *     requestBody: { required: true, content: { application/json: { schema: { type: object } } } }
 *     responses: { '201': { description: Created }, '400': { description: Validation error }, '409': { description: Duplicate username } }
 */
app.post('/api/register', (req, res) => {
  const body = req.body;
  if (!isObject(body) || !['username', 'fullName', 'email', 'password', 'confirmPassword'].every((key) => validString(body[key]))) return error(res, 400, 'All fields are required');
  if (!emailPattern.test(body.email.trim())) return error(res, 400, 'Enter a valid email address');
  if (!validatePassword(body.password)) return error(res, 400, 'Password must be at least 8 characters and contain a letter and a number');
  if (body.password !== body.confirmPassword) return error(res, 400, 'Passwords do not match');
  const data = store.read();
  if (data.customers.some((customer) => customer.username.toLowerCase() === body.username.trim().toLowerCase())) return error(res, 409, 'Username is already in use');
  const customer = { customerId: id('cus'), username: body.username.trim(), fullName: body.fullName.trim(), email: body.email.trim().toLowerCase(), passwordHash: bcrypt.hashSync(body.password, 12), createdAt: new Date().toISOString() };
  const account = { accountId: id('acct'), customerId: customer.customerId, type: 'Chequing', currency: 'CAD', balance: 0 };
  data.customers.push(customer); data.accounts.push(account); store.write(data);
  return res.status(201).json(publicCustomer(customer));
});

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Log in
 *     responses: { '200': { description: Authenticated }, '401': { description: Invalid credentials }, '429': { description: Rate limited } }
 */
app.post('/api/login', loginLimiter, (req, res) => {
  if (!isObject(req.body) || typeof req.body.username !== 'string' || typeof req.body.password !== 'string') return error(res, 401, 'Invalid username or password');
  const customer = store.read().customers.find((item) => item.username.toLowerCase() === req.body.username.trim().toLowerCase());
  if (!customer || !bcrypt.compareSync(req.body.password, customer.passwordHash)) return error(res, 401, 'Invalid username or password');
  const token = jwt.sign({ customerId: customer.customerId }, jwtSecret, { expiresIn: '15m' });
  return res.json({ token, fullName: customer.fullName });
});

/**
 * @swagger
 * /api/changepassword:
 *   post:
 *     security: [{ bearerAuth: [] }]
 *     summary: Change password
 *     responses: { '200': { description: Changed }, '400': { description: Validation error }, '401': { description: Unauthorized } }
 */
app.post('/api/changepassword', auth, (req, res) => {
  if (!isObject(req.body) || typeof req.body.currentPassword !== 'string' || typeof req.body.newPassword !== 'string') return error(res, 400, 'Current and new passwords are required');
  const data = store.read(); const customer = data.customers.find((item) => item.customerId === req.customerId);
  if (!customer || !bcrypt.compareSync(req.body.currentPassword, customer.passwordHash)) return error(res, 401, 'Current password is incorrect');
  if (!validatePassword(req.body.newPassword)) return error(res, 400, 'Password must be at least 8 characters and contain a letter and a number');
  customer.passwordHash = bcrypt.hashSync(req.body.newPassword, 12); store.write(data);
  return res.json({ message: 'Password changed successfully' });
});

/**
 * @swagger
 * /api/accounts:
 *   get:
 *     security: [{ bearerAuth: [] }]
 *     summary: List customer accounts
 *     responses: { '200': { description: Accounts } }
 */
app.get('/api/accounts', auth, (req, res) => res.json(store.read().accounts.filter((account) => account.customerId === req.customerId)));

/**
 * @swagger
 * /api/accounts/{accountId}/transactions:
 *   get:
 *     security: [{ bearerAuth: [] }]
 *     summary: List account transactions
 *     parameters: [{ name: accountId, in: path, required: true, schema: { type: string } }, { name: limit, in: query, schema: { type: integer } }, { name: category, in: query, schema: { type: string } }, { name: q, in: query, schema: { type: string } }]
 *     responses: { '200': { description: Transactions }, '404': { description: Not found } }
 */
app.get('/api/accounts/:accountId/transactions', auth, (req, res) => {
  const data = store.read(); if (!ownsAccount(data, req.customerId, req.params.accountId)) return error(res, 404, 'Account not found');
  const rawLimit = req.query.limit === undefined ? 10 : Number(req.query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) return error(res, 400, 'Limit must be an integer between 1 and 50');
  let transactions = data.transactions.filter((item) => item.accountId === req.params.accountId);
  if (typeof req.query.category === 'string' && req.query.category) transactions = transactions.filter((item) => item.category.toLowerCase() === req.query.category.toLowerCase());
  if (typeof req.query.q === 'string' && req.query.q) transactions = transactions.filter((item) => item.description.toLowerCase().includes(req.query.q.toLowerCase()));
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  return res.json(transactions.slice(0, rawLimit));
});

/**
 * @swagger
 * /api/dev/seed:
 *   post:
 *     security: [{ bearerAuth: [] }]
 *     summary: Add synthetic sample transactions (development only)
 *     responses: { '201': { description: Seeded }, '404': { description: Disabled in production } }
 */
app.post('/api/dev/seed', auth, (req, res) => {
  if (process.env.NODE_ENV === 'production') return error(res, 404, 'Not found');
  const data = store.read(); const account = data.accounts.find((item) => item.customerId === req.customerId);
  if (!account) return error(res, 404, 'Account not found');
  const samples = [
    ['Salary deposit', 'Salary', 'Credit', 350000], ['Grocery market', 'Groceries', 'Debit', -12500], ['Monthly rent', 'Rent', 'Debit', -180000],
    ['Electricity bill', 'Utilities', 'Debit', -9400], ['Transfer from savings', 'Transfers', 'Credit', 50000], ['Online shopping', 'Shopping', 'Debit', -7850],
    ['Salary deposit', 'Salary', 'Credit', 350000], ['Grocery market', 'Groceries', 'Debit', -9800], ['Monthly rent', 'Rent', 'Debit', -180000],
    ['Water bill', 'Utilities', 'Debit', -4200], ['Transfer from savings', 'Transfers', 'Credit', 25000], ['Online shopping', 'Shopping', 'Debit', -3499],
    ['Salary deposit', 'Salary', 'Credit', 350000], ['Grocery market', 'Groceries', 'Debit', -15600], ['Internet bill', 'Utilities', 'Debit', -6999],
    ['Transfer from savings', 'Transfers', 'Credit', 30000], ['Bookstore purchase', 'Shopping', 'Debit', -4500], ['Salary deposit', 'Salary', 'Credit', 350000],
    ['Grocery market', 'Groceries', 'Debit', -11200], ['Monthly rent', 'Rent', 'Debit', -180000]
  ];
  samples.forEach(([description, category, type, amount], index) => data.transactions.push({ transactionId: id('txn'), accountId: account.accountId, date: new Date(Date.now() - index * 86400000).toISOString(), description, category, type, amount, status: 'Completed' }));
  account.balance = data.transactions.filter((item) => item.accountId === account.accountId).reduce((sum, item) => sum + item.amount, 0);
  store.write(data); return res.status(201).json({ account, added: samples.length });
});

const swaggerSpec = swaggerJsdoc({ definition: { openapi: '3.0.0', info: { title: 'Simple Banking Portal API', version: '1.0.0' }, servers: [{ url: '/' }] }, apis: [__filename] });
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res) => error(res, 404, 'Not found'));
app.use((err, req, res, next) => { console.error('Request failed'); return error(res, 500, 'Internal server error'); });

module.exports = { app, store, validatePassword };
