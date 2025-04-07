import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import DOMPurify from 'dompurify';

export const generatePDF = async (content: string): Promise<void> => {
  try {
    const doc = new jsPDF();

    // Convert markdown to HTML
    const html = await marked(content);

    // Sanitize HTML
    const sanitizedHtml = DOMPurify.sanitize(html);

    // Split text into lines and add to PDF
    const lines = doc.splitTextToSize(sanitizedHtml.replace(/<[^>]*>/g, ''), 180);
    doc.setFont("helvetica");
    doc.setFontSize(12);
    doc.text(lines, 15, 20);

    // Create a blob and download using a temporary link
    const pdfBlob = doc.output('blob');
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'receituario-medico.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};