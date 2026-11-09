const fs = require('fs');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const tempFile = path.join(__dirname, 'tmp-data.json');
process.env.DATA_FILE = tempFile;
process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.NODE_ENV = 'test';
if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
const { app } = require('../src/app');

jest.setTimeout(15000);
afterAll(() => { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); });

describe('banking API', () => {
  let tokenA; let tokenB; let accountA;
  test('registers, rejects weak/mismatched passwords and duplicate usernames', async () => {
    const base = { username: 'alice', fullName: 'Alice Example', email: 'alice@example.com', password: 'Password1', confirmPassword: 'Password1' };
    expect((await request(app).post('/api/register').send(base)).status).toBe(201);
    expect((await request(app).post('/api/register').send({ ...base, email: 'other@example.com' })).status).toBe(409);
    expect((await request(app).post('/api/register').send({ ...base, username: 'weak', password: 'password', confirmPassword: 'password' })).status).toBe(400);
    expect((await request(app).post('/api/register').send({ ...base, username: 'mismatch', confirmPassword: 'Password2' })).status).toBe(400);
    await request(app).post('/api/register').send({ username: 'bob', fullName: 'Bob Example', email: 'bob@example.com', password: 'Password2', confirmPassword: 'Password2' });
  });
  test('logs in with a generic failure and changes password', async () => {
    const bad = await request(app).post('/api/login').send({ username: 'nobody', password: 'bad' });
    expect(bad.status).toBe(401); expect(bad.body.error).toBe('Invalid username or password');
    const loginA = await request(app).post('/api/login').send({ username: 'alice', password: 'Password1' });
    tokenA = loginA.body.token; expect(loginA.status).toBe(200);
    const loginB = await request(app).post('/api/login').send({ username: 'bob', password: 'Password2' });
    tokenB = loginB.body.token;
    expect((await request(app).post('/api/changepassword').set('Authorization', `Bearer ${tokenA}`).send({ currentPassword: 'Password1', newPassword: 'Newpass1' })).status).toBe(200);
    expect((await request(app).post('/api/login').send({ username: 'alice', password: 'Newpass1' })).status).toBe(200);
  });
  test('protects accounts and transaction ownership', async () => {
    expect((await request(app).get('/api/accounts')).status).toBe(401);
    accountA = (await request(app).get('/api/accounts').set('Authorization', `Bearer ${tokenA}`)).body[0];
    const accountsB = await request(app).get('/api/accounts').set('Authorization', `Bearer ${tokenB}`);
    const bTransactions = await request(app).get(`/api/accounts/${accountsB.body[0].accountId}/transactions`).set('Authorization', `Bearer ${tokenA}`);
    expect(bTransactions.status).toBe(404);
  });
  test('seeds and filters transactions with balance equal to their sum', async () => {
    expect((await request(app).post('/api/dev/seed').set('Authorization', `Bearer ${tokenA}`)).status).toBe(201);
    const filtered = await request(app).get(`/api/accounts/${accountA.accountId}/transactions?limit=2&category=Groceries&q=grocery`).set('Authorization', `Bearer ${tokenA}`);
    expect(filtered.status).toBe(200); expect(filtered.body.length).toBeLessThanOrEqual(2); expect(filtered.body.every((t) => t.category === 'Groceries')).toBe(true);
    const data = JSON.parse(fs.readFileSync(tempFile, 'utf8')); const transactions = data.transactions.filter((t) => t.accountId === accountA.accountId);
    const account = data.accounts.find((a) => a.accountId === accountA.accountId);
    expect(account.balance).toBe(transactions.reduce((sum, t) => sum + t.amount, 0));
  });
});
