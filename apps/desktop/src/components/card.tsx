import type { ReactNode } from "react";

interface RowProps {
  title: ReactNode;
  about?: ReactNode;
  children?: ReactNode;
  below?: ReactNode;
}

export const Row = ({ title, about, children, below }: RowProps) => (
  <div className="border-rim border-b last:border-0">
    <div className="flex items-center gap-6 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-paper text-[13px]">{title}</p>
        {about ? (
          <p className="text-fog text-[12px] [overflow-wrap:anywhere]">
            {about}
          </p>
        ) : null}
      </div>
      {children}
    </div>
    {below ? <div className="px-4 pb-4">{below}</div> : null}
  </div>
);

interface CardProps {
  id: string;
  title: string;
  about?: string;
  children: ReactNode;
}

export const anchor = (id: string) => id.replace(" ", "-");

export const Card = ({ id, title, about, children }: CardProps) => (
  <section className="flex scroll-mt-6 flex-col gap-2" id={anchor(id)}>
    <div className="flex items-baseline gap-3 px-1">
      <h2 className="text-fog text-[12px]">{title}</h2>
      {about ? <p className="text-fog/70 text-[11.5px]">{about}</p> : null}
    </div>
    <div className="border-rim bg-raise/50 rounded-xl border">{children}</div>
  </section>
);
