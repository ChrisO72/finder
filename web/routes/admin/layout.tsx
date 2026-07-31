import { Outlet } from "react-router";
import { AdminNav } from "./admin-nav";

export default function AdminLayout() {
  return (
    <div>
      <AdminNav />
      <Outlet />
    </div>
  );
}
