import { useQuery } from "@tanstack/react-query";
import { Permission, DEFAULT_ROLE_PERMISSIONS, ConfigurableRole } from "@/lib/permissions";

interface RolePermissionsMap {
  moderation: Permission[];
  sales: Permission[];
}

export function usePermissions() {
  const { data: session } = useQuery({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return { role: "user" };
      return res.json();
    },
  });

  const { data: rolePermissions } = useQuery<RolePermissionsMap>({
    queryKey: ["/api/admin/role-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/role-permissions", { credentials: "include" });
      if (!res.ok) return DEFAULT_ROLE_PERMISSIONS;
      return res.json();
    },
    staleTime: 60_000,
  });

  const role = session?.role ?? "user";

  const can = (permission: Permission): boolean => {
    if (role === "admin") return true;
    if (role !== "moderation" && role !== "sales") return false;
    const perms = rolePermissions?.[role as ConfigurableRole] ?? DEFAULT_ROLE_PERMISSIONS[role as ConfigurableRole] ?? [];
    return perms.includes(permission);
  };

  const username = session?.username ?? "";

  return { can, role, username };
}
