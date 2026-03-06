import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Finder" },
    { name: "description", content: "Welcome to Finder!" },
  ];
}

export default function Home() {
  return <div>Dashboard</div>;
}
