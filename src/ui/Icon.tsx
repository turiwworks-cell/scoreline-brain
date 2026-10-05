import type { CSSProperties, SVGAttributes } from 'react';
import { ICONS, iconId, type IconName } from './icons';

/*
 * A UI icon from the sprite (icon(), luau:3106). Drawn at the Lua's own size by default
 * (`scale` 1 = the box its coordinates live in) in the current text colour, with the
 * stroke the Lua uses for it.
 */
export type IconProps = Omit<SVGAttributes<SVGSVGElement>, 'stroke'> & {
  name: IconName;
  /** k in icon(..., k, ...): multiplies the icon's box */
  scale?: number;
  /** stroke width in the icon's own units, for stroked icons */
  stroke?: number;
  /** the follow star, on: filled with the spectrum instead of outlined (followIcon, luau:3129) */
  on?: boolean;
  /** an accessible name; without it the icon is decorative */
  label?: string;
};

export function Icon({ name, scale = 1, stroke, on, label, style, ...rest }: IconProps) {
  const [, , w, h] = ICONS[name].box;
  const st = (stroke !== undefined ? { ...style, '--icon-sw': stroke } : style) as CSSProperties | undefined;
  const href = on && name === 'follow' ? '#sl-i-follow-on' : `#${iconId(name)}`;
  return (
    <svg
      width={w * scale}
      height={h * scale}
      overflow="visible"
      style={st}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      focusable="false"
      {...rest}
    >
      <use href={href} width="100%" height="100%" />
    </svg>
  );
}
