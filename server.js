import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

const CONFIG = {
  instanceUrl: process.env.DATABRICKS_INSTANCE_URL,
  workspaceId: process.env.DATABRICKS_WORKSPACE_ID,
  dashboardId: process.env.DATABRICKS_DASHBOARD_ID,
  clientId: process.env.DATABRICKS_CLIENT_ID,
  clientSecret: process.env.DATABRICKS_CLIENT_SECRET
};

app.use(express.static("public"));

async function getScopedToken() {
  const basicAuth = Buffer.from(
    `${CONFIG.clientId}:${CONFIG.clientSecret}`
  ).toString("base64");

  // 1. Get the service-principal OAuth token
  const tokenResponse = await fetch(
    `${CONFIG.instanceUrl}/oidc/v1/token?o=${CONFIG.workspaceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "all-apis"
      })
    }
  );

  if (!tokenResponse.ok) {
    throw new Error(
      `Databricks OAuth failed: ${await tokenResponse.text()}`
    );
  }

  const tokenData = await tokenResponse.json();
  const oidcToken = tokenData.access_token;

  // 2. Get the dashboard token information
  const tokenInfoUrl =
    `${CONFIG.instanceUrl}/api/2.0/lakeview/dashboards/` +
    `${CONFIG.dashboardId}/published/tokeninfo` +
    `?o=${CONFIG.workspaceId}` +
    `&external_viewer_id=portfolio_viewer` +
    `&external_value=portfolio_viewer`;

  const tokenInfoResponse = await fetch(tokenInfoUrl, {
    headers: {
      "Authorization": `Bearer ${oidcToken}`
    }
  });

  if (!tokenInfoResponse.ok) {
    throw new Error(
      `Databricks tokeninfo failed: ${await tokenInfoResponse.text()}`
    );
  }

  const tokenInfo = await tokenInfoResponse.json();

  // 3. Generate a tightly scoped token
  const {
    authorization_details,
    ...tokenParameters
  } = tokenInfo;

  const scopedTokenResponse = await fetch(
    `${CONFIG.instanceUrl}/oidc/v1/token?o=${CONFIG.workspaceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        ...tokenParameters,
        grant_type: "client_credentials",
        authorization_details: JSON.stringify(authorization_details)
      })
    }
  );

  if (!scopedTokenResponse.ok) {
    throw new Error(
      `Scoped token generation failed: ${await scopedTokenResponse.text()}`
    );
  }

  const scopedTokenData = await scopedTokenResponse.json();

  return scopedTokenData.access_token;
}

app.get("/api/dashboard-token", async (req, res) => {
  try {
    const token = await getScopedToken();

    res.json({
      token,
      instanceUrl: CONFIG.instanceUrl,
      workspaceId: CONFIG.workspaceId,
      dashboardId: CONFIG.dashboardId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Unable to generate dashboard token."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});