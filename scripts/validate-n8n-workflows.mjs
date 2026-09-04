import { readFileSync } from "node:fs";

const files = ["gadgetos-master-suite.json", "gadgetos-error-handler.json"];
const failures = [];

for (const file of files) {
  let workflow;
  try {
    workflow = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    failures.push(`${file}: invalid JSON (${error.message})`);
    continue;
  }

  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const names = new Set();
  const ids = new Set();
  for (const node of nodes) {
    if (!node.name || names.has(node.name))
      failures.push(`${file}: missing or duplicate node name ${node.name || "<empty>"}`);
    if (!node.id || ids.has(node.id))
      failures.push(`${file}: missing or duplicate node id ${node.id || "<empty>"}`);
    names.add(node.name);
    ids.add(node.id);

    if (node.type === "n8n-nodes-base.httpRequest") {
      if (node.parameters?.authentication !== "genericCredentialType")
        failures.push(`${file}: ${node.name} must use credential-based authentication`);
      if (!node.retryOnFail || Number(node.maxTries) < 2)
        failures.push(`${file}: ${node.name} must retry transient failures`);
      if (!Number(node.parameters?.options?.timeout))
        failures.push(`${file}: ${node.name} must have an explicit timeout`);
    }
  }

  for (const [source, outputs] of Object.entries(workflow.connections || {})) {
    if (!names.has(source)) failures.push(`${file}: connection source ${source} does not exist`);
    for (const channels of Object.values(outputs || {})) {
      for (const channel of channels || []) {
        for (const connection of channel || []) {
          if (!names.has(connection.node))
            failures.push(`${file}: connection target ${connection.node} does not exist`);
        }
      }
    }
  }

  if (workflow.settings?.executionOrder !== "v1")
    failures.push(`${file}: executionOrder must be v1`);
  if (!Number(workflow.settings?.executionTimeout))
    failures.push(`${file}: executionTimeout is required`);
  if (workflow.settings?.saveDataErrorExecution !== "all")
    failures.push(`${file}: failed production executions must be retained`);
}

const primary = JSON.parse(readFileSync(files[0], "utf8"));
if (primary.nodes.some((node) => node.type === "n8n-nodes-base.telegramTrigger"))
  failures.push("Primary workflow must not register a second customer Telegram webhook");
const eventWebhook = primary.nodes.find((node) => node.type === "n8n-nodes-base.webhook");
if (eventWebhook?.parameters?.authentication !== "headerAuth")
  failures.push("Operational event webhook must use Header Auth");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${files.length} n8n workflows and ${files.reduce((sum, file) => sum + JSON.parse(readFileSync(file, "utf8")).nodes.length, 0)} nodes.`);
