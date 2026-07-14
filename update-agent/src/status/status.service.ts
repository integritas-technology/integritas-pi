import { fetchVerifiedManifest, MANIFEST_SERVICE_KEYS, type Manifest } from "../manifest/manifest.service.js";
import { getLastAppliedVersion } from "../manifest/manifest-state.js";
import { getComposeServiceContainer } from "../docker/docker.service.js";

export type ServiceStatus = {
  service: string;
  currentImage: string | null;
  targetImage: string;
  upToDate: boolean;
};

const MANIFEST_TO_COMPOSE_SERVICE: Record<(typeof MANIFEST_SERVICE_KEYS)[number], string> = {
  frontend: "frontend",
  backend: "backend"
};

export async function getUpdateStatus(): Promise<{
  manifest: Manifest;
  services: ServiceStatus[];
  currentVersion: string | null;
}> {
  const manifest = await fetchVerifiedManifest();

  const services = await Promise.all(
    MANIFEST_SERVICE_KEYS.map(async (manifestKey) => {
      const composeService = MANIFEST_TO_COMPOSE_SERVICE[manifestKey];
      const container = await getComposeServiceContainer(composeService);
      const targetImage = manifest[manifestKey];

      return {
        service: composeService,
        currentImage: container?.Image ?? null,
        targetImage,
        upToDate: container?.Image === targetImage
      };
    })
  );

  const currentVersion = await getLastAppliedVersion();

  return { manifest, services, currentVersion };
}
