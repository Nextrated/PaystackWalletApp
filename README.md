# Paystack Wallet App

A sample application demonstrating how to build a **wallet system** on top of **Paystack Dedicated Virtual Accounts (DVAs)** using Node.js, Express, MongoDB, and a simple HTML/CSS frontend.

### What this app shows

- **Internal wallet balances** credited via DVAs (when users receive funds to their personal virtual account)
- Multiple funding methods: card, bank transfer, and DVA transfers
- **Withdrawal** to bank accounts using Paystack Transfers
- **Optimistic locking** to prevent duplicate withdrawals
- **Webhook handling** for asynchronous events (charge.success, transfer.success, dedicatedaccount.assign.success)
- **JWT authentication** with protected routes
- **Card BIN verification** using Paystack Decision API
- Clean, consistent API response format across all endpoints

**Important**: This is a **learning/demo app**, not production-ready. It lacks rate limiting, input sanitization, proper error recovery, refresh tokens, etc.

## Features

- User registration & login (JWT)
- View wallet balance & account details
- Fund wallet via card/bank transfer or DVA
- Generate Dedicated Virtual Account (DVA)
- Add bank account for withdrawals
- Withdraw funds to bank account (with concurrency lock)
- Verify card BIN (6-digit number)
- Webhook processing for real-time updates

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: MongoDB
- **Payments**: Paystack API (DVAs, Transfers, Transactions)
- **Auth**: JWT
- **Frontend**: Vanilla HTML + CSS + JavaScript (no framework)

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Example `.env.example` contents:

```env
# .env.example
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
DB_USERNAME=your_mongodb_username
DB_PASSWORD=your_mongodb_password
DB_HOST=cluster0.xxxxx.mongodb.net
DB_NAME=paystack_wallet
JWT_SECRET=your_random_secret_at_least_32_characters_long
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=development
```

**Note**: Never commit `.env` to git.

## Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/Nextrated/PaystackWalletApp.git
   cd PaystackWalletApp
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env` and fill in your Paystack key, MongoDB credentials, and JWT secret.

4. **Update frontend API base URL**

   Open `src/public/config.js` and set the correct URL:

   ```js
   // For local development
   export const API_BASE_URL = "http://localhost:3000";

   // For production (uncomment when deploying)
   // export const API_BASE_URL = "https://paystackwalletapp.onrender.com";
   ```

5. **Run the app**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 (or your PORT) in the browser.

## Live Demo

https://paystackwalletapp.onrender.com/

## Testing the App

### Login / Register
Use the login or signup page to create an account.

### Fund Wallet
- **Card/Bank transfer**: Click "Fund Wallet" → follow Paystack checkout
- **DVA funding** (test mode):
  1. Generate DVA (click "Generate DVA")
  2. Go to https://demobank.paystackintegrations.com/
  3. Transfer any amount to your generated DVA account number

### Add Bank Account
Click "Add Bank Account" → enter valid Nigerian bank code & account number

### Withdraw Funds
- Must have added a bank account first
- Click "Withdraw Funds" → enter amount

### Verify Card BIN
Click "Verify CARD" → enter first 6 digits of any card number (e.g. 533983)

### Webhooks (Critical for DVA & async updates)

1. Set up a public URL (use **ngrok** for local testing):
   ```bash
   ngrok http 3000
   ```
   Copy the https URL (e.g. https://abc123.ngrok.io)

2. Go to Paystack Dashboard → Settings → API Keys & Webhooks
   - Add webhook URL: `https://abc123.ngrok.io/webhooks/paystack`
   - Test events: `charge.success`, `transfer.success`, `dedicatedaccount.assign.success`

3. Local webhook testing tip: Use the Paystack test dashboard to trigger test events.


## Notes

- **Test vs Live mode**: DVA creation uses `test-bank` in test mode and random real providers in live mode (from `/bank-providers`).
- **Security**: This is a demo — in production add rate limiting, input validation, HTTPS, refresh tokens, etc.
- **Frontend**: Simple HTML/JS — no React/Vue. Easy to extend or replace.

Happy building! 🚀  
If you find this useful, give the repo a star or share feedback.

Made with ❤️ by Pearl