import type { PropsWithChildren } from "react";

type Props = {
  title: string;
};

export function Panel({ title, children }: PropsWithChildren<Props>) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
