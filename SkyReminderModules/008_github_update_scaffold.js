const SKY_REMINDER_UPDATE_SCAFFOLD = Object.freeze({
  enabled: true,
  manifestUrl: "https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/SkyReminderModules/manifest.json",
  hashAlgorithm: "sha256",
  policies: Object.freeze(["missing", "daily", "always"]),
});

function buildSkyReminderUpdatePlan(localManifest, remoteManifest) {
  const localParts = Array.isArray(localManifest?.parts) ? localManifest.parts : [];
  const remoteParts = Array.isArray(remoteManifest?.parts) ? remoteManifest.parts : [];
  const localByFile = Object.create(null);
  for (const part of localParts) {
    if (part && part.file) localByFile[String(part.file)] = part;
  }
  return remoteParts
    .filter(part => part && part.file)
    .map(part => {
      const local = localByFile[String(part.file)] || null;
      const changed = !local || String(local.sha256 || "") !== String(part.sha256 || "");
      return { file: String(part.file), url: String(part.url || ""), sha256: String(part.sha256 || ""), changed };
    })
    .filter(item => item.changed);
}

async function skyReminderCheckForGithubUpdateDisabled() {
  throw new Error("GitHub update is implemented in the root loader so it can run before module loading. Configure settings.githubUpdate from the app UI.");
}
