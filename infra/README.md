# Infrastructure reference

[Project README](../README.md) · [Current architecture](../docs/submission/ARCHITECTURE.md)

The deployed application uses a frontend Lambda, IAM-protected backend Lambda and the existing DynamoDB table in Sydney. The public frontend uses a Lambda Function URL; protected persistence goes through fixed Next.js server routes and direct IAM Lambda invocation. No deployment is required to explore Sample Demo locally.

## Included source

- `lambda/entry.ts`, `handlers.ts`, `dynamodb.ts`: shared handler/model logic and conditional DynamoDB repository.
- `template.json`: original SAM backend foundation with one backend Lambda, retained on-demand table, IAM-protected HTTP API and basic logs. The legacy API is not the current frontend transport.
- `frontend/template.json`: private-first preparation scaffold containing placeholder inline code. It cannot deploy the full Next.js application by itself.
- `frontend/bootstrap.mjs`, `run.sh`, `build-safe.mjs`, `package-linux.mjs`: runtime validation, startup and Linux-only packaging. Pinned Web Adapter layer version 30 is a separate layer dependency.
- `frontend/deployment-plan.json`: review-only template with placeholder account metadata; not the private maintainer deployment record.

Account-specific deploy/verification scripts, runtime credentials, ZIPs and local reports are excluded from the repository. Nothing in this guide authorizes changes to the live account.

## Backend contracts

The shared handler exposes GET/PUT campus, POST forecast and GET environment operations. Demo and real keys have independent schema-1/schema-2 records. Real requests validate operational provenance and reject DEMO_SYNTHETIC, require the extra backend token and conditionally check expected revision. Missing real state does not seed demo inputs. Typed model/source metadata and available environmental context are separate from tank-storage calculations.

DynamoDB reads are consistent. The backend runtime needs only GetItem/PutItem on its table plus logs. The frontend role needs only invocation of the specific backend function plus its own logs. Browser AWS credentials are never required.

## Local validation

Install root and infra dependencies from their lockfiles, then run the full test suite from the root. Tests mock repositories/providers and do not need AWS credentials. `npm run backend:mock` starts a loopback in-memory development server; it is explicitly not AWS and must not be exposed publicly. The public frontend demo intentionally does not automatically attach to that mock.

`npm run backend:build` compiles the shared backend into ignored `infra/.build`. Optional frontend packaging requires an existing Linux x86_64 Node 24 environment, a secret-free standalone build, and an `artifacts` directory. Create `artifacts/aws/phase-7.3` before running the historical source-stage helper, whose manifest is written there. Packaging validates executable permissions, static assets, runtime dependencies, ZIP sizes and credential patterns. Review/signature scans alone are not cloud cold-start proof.

No AWS deployment, resource creation or secret provisioning is part of local setup. Production secrets belong exclusively in trusted runtime configuration. A public deployment needs separate security review, narrow URL invocation grants and rollback/cost controls; CORS does not provide authorization.
