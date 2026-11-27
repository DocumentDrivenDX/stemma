declare module "*.csl" {
  const text: string;
  export default text;
}
declare module "*.xml" {
  const text: string;
  export default text;
}
declare module "citeproc" {
  const CSL: {
    Engine: new (sys: { retrieveLocale: (lang: string) => string; retrieveItem: (id: string) => unknown }, style: string, lang: string, forceLang: boolean) => {
      setOutputFormat(format: string): void;
      processCitationCluster(citation: unknown, pre: [string, number][], post: [string, number][]): unknown;
      updateItems(ids: string[]): void;
      makeBibliography(): unknown;
    };
    Output: { Formats: unknown };
    PROCESSOR_VERSION: string;
  };
  export default CSL;
}
