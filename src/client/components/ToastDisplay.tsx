import type { CloseButtonProps } from "react-toastify";
import { Bounce, ToastContainer } from "react-toastify";


function CloseButton({ closeToast }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={() => closeToast("close")}
      className="ml-auto px-1 text-disabled-text hover:text-secondary transition-colors flex justify-right rounded hover:cursor-pointer"
      aria-label="Dismiss toast"
    >
      <span className="material-icons text-sm leading-none" aria-hidden="true">close</span>
    </button>
  );
}

export function ToastDisplay() {
  return (
    <ToastContainer
      transition={Bounce}
      newestOnTop={true}
      className="fixed z-65 top-0 right-0 sm:top-4 sm:right-4"
      toastClassName={context =>
        `${context?.defaultClassName} !text-default !bg-card-bg !p-3 !shadow-lg scale-100 wrap-anywhere overflow-visible sm:!w-sm !sm-rounded-lg flex items-center mb-4`}
      closeButton={CloseButton}
    />
  );
}
