import { APP_NAME } from "@/config/app";
import { buildCardsPdf, pdfFileName, type ExportCard } from "./cardsPdf";

/** Loads pdfmake only when the button is pressed, so it never slows down normal page loads. */
export async function downloadCardsPdf(className: string, cards: ExportCard[]) {
  const [pdfMakeModule, fontsModule] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  const pdfMake = (pdfMakeModule as { default?: typeof pdfMakeModule.default }).default ?? (pdfMakeModule as unknown as typeof pdfMakeModule.default);
  const vfs = (fontsModule as { default?: Record<string, string> }).default ?? (fontsModule as unknown as Record<string, string>);
  pdfMake.addVirtualFileSystem(vfs);
  await pdfMake.createPdf(buildCardsPdf(className, cards, new Date(), APP_NAME)).download(pdfFileName(className));
}
