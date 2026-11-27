// The one function used from react-dom/client, declared here so that its type
// package is not another dependency.
declare module "react-dom/client" {
  export function createRoot(container: Element): { render(children: import("react").ReactNode): void };
}
