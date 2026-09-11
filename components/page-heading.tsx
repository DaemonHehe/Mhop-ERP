export function PageHeading({
  eyebrow,
  title,
  description,
  action,
  compactOnMobile = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  compactOnMobile?: boolean;
}) {
  return (
    <div className={`${compactOnMobile ? "mb-4 gap-2" : "mb-6 gap-4"} flex flex-col justify-between md:mb-7 md:flex-row md:items-end`}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className={`display font-semibold leading-[1.05] md:text-4xl ${compactOnMobile ? "mt-1.5 text-[1.65rem]" : "mt-2 text-[2rem]"}`}>
          {title}
        </h1>
        <p className={`max-w-2xl text-sm text-[#6f7069] ${compactOnMobile ? "mt-1.5 line-clamp-2 leading-5 sm:mt-2 sm:line-clamp-none sm:leading-6" : "mt-2 leading-6"}`}>
          {description}
        </p>
      </div>
      {action && (
        <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
          {action}
        </div>
      )}
    </div>
  );
}
