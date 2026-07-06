import { fetchVerifiedManifest, type Manifest } from "../manifest/manifest.service.js";
import { getComposeServiceContainer } from "../docker/docker.service.js";

export type ServiceStatus = {
  service: string;
  currentImage: string | null;
  targetImage: string;
  upToDate: boolean;
};

const MANIFEST_TO_COMPOSE_SERVICE: Record<keyof Manifest, string> = {
  frontend: "frontend",
  backend: "backend",
  "minima-node": "minima"
};

export async function getUpdateStatus(): Promise<{ manifest: Manifest; services: ServiceStatus[] }> {
  const manifest = await fetchVerifiedManifest();

  const services = await Promise.all(
    (Object.keys(manifest) as (keyof Manifest)[]).map(async (manifestKey) => {
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

  return { manifest, services };
}
