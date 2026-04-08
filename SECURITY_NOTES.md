# Security Notes

This project now includes the following IS 414 security controls and demo-ready checkpoints:

- HTTPS/TLS is expected in deployment, and the frontend host is configured to emit `Strict-Transport-Security`.
- The ASP.NET API forces HTTPS redirection and enables HSTS outside development.
- CSP is emitted as an HTTP header by both the ASP.NET API and the Vercel frontend host.
- Authentication uses username/password with hashed passwords.
- Registration enforces a stronger password policy: minimum length `14`.
- Admin create/update/delete endpoints require the `admin` role.
- Donor dashboard data is donor-only and no longer reads from admin listing endpoints.
- Delete actions in the admin UI require a confirmation modal.
- The footer links to a customized privacy policy page.
- Cookie consent stores the user choice in browser storage and a browser-accessible cookie.
- A browser-accessible `haven_theme` cookie is read by React to switch the public site theme.

Suggested video walkthrough:

1. Show the deployed site loading over HTTPS and inspect the response headers for CSP and HSTS.
2. Show the privacy policy link in the footer and the cookie consent prompt.
3. Register a donor account with a short password to show validation, then with a valid password.
4. Sign in as a donor and show the donor-only dashboard with donation history and impact.
5. Sign in as an admin and show admin pages plus a delete confirmation dialog.
6. Open dev tools or an API client to show unauthorized/forbidden behavior for protected endpoints when not signed in or when signed in as the wrong role.
