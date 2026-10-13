/**
 * One field style for every athlete-facing form (sign in, onboarding,
 * profile, password, heat changes), so they all feel like the same club.
 */
const base =
  "w-full bg-white/70 border border-midnight/20 text-base text-midnight placeholder:text-midnight/35 transition-colors hover:border-midnight/40 focus:bg-white focus:border-terracotta focus-visible:outline-1! focus-visible:outline-offset-0!";

export const fieldInputCls = `${base} h-14 px-4`;
export const fieldTextareaCls = `${base} px-4 py-3.5 leading-relaxed`;
export const fieldSelectCls = `${base} h-14 appearance-none pl-4 pr-10 cursor-pointer [&_option]:text-midnight`;
export const fieldLabelCls = "t-eyebrow block text-dust mb-2.5";
