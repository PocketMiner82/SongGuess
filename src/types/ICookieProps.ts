/**
 * Interface representing all cookie properties used by the application.
 */
export default interface ICookieProps {
  /** Audio volume level (0-1) */
  audioVolume?: number;
  /** Whether audio is muted */
  audioMuted?: boolean;
  /** The user's unique identifier */
  userID?: string;
  /** The user's display name */
  userName?: string;
}
