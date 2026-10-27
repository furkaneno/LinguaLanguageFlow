declare module "pdfmake/build/pdfmake" {
  import type { TDocumentDefinitions } from "pdfmake/interfaces";
  const pdfMake: {
    addVirtualFileSystem(vfs: Record<string, string>): void;
    createPdf(definition: TDocumentDefinitions): { download(fileName?: string): Promise<void> };
  };
  export default pdfMake;
}
declare module "pdfmake/build/vfs_fonts" {
  const vfs: Record<string, string>;
  export default vfs;
}
