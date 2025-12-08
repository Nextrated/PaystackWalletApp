
## Overview

This application demonstrates how to turn Paystack's Dedicated Virtual Accounts (DVAs) into a working wallet system. While DVAs are typically just pass-through accounts directing funds to a merchant’s main account, this implementation shows how to layer a wallet feature on top using Node.js, Express, and MongoDB.

## Features

* **Virtual Account Integration:** Automatically credit a user’s internal wallet balance when funds are received via their assigned DVA.
* **Multiple Funding Methods:** Support for standard card and bank transfer payments in addition to DVA funding.
* **Simple Frontend:** A straightforward HTML/CSS interface for users to view and manage their wallet.
* **JWT Authentication:** Uses JSON Web Tokens for secure user sessions.

## Tech Stack

* **Backend:** Node.js with Express
* **Database:** MongoDB
* **Frontend:** HTML and CSS
* **Payment Integration:** Paystack API

## Environment Variables

To run this application, you’ll need to set up a `.env` file with the following variables:

PAYSTACK_SECRET_KEY=your_paystack_secret_key
DB_USERNAME=your_mongodb_username
DB_PASSWORD=your_mongodb_password
DB_HOST=your_mongodb_host
DB_NAME=your_mongodb_database_name
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=expiration_time_for_tokens
PORT=your_preferred_port


## Setup Instructions

1. **Clone the Repository:**

   git clone https://github.com/Nextrated/PaystackWalletApp.git
   ```

2. **Install Dependencies:**

   cd your-repo
   npm install
   

3. **Set Up Environment Variables:**
   Create a `.env` file in the root directory and fill in your credentials as listed above.

   Then, navigate to src/public/config and update the API_BASE_URL to your local or deployed URL (e.g., https://localhost:3000 or your production URL).

4. **Run the Application:**

   npm run dev
   


