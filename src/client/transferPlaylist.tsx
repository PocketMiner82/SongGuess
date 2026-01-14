import {createRoot} from "react-dom/client";
import {CookieConsent} from "react-cookie-consent";
import {TopBar} from "./components/TopBar";


function App() {
  return (
      <div className="flex flex-col h-screen">
        <CookieConsent location="bottom" buttonText="I understand" overlay >
          This website uses cookies to to enhance the user experience. Only technically necessary cookies are used.
        </CookieConsent>

        <TopBar />


      </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);