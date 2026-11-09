import Header from "./Header";

export default function Doc({ active, children }: { active?: string; children: React.ReactNode }) {
  return (
    <>
      <Header active={active} />
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <article className="prose-doc panel p-6 sm:p-10">{children}</article>
      </main>
    </>
  );
}
