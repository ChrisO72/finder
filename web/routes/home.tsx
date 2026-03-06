import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Labs stack" },
    { name: "description", content: "Welcome to Labs stack!" },
  ];
}

export default function Home() {
  return <div>Dashboard</div>;
}
