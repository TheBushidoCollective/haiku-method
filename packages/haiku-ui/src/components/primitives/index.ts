/**
 * Primitive component barrel — the token-compliant foundation layer.
 *
 * Downstream units migrate callers from the legacy components in
 * `src/components/*.tsx` to these primitives.
 */
export { Badge } from "./Badge"
export type { BadgeProps, BadgeSize, BadgeTone } from "./Badge"
export { Button } from "./Button"
export type { ButtonProps, ButtonSize, ButtonVariant } from "./Button"
export { Card } from "./Card"
export type { CardElevation, CardPadding, CardProps } from "./Card"
export { Chip } from "./Chip"
export type { ChipProps, ChipTone } from "./Chip"
export { Divider } from "./Divider"
export type { DividerOrientation, DividerProps } from "./Divider"
export { Input } from "./Input"
export type { InputProps } from "./Input"
