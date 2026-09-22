// The page's entry point (DECISIONS T9.7): plain TypeScript, bundled by Vite
// into dist/web/ (Q22). For now it only fills in the heading, which shows the
// bundle loaded and ran rather than the HTML alone being served.
const app = document.querySelector("#app");
if (app === null) throw new Error("index.html has no #app element");
const heading = document.createElement("h1");
heading.textContent = "Herbie Lite";
app.append(heading);
