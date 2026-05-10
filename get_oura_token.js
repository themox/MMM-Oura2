/**
 * One-time CLI OAuth2 flow for Oura on a headless server.
 *
 * Usage:
 *   node get-oura-token-cli.js
 *
 * Requires:
 *   - oura_credentials.json
 *
 * Creates:
 *   - oura_auth.json
 */

const fs = require("fs");
const readline = require("readline");
const crypto = require("crypto");

const CREDS_PATH = "credentials.json";
const TOKEN_PATH = "oura_auth.json";

const credentials = JSON.parse(
  fs.readFileSync(CREDS_PATH, "utf8")
);

const {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  redirect_uri: REDIRECT_URI,
} = credentials.installed;

const state = crypto.randomBytes(16).toString("hex");

const authUrl =
  "https://cloud.ouraring.com/oauth/authorize?" +
  new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "personal daily heartrate",
    state,
  }).toString();

console.log("\n1. Open this URL in a browser:\n");
console.log(authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "\n2. Paste the FULL redirected URL here: ",
  async redirectedUrl => {
    rl.close();

    try {
      const url = new URL(redirectedUrl.trim());

      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");

      if (!code) {
        throw new Error("No authorization code found.");
      }

      if (returnedState !== state) {
        throw new Error("OAuth state mismatch.");
      }

      const resp = await fetch(
        "https://api.ouraring.com/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
          }),
        }
      );

      if (!resp.ok) {
        throw new Error(
          `HTTP ${resp.status}: ${await resp.text()}`
        );
      }

      const data = await resp.json();

      const tokens = {
        ...data,
        expires_at:
          Date.now() + data.expires_in * 1000,
      };

      fs.writeFileSync(
        TOKEN_PATH,
        JSON.stringify(tokens, null, 2)
      );

      console.log(`\nSaved tokens to ${TOKEN_PATH}`);
    } catch (err) {
      console.error("\nError retrieving Oura token:");
      console.error(
        err.response?.data || err.message || err
      );
    }
  }
);