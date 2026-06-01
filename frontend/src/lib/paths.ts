export function joinPath(currentPath: string, child: string) {
  return currentPath === "/" ? `/${child}` : `${currentPath}/${child}`;
}

export function parentPath(currentPath: string) {
  if (currentPath === "/") return "/";
  const parts = currentPath.split("/").filter(Boolean);
  parts.pop();
  return parts.length === 0 ? "/" : `/${parts.join("/")}`;
}
