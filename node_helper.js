var NodeHelper = require("node_helper");
const { getOuraData } = require("./oura_data.js");
const fs = require("fs");
const path = require("path");

const tokenPath = path.join(__dirname, "oura_auth.json");

function saveTokens(tokens) {
	tokens.expires_at = Date.now() + tokens.expires_in * 1000;
	fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
}

function loadTokens() {
	if (!fs.existsSync(tokenPath)) return null;
	return JSON.parse(fs.readFileSync(tokenPath));
}

function getAuthStatus(config = {}) {
  const status = {
    tokenFile: tokenPath,
    tokenFileExists: fs.existsSync(tokenPath),
    hasClientId: Boolean(config.clientId),
    hasClientSecret: Boolean(config.clientSecret),
    hasRedirectUri: Boolean(config.redirectUri),
    authorizeUrl: config.redirectUri
      ? config.redirectUri.replace("/oauth/callback", "/oauth/start")
      : null,
  };

  if (!status.tokenFileExists) {
    status.state = "not_authorized";
    status.reason = "missing_token_file";
    return status;
  }

  const tokens = loadTokens();

  status.hasAccessToken = Boolean(tokens?.access_token);
  status.hasRefreshToken = Boolean(tokens?.refresh_token);
  status.expiresAt = tokens?.expires_at
    ? new Date(tokens.expires_at).toISOString()
    : null;
  status.isExpired = tokens?.expires_at
    ? Date.now() >= tokens.expires_at - 60000
    : true;

  status.state =
    status.hasAccessToken && status.hasRefreshToken
      ? status.isExpired
        ? "needs_refresh"
        : "authorized"
      : "invalid_token_file";

  return status;
}

async function getAccessToken(config) {

	const status = getAuthStatus(config);
	console.log("[MMM-Oura2] Auth status:", JSON.stringify(status, null, 2));

	let tokens = loadTokens();
	console.log("[MMM-Oura2] token file:", tokenPath);
	console.log("[MMM-Oura2] has access:", Boolean(tokens?.access_token));
	console.log("[MMM-Oura2] has refresh:", Boolean(tokens?.refresh_token));
	console.log("[MMM-Oura2] expires_at:", tokens?.expires_at);
	console.log("[MMM-Oura2] expired:", Date.now() >= tokens?.expires_at - 60000);

	if (!tokens) {
		    console.log(`Authorize Oura: ${config.redirectUri.replace("/oauth/callback", "/oauth/start")}`);
		throw new Error(
		
			`MMM-Oura2 is not authorized yet. Visit: ${status.authorizeUrl}`
		);
	}
	  //let tokens = loadTokens();

  if (!tokens) {

    throw new Error("MMM-Oura2 is not authorized yet");
  }

  if (Date.now() < tokens.expires_at - 60000) {
    return tokens.access_token;
  }

  const resp = await fetch(
  "https://api.ouraring.com/oauth/token",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  }
);

if (!resp.ok) {
  throw new Error(
    `HTTP ${resp.status}: ${await resp.text()}`
  );
}

const tokenResp = await resp.json();

  saveTokens(tokenResp);
  return tokenResp.access_token;
}

module.exports = NodeHelper.create({

    start: function() {
		console.log("Starting node helper for: " + this.name);
	},

   socketNotificationReceived: function(notification, payload) {
		console.log("[MMM-Oura2] socket received:", notification);

		if (notification === "MODULE_READY" || notification === "REQUEST_UPDATE") {
			this.config = payload;
			//console.log("[MMM-Oura2] config received");
			this.getOura(this.config);
		}
	},

	getOura: async function(config) {
		try {
			console.log("[MMM-Oura2] fetching access token");
			const token = await getAccessToken(config);

			//console.log("[MMM-Oura2] fetching Oura data");
			const ouradata = await getOuraData({ ...config, token });

			//console.log("[MMM-Oura2] Oura data columns:", Object.keys(ouradata || {}));
			this.sendSocketNotification("UPDATE_CHART", ouradata);
		} catch (err) {
			console.log("[MMM-Oura2] Oura fetch error");
			console.log(err.response?.data || err.message || err);
		}
	},
});
