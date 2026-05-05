import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "../../../../components/Button";

/**
 * Button component that copies the current page URL to clipboard.
 * Shows feedback when the link is successfully copied.
 */
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(setCopied, 2000, false);
    } catch (err) {
      console.error("Failed to copy link:", err);
      toast.error("Failed to copy link.");
    }
  };

  return (
    <Button
      type="button"
      onClick={handleCopyLink}
      aria-label={copied ? "Link copied" : "Copy room link"}
    >
      <span className="material-symbols-outlined mr-2" aria-hidden="true">
        {copied ? "check" : "content_copy"}
      </span>
      {copied ? "Copied!" : "Copy Link"}
    </Button>
  );
}
