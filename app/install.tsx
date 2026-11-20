"use client";
import { useEffect, useState, useRef } from "react";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function Install() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null),
    [installed, done] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const capture = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const complete = () => {
      done(true);
      setPrompt(null);
      dialog.current?.close();
    };
    done(window.matchMedia("(display-mode: standalone)").matches);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  return (
    <>
      <a href="/downloads/Padikkalam-Android.apk" download>Download Android APK</a>
      {!installed&&<button
        onClick={async () => {
          if (prompt) {
            try {
              await prompt.prompt();
              await prompt.userChoice;
            } finally {
              setPrompt(null);
            }
          } else dialog.current?.showModal();
        }}
      >
        Install web app
      </button>}
      <dialog ref={dialog} aria-labelledby="install-heading">
        <div className="eyebrow">MOBILE APP</div>
        <h2 id="install-heading">Install Padikkalam.lk</h2>
        <p>
          <strong>Android</strong> · Open this site in Chrome, open its menu and
          choose Install app or Add to Home screen.
        </p>
        <p>
          <strong>iPhone</strong> · Open this site in Safari, tap Share and
          choose Add to Home Screen.
        </p>
        <div className="actions">
          <button
            className="btn yellow"
            onClick={() => dialog.current?.close()}
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
