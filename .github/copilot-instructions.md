# Banking portal development rules

- Use async/await and keep one Express router per resource when adding routers.
- Keep all monetary values as integer cents; never use floating point for currency.
- Preserve ownership checks, JWT authentication, bcrypt hashing, and the approval/AML business rules when extending payments.
- Never log passwords, full account numbers, SINs, card numbers, or unmasked personal data.
- Keep API errors consistent as `{ error: "message" }`; do not expose stack traces.
- Add or preserve Swagger annotations for every endpoint.
- Escape API data before rendering it in the frontend and maintain accessible labels, focus states, and WCAG AA contrast.
- Add Jest/supertest coverage for API changes and Playwright coverage for user-visible flow changes.
