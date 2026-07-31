import { Link } from "react-router";

export function meta() {
  return [
    { title: "Finder" },
    { name: "description", content: "Search podcasts and jump to the exact moment." },
  ];
}

export default function Home() {
  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#050505] px-5 text-center text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(83,83,100,0.24),transparent_44%)]" />
      <p className="absolute top-6 left-1/2 -translate-x-1/2 text-[0.65rem] font-medium tracking-[0.42em] text-white/45 uppercase">
        Finder
      </p>
      <h1 className="relative w-full max-w-[1600px] text-[clamp(3.75rem,12vw,11rem)] leading-[0.82] font-semibold tracking-[-0.075em] text-balance">
        Find
        <br />
        moments
      </h1>
      <Link
        to="/login"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-[0.16em] text-white/35 uppercase transition hover:text-white/75"
      >
        Admin
      </Link>
    </main>
  );
}
