import type {ReactNode} from "react";

/**
 * Displays a single playlist entry with cover art, title and subtitle.
 * Shows a delete button for hosts.
 *
 * @param index The playlist's position in the list
 * @param title The primary display name
 * @param subtitle Optional secondary text
 * @param coverURL URL for the cover image or null
 * @param hrefURL URL to open in new tab when clicking the title.
 * @param children What to show at the right part of the card (e.g. a button)
 */
export function PlaylistCard({title, subtitle, coverURL, hrefURL, children}: {
  title: string,
  subtitle?: string,
  coverURL?: string|null,
  hrefURL?: string,
  showDelete?: boolean,
  children?: ReactNode
}) {
  return (
      <li className="flex items-center gap-6 p-3 bg-card-bg rounded-lg">
        {coverURL ? (
            <img src={coverURL} alt="Album Cover" className="w-25 h-25 lg:w-30 lg:h-30 2xl:w-40 2xl:h-40 rounded-xl object-cover" />
        ) : (
            <div className="min-w-25 min-h-25 lg:min-w-30 lg:min-h-30 2xl:min-w-40 2xl:min-h-40 rounded-xl bg-disabled-bg flex items-center justify-center">
              <span className="text-disabled-text text-4xl">?</span>
            </div>
        )}
        <div className="w-full">
          {hrefURL ? (
            <a
                target="_blank"
                rel="noopener noreferrer" href={hrefURL}
                className="text-xl font-medium wrap-break-word hover:underline hover:cursor-pointer">
              {title}
            </a>
          ) : (
            <span className="text-xl font-medium wrap-break-word">{title}</span>
          )}
          {subtitle && <div className="mt-1 text-sm text-disabled-text block">{subtitle}</div>}
        </div>
        <div className="flex items-center justify-center">
          {children}
        </div>
      </li>
  );
}