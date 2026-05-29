# Security Policy

## Supported versions

Camelid is pre-1.0 and moving quickly. Security fixes are currently handled on the latest `main`
branch.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for a suspected vulnerability.

Instead, report it privately through GitHub Security Advisories for this repository:

- Go to the repository's **Security** tab
- Choose **Report a vulnerability**

If that flow is unavailable, contact the maintainer privately and include:

- a clear description of the issue
- affected commit / branch if known
- reproduction steps
- impact assessment
- any suggested mitigation

Please avoid publishing exploit details until the issue has been reviewed and a fix or mitigation
plan exists.

## Response goals

Best effort, not SLA-backed:

- acknowledge receipt within a reasonable time
- validate and scope the report
- prepare a fix or mitigation when confirmed
- coordinate disclosure once users have a path to update

## Scope notes

Security reports are especially helpful for issues involving:

- unsafe model-file parsing
- request handling bugs
- filesystem access problems
- secrets exposure
- sandbox or isolation assumptions
- dependency vulnerabilities with real runtime impact

Performance limitations, unsupported model families, or evidence-gated compatibility gaps are
usually product/support issues rather than security vulnerabilities unless they create a concrete
security impact.
