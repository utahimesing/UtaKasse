# Security Policy

## Supported Versions

This project currently supports security fixes on the latest code in the `main` branch.

## Reporting a Vulnerability

If you find a security issue, please do not open a public issue with exploit details.

Please report privately using one of the following:

- GitHub Security Advisories (preferred): open a private vulnerability report in this repository
- Email: `utaforsm@gmail.com`

When reporting, include:

- A clear description of the issue
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

## Response Expectations

- Initial acknowledgement: within 72 hours
- Triage and severity assessment: within 7 days
- Fix timeline: depends on severity and complexity

## Disclosure Policy

- Please allow time for investigation and patching before public disclosure.
- After a fix is released, coordinated disclosure is welcome.

## Security Best Practices for Contributors

- Never commit `.env`, credentials, private keys, or real user data.
- Use anonymized/demo data for testing and screenshots.
- Run `npm audit` and `npm run build` before release.
