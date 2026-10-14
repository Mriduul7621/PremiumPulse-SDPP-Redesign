import type jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Browser downloads normally; Android uses a native file URI and system save/share chooser. */
export async function savePdf(pdf: jsPDF, requestedName: string): Promise<void> {
  const filename = requestedName.replace(/[\\/:*?"<>|]/g, '_').replace(/[^\x20-\x7E]/g, '_');
  if (!Capacitor.isNativePlatform()) {
    pdf.save(filename);
    return;
  }
  const base64 = pdf.output('datauristring').split(',')[1];
  if (!base64) throw new Error('PDF generation returned no data');
  const file = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  await Share.share({ title: filename, url: file.uri, dialogTitle: 'Save or share PDF' });
}
