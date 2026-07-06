export type DockerContainerSummary = {
  Id: string;
  Names: string[];
  State: string;
  Image: string;
  ImageID: string;
  Labels?: Record<string, string>;
};

export type DockerContainerInspect = {
  Id: string;
  Name: string;
  Image: string;
  State: { Running: boolean; Health?: { Status: string } };
  Config: Record<string, unknown>;
  HostConfig: Record<string, unknown>;
  NetworkSettings: {
    Networks: Record<string, { Aliases?: string[] | null }>;
  };
};

export type DockerImageSummary = {
  Id: string;
  RepoDigests?: string[];
  Created: number;
};
