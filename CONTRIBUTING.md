# Contributing to DigiPay-DFA

Thank you for helping improve this educational project. Contributions should preserve its academic focus and clearly distinguish simulated payment behavior from real payment infrastructure.

## Before You Start

1. Check the existing issues and documentation to avoid duplicating work.
2. Fork the repository on GitHub.
3. Clone your fork and create a feature branch:

   ```bash
   git clone https://github.com/<your-username>/digipay-dfa.git
   cd digipay-dfa
   git switch -c feature/short-description
   ```

## Make Changes

- Keep changes focused and follow the existing Python and React conventions.
- Add or update tests for behavior changes.
- Never commit `.env` files, API keys, passwords, local database files, or personal credentials. The local database is regenerated and seeded by the backend.
- Do not introduce real payment, UPI, or banking integrations without a separate project and security review.
- Update the README or API documentation when setup or behavior changes.

## Run Checks

From the repository root, run the backend tests:

```bash
cd backend
python -m pip install -r requirements.txt
python -m pytest tests/ -q
```

In a second terminal, run the frontend tests and production build:

```bash
cd frontend
npm ci
npm test
npm run build
```

For API changes, start the backend and run the live integration checks:

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal, run:

```bash
cd backend
python e2e_verify.py
```

## Submit a Pull Request

1. Run the relevant tests and review your changes for local data or secrets.
2. Commit with a clear, concise message and push the feature branch to your fork.
3. Open a pull request against the upstream default branch.
4. Describe the behavior changed, the tests run, and any limitations or follow-up work.
5. Respond to review feedback with focused commits.

Pull requests must pass the GitHub Actions workflow before they are considered ready to merge.