# AIBankingPortal

AIBankingPortal is a secure, accessible Canadian retail banking portal demo built
with Node.js and Express. It provides a small end-to-end banking experience
while keeping authentication, ownership checks, validation, and API behavior
easy to inspect and extend.

> **Demo status:** This is an educational project, not production banking
> software. Do not use real credentials, personal information, or financial data.

## Goal

The goal is to demonstrate a public-facing banking application with a focused
server-side API and a simple browser interface. The project emphasizes:

- JWT-based authentication with bcrypt password hashing.
- Customer registration, login, and password changes.
- Ownership-protected account and transaction access.
- Integer cents for monetary values.
- Consistent JSON errors and generated Swagger/OpenAPI documentation.
- Security headers and login rate limiting.
- Automated API and browser test coverage.

## Tech stack

- **Runtime:** Node.js 18+
- **Backend:** Express 4
- **Authentication:** JSON Web Tokens (`jsonwebtoken`) and `bcryptjs`
- **Security:** Helmet and `express-rate-limit`
- **API documentation:** Swagger JSDoc and Swagger UI
- **Frontend:** Accessible HTML, CSS, and browser JavaScript
- **Testing:** Jest, SuperTest, and Playwright
- **CI:** GitHub Actions
- **Storage:** A local JSON file for the demo (replace with a managed database
  for production)

## Main project points

- `src/app.js` contains the API, authentication middleware, validation, and
  Swagger annotations.
- `src/store.js` provides the small local JSON persistence layer.
- `public/` contains the login, registration, dashboard, and password-change
  pages.
- `tests/api.test.js` covers registration, authentication, authorization,
  password changes, transaction filtering, and balance calculations.
- `tests/e2e/portal.spec.js` covers the user-visible browser flow.
- `/.github/workflows/ci.yml` runs syntax checks and the API test suite on every
  push and pull request.

## API endpoints

- `POST /api/register` - create a customer and Chequing account.
- `POST /api/login` - issue a 15-minute bearer token.
- `POST /api/changepassword` - change the authenticated customer's password.
- `GET /api/accounts` - list the authenticated customer's accounts.
- `GET /api/accounts/:accountId/transactions` - list, search, and filter owned
  transactions.
- `POST /api/dev/seed` - add development-only sample transactions.

All protected endpoints require a bearer token in the `Authorization` header.
API errors use the shape `{ "error": "message" }`. Interactive API
documentation is available at `/api-docs` while the server is running.

## How to run

Requirements: Node.js 18 or newer.

```bash
npm install
copy .env.example .env
npm start
```

Open <http://localhost:3000>. On macOS/Linux, use `cp .env.example .env`
instead of `copy`.

The local `.env` file and `data.json` runtime store are intentionally ignored
by Git. Use a new, long random `JWT_SECRET` for any shared environment and
never commit secrets or real customer data.

## How to test

Run the syntax checks and API tests:

```bash
npm run check
npm test
```

To run the Playwright browser tests, install a supported browser once and then
run:

```bash
npx playwright install chromium
npm run test:e2e
```

## Future improvements

- Replace JSON persistence with a transactional database and migrations.
- Add transfer, bill-payment, approval, and AML workflows with audit trails.
- Add refresh-token rotation, MFA, account lockout, and stronger session
  management.
- Add structured logging, monitoring, backups, and production secrets
  management.
- Expand accessibility and cross-browser Playwright coverage.
- Add a production deployment workflow with environment-specific approvals.

## License

No license has been selected yet. Add an appropriate license before accepting
external contributions or redistributing the project.
