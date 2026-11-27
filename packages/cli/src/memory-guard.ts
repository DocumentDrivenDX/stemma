// The memory guard of a process that reads a PDF. Reading a small PDF can take
// gigabytes in about a second (streams and images that unpack far larger than
// the file), and the library unpacks them without yielding, so a timer beside it
// would not run. This looks from a thread of its own, and ends the whole process
// at once.
const GUARD = `onmessage = (event) => {
  const look = () => { if (process.memoryUsage.rss() > event.data) process.kill(process.pid, "SIGKILL"); };
  look();
  setInterval(look, 5);
  postMessage("watching");
};`;

/** Resolves once the guard is looking. A PDF is never read without it. */
export function guard(most: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!(most > 0)) return reject(new Error("no bound"));
    const thread = new Worker(URL.createObjectURL(new Blob([GUARD], { type: "text/javascript" })));
    let watching = false;
    const lost = () => (watching ? process.kill(process.pid, "SIGKILL") : reject(new Error("no guard")));
    thread.addEventListener("error", lost);
    thread.addEventListener("close", lost);
    thread.addEventListener("message", () => {
      watching = true;
      resolve();
    });
    thread.postMessage(most);
  });
}
