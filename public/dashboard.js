import { DatabricksDashboard } from
  "https://cdn.jsdelivr.net/npm/@databricks/aibi-client@0.0.0-alpha.7/+esm";

async function loadDashboard() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const container = document.getElementById("dashboard-content");

  try {
    const response = await fetch("/api/dashboard-token");

    if (!response.ok) {
      throw new Error("Failed to retrieve dashboard token.");
    }

    const {
      token,
      instanceUrl,
      workspaceId,
      dashboardId
    } = await response.json();

    const dashboard = new DatabricksDashboard({
      instanceUrl,
      workspaceId,
      dashboardId,
      token,
      container,
      config: {
        version: 1,
        hideDatabricksLogo: false
      }
    });

    loading.remove();

    await dashboard.initialize();

  } catch (err) {
    console.error(err);

    loading.hidden = true;
    error.hidden = false;
  }
}

loadDashboard();