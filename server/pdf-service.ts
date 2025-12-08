import PDFDocument from 'pdfkit';
import { Patient, Org, Visit, VisitNote, Employee } from '@shared/schema';

interface NoteWithContext {
  note: VisitNote;
  visit: Visit;
  employee: Employee;
}

interface PDFExportData {
  patient: Patient;
  org: Org;
  notes: NoteWithContext[];
  startDate: string;
  endDate: string;
}

const COLORS = {
  primary: '#17a2b8',
  text: '#333333',
  muted: '#666666',
  light: '#f5f5f5',
  border: '#dddddd'
};

function formatDate(dateString: string): string {
  const parts = dateString.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

function formatDateTime(date: Date | null): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day}/${month}/${year} at ${time}`;
}

function formatDateForFilename(dateString: string): string {
  return dateString.replace(/-/g, '');
}

export function generatePatientNotesFilename(patientId: string, startDate: string, endDate: string): string {
  const start = formatDateForFilename(startDate);
  const end = formatDateForFilename(endDate);
  return `${patientId}_Notes_${start}-${end}.pdf`;
}

export function generatePatientNotesPDF(data: PDFExportData): typeof PDFDocument.prototype {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Header Section
  drawHeader(doc, data, pageWidth);

  // Patient Information Section
  drawPatientInfo(doc, data, pageWidth);

  // Notes Section
  if (data.notes.length === 0) {
    doc.moveDown(2);
    doc.fontSize(12)
       .fillColor(COLORS.muted)
       .text('No notes found for the selected date range.', { align: 'center' });
  } else {
    drawNotes(doc, data.notes, pageWidth);
  }

  // Footer with page numbers
  addPageNumbers(doc);

  return doc;
}

function drawHeader(doc: PDFKit.PDFDocument, data: PDFExportData, pageWidth: number) {
  const { org } = data;

  // Organization name
  doc.fontSize(18)
     .fillColor(COLORS.primary)
     .text(org.org_name, { align: 'center' });

  // Organization details
  doc.fontSize(10)
     .fillColor(COLORS.muted);
  
  if (org.address) {
    doc.text(org.address, { align: 'center' });
  }
  if (org.phone) {
    doc.text(`Phone: ${org.phone}`, { align: 'center' });
  }

  // Divider line
  doc.moveDown(0.5);
  const y = doc.y;
  doc.strokeColor(COLORS.primary)
     .lineWidth(2)
     .moveTo(doc.page.margins.left, y)
     .lineTo(doc.page.width - doc.page.margins.right, y)
     .stroke();
  
  doc.moveDown(1);
}

function drawPatientInfo(doc: PDFKit.PDFDocument, data: PDFExportData, pageWidth: number) {
  const { patient, startDate, endDate } = data;

  // Patient header
  doc.fontSize(14)
     .fillColor(COLORS.text)
     .text('PATIENT INFORMATION', { underline: true });
  
  doc.moveDown(0.5);

  // Patient details in a box
  const boxTop = doc.y;
  const boxPadding = 10;

  doc.rect(doc.page.margins.left, boxTop, pageWidth, 80)
     .fillColor(COLORS.light)
     .fill();

  doc.fillColor(COLORS.text);
  
  // Left column
  const leftX = doc.page.margins.left + boxPadding;
  const rightX = doc.page.margins.left + pageWidth / 2 + boxPadding;
  let currentY = boxTop + boxPadding;

  doc.fontSize(11);
  
  // Patient name
  doc.text(`Patient: ${patient.first_name} ${patient.last_name}`, leftX, currentY);
  doc.text(`MRN: ${patient.patientid}`, rightX, currentY);
  
  currentY += 18;
  doc.text(`Date of Birth: ${patient.date_of_birth ? formatDate(patient.date_of_birth) : 'N/A'}`, leftX, currentY);
  doc.text(`Gender: ${patient.gender || 'N/A'}`, rightX, currentY);
  
  currentY += 18;
  doc.text(`Report Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, leftX, currentY);
  doc.text(`Generated: ${formatDateTime(new Date())}`, rightX, currentY);

  doc.y = boxTop + 80 + 10;
  doc.moveDown(1);
}

function drawNotes(doc: PDFKit.PDFDocument, notes: NoteWithContext[], pageWidth: number) {
  doc.fontSize(14)
     .fillColor(COLORS.text)
     .text(`VISIT NOTES (${notes.length} total)`, { underline: true });

  doc.moveDown(0.5);

  for (let i = 0; i < notes.length; i++) {
    const { note, visit, employee } = notes[i];
    
    // Check if we need a new page
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    // Note header with date/time
    const noteDate = formatDateTime(note.created_at);
    
    doc.fontSize(11)
       .fillColor(COLORS.primary)
       .text(`NOTE ${i + 1} - ${noteDate}`, { continued: false });

    // Provider info
    doc.fontSize(10)
       .fillColor(COLORS.muted)
       .text(`Provider: ${employee.first_name} ${employee.last_name} (${employee.title || 'Staff'})`);
    
    // Visit purpose
    if (visit.visit_purpose) {
      doc.text(`Visit Purpose: ${visit.visit_purpose}`);
    }

    // Badges
    const badges: string[] = [];
    if (note.ai_transcribed) badges.push('AI Generated');
    if (note.is_transcription_edited) badges.push('Edited');
    if (note.audio_filename) badges.push(`Audio: ${note.audio_duration_seconds || 0}s`);
    
    if (badges.length > 0) {
      doc.text(`[${badges.join('] [')}]`);
    }

    doc.moveDown(0.3);

    // Transcription text
    doc.fontSize(10)
       .fillColor(COLORS.text);
    
    if (note.transcription_text) {
      // Draw a light background for transcription
      const textStartY = doc.y;
      const transcriptionText = note.transcription_text;
      
      doc.text(transcriptionText, {
        width: pageWidth - 20,
        align: 'left',
        indent: 10
      });
    } else {
      doc.fillColor(COLORS.muted)
         .text('No transcription available', { indent: 10 });
    }

    doc.moveDown(1);

    // Separator line (except for last note)
    if (i < notes.length - 1) {
      const y = doc.y;
      doc.strokeColor(COLORS.border)
         .lineWidth(0.5)
         .moveTo(doc.page.margins.left, y)
         .lineTo(doc.page.width - doc.page.margins.right, y)
         .stroke();
      doc.moveDown(0.5);
    }
  }
}

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    
    // Footer
    const bottomY = doc.page.height - 30;
    
    doc.fontSize(8)
       .fillColor(COLORS.muted)
       .text(
         `Page ${i + 1} of ${pages.count} | NotesMate MD - Created by Zapurzaa Systems | CONFIDENTIAL MEDICAL RECORD`,
         doc.page.margins.left,
         bottomY,
         { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
       );
  }
}
